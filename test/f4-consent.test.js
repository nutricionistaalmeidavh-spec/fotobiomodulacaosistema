import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/db/database.js';

function seedPatient(db) {
  db.prepare("INSERT INTO professionals(id,name) VALUES('pro-f4','Profissional F4')").run();
  db.prepare("INSERT INTO patients(id,full_name) VALUES('pat-f4','Paciente F4')").run();
}

test('F4 consent history is append-only and preserves accepted then revoked records', () => {
  const db = openDatabase(':memory:');
  seedPatient(db);
  db.prepare(`
    INSERT INTO consents(id, patient_id, professional_id, consent_type, version, status, evidence_json, accepted_at)
    VALUES('consent-accepted','pat-f4','pro-f4','pbm-treatment','1.0','accepted','{}','2026-09-22T20:00:00.000Z')
  `).run();
  db.prepare(`
    INSERT INTO consents(id, patient_id, professional_id, consent_type, version, status, evidence_json, revoked_at)
    VALUES('consent-revoked','pat-f4','pro-f4','pbm-treatment','1.0','revoked','{"reason":"pedido do paciente"}','2026-09-22T21:00:00.000Z')
  `).run();

  const history = db.prepare('SELECT * FROM consents WHERE patient_id = ? ORDER BY created_at, rowid').all('pat-f4');
  assert.equal(history.length, 2);
  assert.equal(history[0].status, 'accepted');
  assert.equal(history[1].status, 'revoked');
  assert.throws(() => db.prepare("UPDATE consents SET status='revoked' WHERE id='consent-accepted'").run(), /immutable/i);
  assert.throws(() => db.prepare("DELETE FROM consents WHERE id='consent-accepted'").run(), /immutable/i);
  db.close();
});

test('F4 schema adds clinical asset metadata needed for local files and documents', () => {
  const db = openDatabase(':memory:');
  const media = db.prepare("PRAGMA table_info('clinical_media')").all().map((row) => row.name);
  const documents = db.prepare("PRAGMA table_info('documents')").all().map((row) => row.name);
  assert.ok(media.includes('original_filename'));
  assert.ok(media.includes('mime_type'));
  assert.ok(media.includes('byte_size'));
  assert.ok(documents.includes('sha256'));
  db.close();
});
