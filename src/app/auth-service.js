import { randomUUID } from 'node:crypto';
import { createSessionToken, hashPassword, hashSessionToken, verifyPassword } from '../core/auth.js';

const SESSION_HOURS = 12;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function mapUser(row) {
  if (!row) return null;
  return {
    accountId: row.account_id,
    professionalId: row.professional_id,
    name: row.name,
    email: row.email,
    role: row.role
  };
}

function expiresAt(hours = SESSION_HOURS) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

export function createAuthService(db) {
  function setupRequired() {
    return db.prepare('SELECT COUNT(*) AS count FROM auth_accounts').get().count === 0;
  }

  function createSession(accountId) {
    const token = createSessionToken();
    const id = randomUUID();
    db.prepare(`
      INSERT INTO auth_sessions(id, account_id, token_hash, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(id, accountId, hashSessionToken(token), expiresAt());
    return token;
  }

  function authenticate(token) {
    if (!token) return null;
    const tokenHash = hashSessionToken(token);
    const row = db.prepare(`
      SELECT a.id AS account_id, a.professional_id, a.email, a.role, p.name
      FROM auth_sessions s
      JOIN auth_accounts a ON a.id = s.account_id
      JOIN professionals p ON p.id = a.professional_id
      WHERE s.token_hash = ?
        AND s.revoked_at IS NULL
        AND s.expires_at > ?
        AND a.active = 1
    `).get(tokenHash, new Date().toISOString());
    if (!row) return null;
    db.prepare('UPDATE auth_sessions SET last_seen_at = ? WHERE token_hash = ?')
      .run(new Date().toISOString(), tokenHash);
    return mapUser(row);
  }

  function setup({ name, email, password }) {
    if (!setupRequired()) throw new Error('Configuração inicial já concluída.');
    const cleanName = String(name || '').trim();
    const cleanEmail = normalizeEmail(email);
    if (!cleanName) throw new Error('Informe o nome do profissional.');
    if (!cleanEmail || !cleanEmail.includes('@')) throw new Error('Informe um e-mail válido.');
    const credentials = hashPassword(password);
    const professionalId = randomUUID();
    const accountId = randomUUID();
    db.exec('BEGIN IMMEDIATE;');
    try {
      db.prepare('INSERT INTO professionals(id, name, email) VALUES (?, ?, ?)')
        .run(professionalId, cleanName, cleanEmail);
      db.prepare(`
        INSERT INTO auth_accounts(
          id, professional_id, email, password_salt, password_hash, password_algorithm, role
        ) VALUES (?, ?, ?, ?, ?, ?, 'admin')
      `).run(accountId, professionalId, cleanEmail, credentials.salt, credentials.hash, credentials.algorithm);
      db.exec('COMMIT;');
    } catch (error) {
      db.exec('ROLLBACK;');
      throw error;
    }
    const token = createSession(accountId);
    return { token, user: { accountId, professionalId, name: cleanName, email: cleanEmail, role: 'admin' } };
  }

  function login({ email, password }) {
    const cleanEmail = normalizeEmail(email);
    const row = db.prepare(`
      SELECT a.id AS account_id, a.professional_id, a.email, a.role,
             a.password_salt, a.password_hash, a.active, p.name
      FROM auth_accounts a
      JOIN professionals p ON p.id = a.professional_id
      WHERE a.email = ? COLLATE NOCASE
    `).get(cleanEmail);
    if (!row || !row.active || !verifyPassword(password, row.password_salt, row.password_hash)) {
      const error = new Error('Credenciais inválidas.');
      error.code = 'INVALID_CREDENTIALS';
      throw error;
    }
    db.prepare(`
      UPDATE auth_sessions SET revoked_at = ?
      WHERE account_id = ? AND revoked_at IS NULL AND expires_at <= ?
    `).run(new Date().toISOString(), row.account_id, new Date().toISOString());
    const token = createSession(row.account_id);
    return { token, user: mapUser(row) };
  }

  function logout(token) {
    if (!token) return;
    db.prepare(`
      UPDATE auth_sessions SET revoked_at = ?
      WHERE token_hash = ? AND revoked_at IS NULL
    `).run(new Date().toISOString(), hashSessionToken(token));
  }

  function getStatus(token) {
    const user = authenticate(token);
    return { setupRequired: setupRequired(), authenticated: Boolean(user), user };
  }

  return { setupRequired, setup, login, logout, authenticate, getStatus };
}
