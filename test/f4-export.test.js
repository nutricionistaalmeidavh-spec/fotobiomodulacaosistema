import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase } from '../src/db/database.js';
import { generateEncounterPdf } from '../src/core/pdf.js';
import { createBackup, verifyBackup } from '../src/core/backup.js';
import { createF4Service } from '../src/app/f4-service.js';
import { SEED_IDS } from '../src/app/seed.js';

function tempRoots(prefix = 'pbm-f4-export-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return {
    root,
    storageRoot: path.join(root, 'clinical-assets'),
    backupRoot: path.join(root, 'backups')
  };
}

test('F4 generates a valid dependency-free encounter PDF buffer', () => {
  const pdf = generateEncounterPdf({
    patient: { fullName: 'Paciente PDF' },
    encounter: { id: 'enc-1', startedAt: '2026-09-23T10:00:00.000Z', notes: 'Registro clínico' },
    assessment: { chiefComplaint: 'Dor cervical', painScore: 7 },
    sessions: [{ protocolTitle: 'Analgesia cervical', protocolVersionNumber: 2, plannedParameters: { energyJ: 4 }, appliedParameters: { energyJ: 4 } }],
    applicationPoints: [{ sequenceNumber: 1, bodyRegion: 'cervical', parameters: { energyJ: 4 } }],
    outcomes: [{ metricType: 'clinical_note', narrative: 'Melhora relatada' }]
  });
  assert.ok(Buffer.isBuffer(pdf));
  assert.match(pdf.subarray(0, 8).toString('latin1'), /^%PDF-/);
  assert.match(pdf.toString('latin1'), /Paciente PDF/);
  assert.match(pdf.toString('latin1'), /%%EOF\s*$/);
});

test('F4 finalizes encounter PDF as a hashed immutable document row', () => {
  const roots = tempRoots('pbm-f4-pdf-service-');
  const db = openDatabase(':memory:');
  try {
    const service = createF4Service(db, roots);
    service.ensureSeedData();
    const document = service.finalizeEncounterPdf(SEED_IDS.encounter);
    assert.equal(document.status, 'finalized');
    assert.equal(document.documentType, 'encounter_pdf');
    assert.match(document.sha256, /^[a-f0-9]{64}$/);
    assert.equal(fs.existsSync(document.storagePath), true);
    assert.match(fs.readFileSync(document.storagePath, 'latin1'), /^%PDF-/);
    assert.throws(() => db.prepare("UPDATE documents SET title = 'alterado' WHERE id = ?").run(document.id), /immutable/i);
  } finally {
    db.close();
    fs.rmSync(roots.root, { recursive: true, force: true });
  }
});

test('F4 creates a consistent SQLite backup with manifest and detects tampering', () => {
  const roots = tempRoots('pbm-f4-backup-');
  fs.mkdirSync(roots.storageRoot, { recursive: true });
  fs.writeFileSync(path.join(roots.storageRoot, 'nota.txt'), 'asset clínico');
  const db = openDatabase(':memory:');
  try {
    db.prepare("INSERT INTO professionals(id,name) VALUES('backup-prof','Backup Prof')").run();
    const backup = createBackup({ db, assetRoot: roots.storageRoot, destinationRoot: roots.backupRoot });
    assert.equal(fs.existsSync(path.join(backup.backupPath, 'clinical.sqlite')), true);
    assert.equal(fs.existsSync(path.join(backup.backupPath, 'manifest.json')), true);
    assert.ok(backup.manifest.files.some((item) => item.path === 'clinical.sqlite'));
    assert.ok(backup.manifest.files.some((item) => item.path === 'clinical-assets/nota.txt'));
    assert.equal(verifyBackup(backup.backupPath).valid, true);

    fs.appendFileSync(path.join(backup.backupPath, 'clinical-assets', 'nota.txt'), ' adulterado');
    const verification = verifyBackup(backup.backupPath);
    assert.equal(verification.valid, false);
    assert.ok(verification.errors.some((item) => item.includes('clinical-assets/nota.txt')));
  } finally {
    db.close();
    fs.rmSync(roots.root, { recursive: true, force: true });
  }
});

test('F4 service creates audited local backup', () => {
  const roots = tempRoots('pbm-f4-backup-service-');
  const db = openDatabase(':memory:');
  try {
    const service = createF4Service(db, roots);
    service.ensureSeedData();
    const result = service.createLocalBackup();
    assert.equal(result.verification.valid, true);
    assert.match(result.manifest.createdAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.ok(service.getAudit().events.some((event) => event.action === 'backup.created'));
  } finally {
    db.close();
    fs.rmSync(roots.root, { recursive: true, force: true });
  }
});
