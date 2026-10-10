import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase } from '../src/db/database.js';
import { createAuthService } from '../src/app/auth-service.js';
import { createF10Service } from '../src/app/f10-service.js';
import { hasPermission, permissionsForRole } from '../src/core/rbac.js';

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pbm-f10-'));
  const dbFile = path.join(root, 'app.sqlite');
  const db = openDatabase(dbFile);
  const auth = createAuthService(db);
  const service = createF10Service(db, { dbFile, storageRoot: path.join(root, 'assets'), backupRoot: path.join(root, 'backups') });
  service.ensureSeedData();
  const admin = auth.setup({ name: 'Administrador F10', email: 'admin-f10@example.test', password: 'senha-admin-f10' });
  return { root, dbFile, db, auth, service, admin };
}

test('F10 role matrix separates clinical, finance and administration permissions', () => {
  assert.equal(hasPermission('admin', 'accounts.manage'), true);
  assert.equal(hasPermission('admin', 'backup.manage'), true);
  assert.equal(hasPermission('professional', 'clinical.write'), true);
  assert.equal(hasPermission('professional', 'finance.write'), false);
  assert.equal(hasPermission('professional', 'accounts.manage'), false);
  assert.equal(hasPermission('reception', 'patients.write'), true);
  assert.equal(hasPermission('reception', 'agenda.write'), true);
  assert.equal(hasPermission('reception', 'finance.write'), true);
  assert.equal(hasPermission('reception', 'clinical.read'), false);
  assert.deepEqual([...permissionsForRole('unknown')], []);
});

test('F10 creates clinic memberships without exposing password hashes and resolves effective auth role', () => {
  const { root, db, auth, service, admin } = setup();
  try {
    assert.equal(service.getStatus().phase, 'F10');
    assert.equal(admin.user.role, 'admin');
    assert.ok(admin.user.clinicId);

    const receptionist = service.createAccount({
      name: 'Recepção F10', email: 'recepcao-f10@example.test', password: 'senha-recepcao-f10', role: 'reception'
    }, admin.user.professionalId);
    assert.equal(receptionist.role, 'reception');
    assert.equal(Object.hasOwn(receptionist, 'passwordHash'), false);
    assert.equal(Object.hasOwn(receptionist, 'passwordSalt'), false);

    const login = auth.login({ email: 'recepcao-f10@example.test', password: 'senha-recepcao-f10' });
    assert.equal(login.user.role, 'reception');
    assert.equal(login.user.clinicId, admin.user.clinicId);
  } finally {
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('F10 disables accounts and revokes all active sessions immediately', () => {
  const { root, db, auth, service, admin } = setup();
  try {
    const professional = service.createAccount({
      name: 'Profissional F10', email: 'prof-f10@example.test', password: 'senha-prof-f10', role: 'professional'
    }, admin.user.professionalId);
    const first = auth.login({ email: professional.email, password: 'senha-prof-f10' });
    const second = auth.login({ email: professional.email, password: 'senha-prof-f10' });
    assert.ok(auth.authenticate(first.token));
    assert.ok(auth.authenticate(second.token));

    const revoked = service.revokeAccountSessions(professional.accountId, admin.user.professionalId);
    assert.equal(revoked.revokedCount >= 2, true);
    assert.equal(auth.authenticate(first.token), null);
    assert.equal(auth.authenticate(second.token), null);

    service.updateAccount(professional.accountId, { active: false }, admin.user.professionalId);
    assert.throws(() => auth.login({ email: professional.email, password: 'senha-prof-f10' }), /credenciais/i);
  } finally {
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('F10 verifies operational integrity and only previews verified restore targets', () => {
  const { root, db, service, admin } = setup();
  try {
    const integrity = service.verifyOperationalIntegrity();
    assert.equal(integrity.valid, true);
    assert.equal(integrity.sqlite, 'ok');
    assert.equal(integrity.audit.valid, true);

    const backup = service.createAdminBackup(admin.user.professionalId);
    const preview = service.previewRestore({ backupPath: backup.backupPath, destinationPath: path.join(root, 'restore', 'clinical.sqlite') });
    assert.equal(preview.valid, true);
    assert.match(preview.sourceSnapshot, /clinical\.sqlite$/);
    assert.match(preview.destinationPath, /restore[\\/]clinical\.sqlite$/);
    assert.equal(fs.existsSync(preview.destinationPath), false);

    fs.appendFileSync(path.join(backup.backupPath, 'clinical.sqlite'), 'tamper');
    assert.throws(() => service.previewRestore({ backupPath: backup.backupPath, destinationPath: path.join(root, 'restore2.sqlite') }), /inválido|invalid|integridade/i);
  } finally {
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('F10 media retention returns review candidates and never deletes automatically', () => {
  const { root, db, service, admin } = setup();
  try {
    service.updateClinic({ mediaRetentionDays: 30 }, admin.user.professionalId);
    const patient = service.createPatient({ fullName: 'Paciente Retenção F10' }, admin.user.professionalId);
    db.prepare(`INSERT INTO clinical_media(id, patient_id, media_type, storage_path, created_at) VALUES ('old-media', ?, 'image', '/tmp/old.png', '2025-01-01T00:00:00.000Z')`).run(patient.id);
    const candidates = service.listMediaRetentionCandidates('2026-09-24T00:00:00.000Z');
    assert.equal(candidates.some((item) => item.id === 'old-media'), true);
    assert.equal(db.prepare("SELECT COUNT(*) AS total FROM clinical_media WHERE id = 'old-media'").get().total, 1);
  } finally {
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
