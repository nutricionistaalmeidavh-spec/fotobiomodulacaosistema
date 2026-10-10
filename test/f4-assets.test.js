import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase } from '../src/db/database.js';
import { createF4Service } from '../src/app/f4-service.js';
import { createAppServer } from '../src/app/server.js';

const PNG_1X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=';

function cookieFrom(response) {
  return (response.headers.get('set-cookie') || '').split(';')[0];
}

function tempRoots(prefix = 'pbm-f4-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return {
    root,
    storageRoot: path.join(root, 'clinical-assets'),
    backupRoot: path.join(root, 'backups')
  };
}

test('F4 service appends consent acceptance and revocation without mutating history', () => {
  const roots = tempRoots('pbm-f4-consent-');
  const db = openDatabase(':memory:');
  try {
    const service = createF4Service(db, roots);
    service.ensureSeedData();
    const patient = service.createPatient({ fullName: 'Paciente Consentimento F4' });

    const accepted = service.acceptConsent({
      patientId: patient.id,
      consentType: 'pbm-treatment',
      version: '1.0',
      evidence: { method: 'local-checkbox' }
    });
    const revoked = service.revokeConsent(accepted.id, 'pedido do paciente');
    const history = service.listConsents(patient.id);

    assert.equal(service.getStatus().phase, 'F4');
    assert.equal(history.length, 2);
    assert.equal(history[0].status, 'accepted');
    assert.equal(history[1].status, 'revoked');
    assert.equal(history[1].evidence.relatedConsentId, accepted.id);
    assert.equal(history[1].evidence.reason, 'pedido do paciente');
    assert.equal(revoked.patientId, patient.id);
    assert.throws(() => db.prepare('DELETE FROM consents WHERE id = ?').run(accepted.id), /immutable/i);
  } finally {
    db.close();
    fs.rmSync(roots.root, { recursive: true, force: true });
  }
});

test('F4 stores allowed clinical images locally with integrity metadata', () => {
  const roots = tempRoots('pbm-f4-media-');
  const db = openDatabase(':memory:');
  try {
    const service = createF4Service(db, roots);
    service.ensureSeedData();
    const patient = service.createPatient({ fullName: 'Paciente Mídia F4' });

    const media = service.storeClinicalImage({
      patientId: patient.id,
      originalFilename: 'antes.png',
      mimeType: 'image/png',
      dataBase64: PNG_1X1,
      caption: 'Antes da aplicação'
    });

    assert.equal(media.patientId, patient.id);
    assert.equal(media.mimeType, 'image/png');
    assert.equal(media.originalFilename, 'antes.png');
    assert.ok(media.byteSize > 0);
    assert.match(media.sha256, /^[a-f0-9]{64}$/);
    assert.equal(fs.existsSync(media.storagePath), true);
    assert.equal(service.listClinicalMedia(patient.id).length, 1);
  } finally {
    db.close();
    fs.rmSync(roots.root, { recursive: true, force: true });
  }
});

test('F4 rejects invalid MIME, invalid base64 and decoded images larger than 5 MiB', () => {
  const roots = tempRoots('pbm-f4-media-invalid-');
  const db = openDatabase(':memory:');
  try {
    const service = createF4Service(db, roots);
    service.ensureSeedData();
    const patient = service.createPatient({ fullName: 'Paciente Validação F4' });

    assert.throws(() => service.storeClinicalImage({
      patientId: patient.id,
      originalFilename: 'arquivo.gif',
      mimeType: 'image/gif',
      dataBase64: PNG_1X1
    }), /mime/i);

    assert.throws(() => service.storeClinicalImage({
      patientId: patient.id,
      originalFilename: 'quebrado.png',
      mimeType: 'image/png',
      dataBase64: 'not-base64!!'
    }), /base64/i);

    const tooLarge = Buffer.alloc(5 * 1024 * 1024 + 1, 1).toString('base64');
    assert.throws(() => service.storeClinicalImage({
      patientId: patient.id,
      originalFilename: 'grande.png',
      mimeType: 'image/png',
      dataBase64: tooLarge
    }), /5 MiB/i);
  } finally {
    db.close();
    fs.rmSync(roots.root, { recursive: true, force: true });
  }
});

test('F4 records a basic clinical evolution in the existing outcome timeline', () => {
  const roots = tempRoots('pbm-f4-outcome-');
  const db = openDatabase(':memory:');
  try {
    const service = createF4Service(db, roots);
    service.ensureSeedData();
    const patient = service.createPatient({ fullName: 'Paciente Evolução F4' });
    const outcome = service.recordBasicOutcome({
      patientId: patient.id,
      metricType: 'clinical_note',
      narrative: 'Paciente relata melhora após a sessão.'
    });

    assert.equal(outcome.patientId, patient.id);
    assert.equal(outcome.metricType, 'clinical_note');
    assert.equal(outcome.narrative, 'Paciente relata melhora após a sessão.');
    const workspace = service.getPatientWorkspace(patient.id);
    assert.ok(workspace.basicOutcomes.some((item) => item.id === outcome.id));
  } finally {
    db.close();
    fs.rmSync(roots.root, { recursive: true, force: true });
  }
});

test('F4 HTTP remains available under later composition for consent, media and basic evolution', async () => {
  const roots = tempRoots('pbm-f4-http-');
  const app = await createAppServer({
    dbFile: path.join(roots.root, 'app.sqlite'),
    storageRoot: roots.storageRoot,
    backupRoot: roots.backupRoot,
    port: 0
  });
  try {
    const setup = await fetch(`${app.url}/api/auth/setup`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Profissional F4', email: 'f4-http@example.test', password: 'senha-http-f4' })
    });
    assert.equal(setup.status, 201);
    const cookie = cookieFrom(setup);
    const headers = { 'content-type': 'application/json', cookie };
    const status = await fetch(`${app.url}/api/status`, { headers: { cookie } }).then((response) => response.json());
    assert.ok(['F8', 'F9', 'F10'].includes(status.phase));

    const patient = await fetch(`${app.url}/api/patients`, {
      method: 'POST', headers, body: JSON.stringify({ fullName: 'Paciente HTTP F4' })
    }).then((response) => response.json());
    const patientId = patient.patient.id;

    const consent = await fetch(`${app.url}/api/patients/${patientId}/consents`, {
      method: 'POST', headers,
      body: JSON.stringify({ consentType: 'pbm-treatment', version: '1.0', evidence: { method: 'checkbox' } })
    }).then(async (response) => ({ status: response.status, body: await response.json() }));
    assert.equal(consent.status, 201);

    const media = await fetch(`${app.url}/api/patients/${patientId}/media`, {
      method: 'POST', headers,
      body: JSON.stringify({ originalFilename: 'http.png', mimeType: 'image/png', dataBase64: PNG_1X1, caption: 'HTTP F4' })
    }).then(async (response) => ({ status: response.status, body: await response.json() }));
    assert.equal(media.status, 201);
    assert.equal(media.body.media.mimeType, 'image/png');

    const outcome = await fetch(`${app.url}/api/patients/${patientId}/basic-outcomes`, {
      method: 'POST', headers,
      body: JSON.stringify({ metricType: 'clinical_note', narrative: 'Evolução HTTP F4' })
    }).then(async (response) => ({ status: response.status, body: await response.json() }));
    assert.equal(outcome.status, 201);
    assert.equal(outcome.body.outcome.narrative, 'Evolução HTTP F4');
  } finally {
    await app.close();
    fs.rmSync(roots.root, { recursive: true, force: true });
  }
});
