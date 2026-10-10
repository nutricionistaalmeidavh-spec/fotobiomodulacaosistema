import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase } from '../src/db/database.js';
import { createF10Service } from '../src/app/f10-service.js';
import { createAppServer } from '../src/app/server.js';
import { visiblePrimaryNavigation } from '../src/app/public/ui/navigation.js';
import { SEED_IDS } from '../src/app/seed.js';

test('release navigation includes finance for admin and reception, not clinical-only roles', () => {
  assert.ok(visiblePrimaryNavigation('admin').some((item) => item.id === 'finance'));
  assert.ok(visiblePrimaryNavigation('reception').some((item) => item.id === 'finance'));
  assert.equal(visiblePrimaryNavigation('professional').some((item) => item.id === 'finance'), false);
});

test('C09 reviews are durable, attributed, and preserve their audit history', () => {
  const db = openDatabase();
  try {
    const service = createF10Service(db);
    service.ensureSeedData();
    const saved = service.saveSafetyChecklist(SEED_IDS.patient, {
      identityConfirmed: true, objectiveReviewed: true, precautionsReviewed: true,
      siteReviewed: true, equipmentReviewed: true, professionalConfirmed: true
    }, SEED_IDS.professional);
    assert.equal(saved.identityConfirmed, true);
    assert.equal(saved.actorId, SEED_IDS.professional);
    assert.equal(service.getSafetyChecklist(SEED_IDS.patient).id, saved.id);
    assert.equal(service.getAudit().valid, true);
    const revised = service.saveSafetyChecklist(SEED_IDS.patient, {
      ...saved, equipmentReviewed: false
    }, SEED_IDS.professional);
    assert.notEqual(saved.id, revised.id);
    assert.equal(service.getSafetyChecklist(SEED_IDS.patient).equipmentReviewed, false);
    assert.equal(service.getAudit().valid, true);
  } finally {
    db.close();
  }
});

test('fresh production installation does not populate clinical demo patients', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pbm-release-'));
  const app = await createAppServer({ dbFile: path.join(dir, 'clinical.sqlite'), port: 0 });
  try {
    const setup = await fetch(app.url + '/api/auth/setup', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Responsável', email: 'release@example.test', password: 'long-test-password' })
    });
    assert.equal(setup.status, 201);
    const cookie = (setup.headers.get('set-cookie') || '').split(';')[0];
    const response = await fetch(app.url + '/api/patients', { headers: { cookie } });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).patients, []);
  } finally {
    await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
