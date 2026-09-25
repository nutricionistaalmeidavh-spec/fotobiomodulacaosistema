import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createF9Service } from './f9-service.js';
import { hashPassword } from '../core/auth.js';
import { createBackup, verifyBackup } from '../core/backup.js';
import { buildAuditEvent } from '../core/audit.js';
import { SEED_IDS } from './seed.js';

const ROLES = new Set(['admin', 'professional', 'reception']);

function text(value, label) {
  const clean = String(value ?? '').trim();
  if (!clean) throw new Error(`${label} is required`);
  return clean;
}

function email(value) {
  const clean = String(value ?? '').trim().toLowerCase();
  if (!clean || !clean.includes('@')) throw new Error('Valid email is required');
  return clean;
}

function role(value) {
  const clean = String(value ?? '').trim();
  if (!ROLES.has(clean)) throw new Error('Unsupported clinic role');
  return clean;
}

function mapClinic(row) {
  return row ? {
    id: row.id,
    name: row.name,
    mediaRetentionDays: row.media_retention_days ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  } : null;
}

function mapAccount(row) {
  return row ? {
    accountId: row.account_id,
    professionalId: row.professional_id,
    clinicId: row.clinic_id,
    name: row.name,
    email: row.email,
    role: row.membership_role || row.legacy_role,
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  } : null;
}

function mapSession(row) {
  return {
    id: row.id,
    accountId: row.account_id,
    email: row.email,
    name: row.name,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    lastSeenAt: row.last_seen_at,
    revokedAt: row.revoked_at
  };
}

function appendAudit(db, base, { action, entityType, entityId, payload = {}, actorId }) {
  const previousEvent = base.getAudit().events.at(-1) ?? null;
  const event = buildAuditEvent({
    id: randomUUID(),
    actorType: 'professional',
    actorId: actorId || SEED_IDS.professional,
    action,
    entityType,
    entityId,
    payload,
    previousEvent,
    createdAt: new Date().toISOString()
  });
  db.prepare(`INSERT INTO audit_events(
    id, actor_type, actor_id, action, entity_type, entity_id, payload_json, prev_hash, event_hash, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(event.id, event.actorType, event.actorId, event.action, event.entityType, event.entityId,
      JSON.stringify(event.payload), event.prevHash, event.eventHash, event.createdAt);
  return event;
}

function accountRow(db, accountId) {
  return db.prepare(`
    SELECT a.id AS account_id, a.professional_id, a.email, a.role AS legacy_role, a.active,
           a.created_at, a.updated_at, p.name,
           cm.clinic_id, cm.role AS membership_role
    FROM auth_accounts a
    JOIN professionals p ON p.id = a.professional_id
    LEFT JOIN clinic_memberships cm ON cm.account_id = a.id AND cm.active = 1
    WHERE a.id = ?
    ORDER BY cm.created_at LIMIT 1
  `).get(accountId);
}

function orphanCount(db, sql) {
  return Number(db.prepare(sql).get().total || 0);
}

export function createF10Service(db, {
  dbFile = null,
  storageRoot = path.resolve('data/clinical-assets'),
  backupRoot = path.resolve('data/backups')
} = {}) {
  const base = createF9Service(db);
  const roots = Object.freeze({
    dbFile: dbFile && dbFile !== ':memory:' ? path.resolve(dbFile) : null,
    storageRoot: path.resolve(storageRoot),
    backupRoot: path.resolve(backupRoot)
  });

  const service = {
    ...base,

    getStatus() {
      return { ...base.getStatus(), phase: 'F10' };
    },

    getClinic() {
      return mapClinic(db.prepare("SELECT * FROM clinics WHERE id = 'default-clinic'").get());
    },

    updateClinic(patch = {}, actorId = SEED_IDS.professional) {
      const before = service.getClinic();
      if (!before) throw new Error('Clinic not found');
      const nextName = patch.name === undefined ? before.name : text(patch.name, 'Clinic name');
      let retention = before.mediaRetentionDays;
      if (Object.hasOwn(patch, 'mediaRetentionDays')) {
        if (patch.mediaRetentionDays == null || patch.mediaRetentionDays === '') retention = null;
        else {
          retention = Number(patch.mediaRetentionDays);
          if (!Number.isInteger(retention) || retention <= 0) throw new Error('Media retention days must be a positive integer');
        }
      }
      db.prepare("UPDATE clinics SET name = ?, media_retention_days = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 'default-clinic'")
        .run(nextName, retention);
      const after = service.getClinic();
      appendAudit(db, base, { action: 'clinic.updated', entityType: 'clinic', entityId: after.id, actorId, payload: { before, after } });
      return after;
    },

    listAccounts() {
      return db.prepare(`
        SELECT a.id AS account_id, a.professional_id, a.email, a.role AS legacy_role, a.active,
               a.created_at, a.updated_at, p.name,
               cm.clinic_id, cm.role AS membership_role
        FROM auth_accounts a
        JOIN professionals p ON p.id = a.professional_id
        LEFT JOIN clinic_memberships cm ON cm.account_id = a.id AND cm.active = 1
        ORDER BY p.name COLLATE NOCASE, a.id
      `).all().map(mapAccount);
    },

    createAccount(input = {}, actorId = SEED_IDS.professional) {
      const cleanName = text(input.name, 'Name');
      const cleanEmail = email(input.email);
      const cleanRole = role(input.role);
      const credentials = hashPassword(input.password);
      const professionalId = randomUUID();
      const accountId = randomUUID();
      const membershipId = randomUUID();
      const legacyRole = cleanRole === 'admin' ? 'admin' : 'professional';
      db.exec('BEGIN IMMEDIATE;');
      try {
        db.prepare('INSERT INTO professionals(id, name, email) VALUES (?, ?, ?)')
          .run(professionalId, cleanName, cleanEmail);
        db.prepare(`INSERT INTO auth_accounts(
          id, professional_id, email, password_salt, password_hash, password_algorithm, role
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .run(accountId, professionalId, cleanEmail, credentials.salt, credentials.hash, credentials.algorithm, legacyRole);
        db.prepare(`INSERT INTO clinic_memberships(id, clinic_id, account_id, role, active)
          VALUES (?, 'default-clinic', ?, ?, 1)`)
          .run(membershipId, accountId, cleanRole);
        appendAudit(db, base, {
          action: 'account.created', entityType: 'auth_account', entityId: accountId, actorId,
          payload: { professionalId, email: cleanEmail, role: cleanRole }
        });
        db.exec('COMMIT;');
      } catch (error) {
        db.exec('ROLLBACK;');
        throw error;
      }
      return mapAccount(accountRow(db, accountId));
    },

    updateAccount(accountId, patch = {}, actorId = SEED_IDS.professional) {
      const before = mapAccount(accountRow(db, accountId));
      if (!before) throw new Error('Account not found');
      const nextRole = patch.role === undefined ? before.role : role(patch.role);
      const nextActive = patch.active === undefined ? before.active : Boolean(patch.active);
      db.exec('BEGIN IMMEDIATE;');
      try {
        db.prepare('UPDATE auth_accounts SET active = ?, role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(nextActive ? 1 : 0, nextRole === 'admin' ? 'admin' : 'professional', accountId);
        db.prepare(`UPDATE clinic_memberships SET role = ?, active = ?, updated_at = CURRENT_TIMESTAMP
          WHERE account_id = ? AND clinic_id = 'default-clinic'`)
          .run(nextRole, nextActive ? 1 : 0, accountId);
        if (!nextActive) {
          db.prepare('UPDATE auth_sessions SET revoked_at = ? WHERE account_id = ? AND revoked_at IS NULL')
            .run(new Date().toISOString(), accountId);
        }
        const after = mapAccount(accountRow(db, accountId)) || { ...before, role: nextRole, active: nextActive };
        appendAudit(db, base, { action: 'account.updated', entityType: 'auth_account', entityId: accountId, actorId, payload: { before, after } });
        db.exec('COMMIT;');
        return after;
      } catch (error) {
        db.exec('ROLLBACK;');
        throw error;
      }
    },

    revokeAccountSessions(accountId, actorId = SEED_IDS.professional) {
      if (!db.prepare('SELECT id FROM auth_accounts WHERE id = ?').get(accountId)) throw new Error('Account not found');
      const now = new Date().toISOString();
      const result = db.prepare('UPDATE auth_sessions SET revoked_at = ? WHERE account_id = ? AND revoked_at IS NULL')
        .run(now, accountId);
      const revokedCount = Number(result.changes || 0);
      appendAudit(db, base, {
        action: 'account.sessions_revoked', entityType: 'auth_account', entityId: accountId, actorId,
        payload: { revokedCount }
      });
      return { accountId, revokedCount, revokedAt: now };
    },

    listAuthSessions() {
      return db.prepare(`
        SELECT s.id, s.account_id, s.created_at, s.expires_at, s.last_seen_at, s.revoked_at,
               a.email, p.name
        FROM auth_sessions s
        JOIN auth_accounts a ON a.id = s.account_id
        JOIN professionals p ON p.id = a.professional_id
        ORDER BY s.created_at DESC, s.id
      `).all().map(mapSession);
    },

    verifyOperationalIntegrity() {
      const sqliteRows = db.prepare('PRAGMA integrity_check').all();
      const sqliteMessages = sqliteRows.map((row) => String(Object.values(row)[0]));
      const sqlite = sqliteMessages.length === 1 && sqliteMessages[0].toLowerCase() === 'ok' ? 'ok' : sqliteMessages.join('; ');
      const audit = base.getAudit();
      const orphans = {
        appointmentsPatients: orphanCount(db, 'SELECT COUNT(*) AS total FROM appointments a LEFT JOIN patients p ON p.id = a.patient_id WHERE p.id IS NULL'),
        packageUsagePackages: orphanCount(db, 'SELECT COUNT(*) AS total FROM package_usages u LEFT JOIN treatment_packages p ON p.id = u.package_id WHERE p.id IS NULL'),
        packageUsageSessions: orphanCount(db, 'SELECT COUNT(*) AS total FROM package_usages u LEFT JOIN treatment_sessions s ON s.id = u.treatment_session_id WHERE s.id IS NULL'),
        paymentPatients: orphanCount(db, 'SELECT COUNT(*) AS total FROM payments pay LEFT JOIN patients p ON p.id = pay.patient_id WHERE p.id IS NULL'),
        paymentPackages: orphanCount(db, 'SELECT COUNT(*) AS total FROM payments pay LEFT JOIN treatment_packages p ON p.id = pay.package_id WHERE pay.package_id IS NOT NULL AND p.id IS NULL')
      };
      const orphanTotal = Object.values(orphans).reduce((sum, value) => sum + value, 0);
      return { valid: sqlite === 'ok' && audit.valid && orphanTotal === 0, sqlite, audit, orphans };
    },

    createAdminBackup(actorId = SEED_IDS.professional) {
      const backup = createBackup({ db, assetRoot: roots.storageRoot, destinationRoot: roots.backupRoot });
      const verification = verifyBackup(backup.backupPath);
      if (!verification.valid) {
        fs.rmSync(backup.backupPath, { recursive: true, force: true });
        throw new Error(`Backup verification failed: ${verification.errors.join('; ')}`);
      }
      appendAudit(db, base, {
        action: 'backup.created', entityType: 'backup', entityId: path.basename(backup.backupPath), actorId,
        payload: { backupPath: backup.backupPath, fileCount: backup.manifest.files.length }
      });
      return { ...backup, verification };
    },

    previewRestore({ backupPath, destinationPath } = {}) {
      const verification = verifyBackup(backupPath);
      if (!verification.valid) throw new Error(`Backup inválido para restauração: ${verification.errors.join('; ')}`);
      const sourceSnapshot = path.join(path.resolve(backupPath), 'clinical.sqlite');
      if (!fs.existsSync(sourceSnapshot)) throw new Error('Backup snapshot is missing');
      const destination = path.resolve(text(destinationPath, 'Restore destination path'));
      if (roots.dbFile && destination === roots.dbFile) {
        throw new Error('Restore preview cannot target the currently open database');
      }
      return { valid: true, sourceSnapshot, destinationPath: destination, manifest: verification.manifest };
    },

    listMediaRetentionCandidates(now = new Date().toISOString()) {
      const clinic = service.getClinic();
      if (!clinic?.mediaRetentionDays) return [];
      const reference = new Date(now);
      if (Number.isNaN(reference.getTime())) throw new Error('Invalid retention reference date');
      const threshold = new Date(reference.getTime() - clinic.mediaRetentionDays * 86400000).toISOString();
      return db.prepare(`
        SELECT id, patient_id, encounter_id, treatment_session_id, media_type, storage_path,
               caption, captured_at, created_at
        FROM clinical_media
        WHERE COALESCE(captured_at, created_at) <= ?
        ORDER BY COALESCE(captured_at, created_at), id
      `).all(threshold).map((row) => ({
        id: row.id,
        patientId: row.patient_id,
        encounterId: row.encounter_id,
        treatmentSessionId: row.treatment_session_id,
        mediaType: row.media_type,
        storagePath: row.storage_path,
        caption: row.caption,
        capturedAt: row.captured_at,
        createdAt: row.created_at,
        retentionReviewOnly: true
      }));
    },

    listAuditEvents(filters = {}) {
      const events = base.getAudit().events;
      return events.filter((event) => {
        if (filters.actorId && event.actorId !== filters.actorId) return false;
        if (filters.action && !String(event.action || '').includes(filters.action)) return false;
        if (filters.entityType && event.entityType !== filters.entityType) return false;
        if (filters.from && String(event.createdAt) < String(filters.from)) return false;
        if (filters.to && String(event.createdAt) > String(filters.to)) return false;
        return true;
      });
    }
  };

  return service;
}
