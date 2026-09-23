import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase } from '../src/db/database.js';
import { createF3Service } from '../src/app/f3-service.js';
import { createAppServer } from '../src/app/server.js';

function cookieFrom(response) {
  return (response.headers.get('set-cookie') || '').split(';')[0];
}

test('F3 service persists equipment/applicator and adapts protocol without mutating reference', () => {
  const db = openDatabase(':memory:');
  const service = createF3Service(db);
  service.ensureSeedData();

  const protocol = service.createProtocol({
    title: 'F3 808 nm',
    changeSummary: 'v1',
    parameters: {
      wavelengthNm: 808,
      powerMw: 100,
      timeS: 40,
      areaCm2: 0.5,
      mode: 'continuous',
      points: 1,
      technique: 'contact'
    }
  });
  const version = service.listProtocolVersions(protocol.id)[0];

  const equipment = service.createEquipment({
    manufacturer: 'ArtiSys Test',
    model: 'Laser F3',
    serialNumber: 'F3-001',
    notes: 'Equipamento E2E'
  });
  const applicator = service.createApplicator(equipment.id, {
    name: 'Ponteira 808',
    wavelengthNm: 808,
    fixedPowerMw: 200,
    spotAreaCm2: 0.5,
    modes: ['continuous'],
    frequenciesHz: []
  });

  const adapted = service.adaptProtocolVersion(version.id, applicator.id);
  assert.equal(service.getStatus().phase, 'F3');
  assert.equal(adapted.compatible, true);
  assert.equal(adapted.referenceParameters.timeS, 40);
  assert.equal(adapted.equipmentDerivedParameters.timeS, 20);
  assert.equal(service.listProtocolVersions(protocol.id)[0].parameters.timeS, 40);

  const detailed = service.listEquipmentDetailed();
  assert.equal(detailed.find((item) => item.id === equipment.id).applicators[0].id, applicator.id);
  db.close();
});

test('F3 service requires explicit power selection for variable-power applicator', () => {
  const db = openDatabase(':memory:');
  const service = createF3Service(db);
  service.ensureSeedData();
  const protocol = service.createProtocol({
    title: 'F3 variável',
    changeSummary: 'v1',
    parameters: { wavelengthNm: 808, powerMw: 100, timeS: 40, areaCm2: 1, mode: 'continuous', points: 1, technique: 'contact' }
  });
  const version = service.listProtocolVersions(protocol.id)[0];
  const equipment = service.createEquipment({ manufacturer: 'Teste', model: 'Variável' });
  const applicator = service.createApplicator(equipment.id, {
    name: 'Ponteira variável', wavelengthNm: 808, minPowerMw: 50, maxPowerMw: 200,
    spotAreaCm2: 1, modes: ['continuous'], frequenciesHz: []
  });

  const missing = service.adaptProtocolVersion(version.id, applicator.id);
  assert.ok(missing.warnings.includes('power_selection_required'));
  const selected = service.adaptProtocolVersion(version.id, applicator.id, 150);
  assert.equal(selected.compatible, true);
  assert.equal(selected.equipmentDerivedParameters.powerMw, 150);
  db.close();
});

test('F3 HTTP remains available under F4 server and returns adaptation preview', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pbm-f3-http-'));
  const app = await createAppServer({ dbFile: path.join(dir, 'app.sqlite'), port: 0 });
  try {
    const setup = await fetch(`${app.url}/api/auth/setup`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Profissional F3', email: 'f3-http@example.test', password: 'senha-http-f3' })
    });
    assert.equal(setup.status, 201);
    const cookie = cookieFrom(setup);
    const headers = { 'content-type': 'application/json', cookie };

    const status = await fetch(`${app.url}/api/status`, { headers: { cookie } }).then((response) => response.json());
    assert.equal(status.phase, 'F4');

    const protocolResponse = await fetch(`${app.url}/api/protocols`, {
      method: 'POST', headers,
      body: JSON.stringify({
        title: 'HTTP F3', changeSummary: 'v1',
        parameters: { wavelengthNm: 808, powerMw: 100, timeS: 40, areaCm2: 0.5, mode: 'continuous', points: 1, technique: 'contact' }
      })
    }).then((response) => response.json());
    const versionId = protocolResponse.protocol.versions[0].id;

    const equipmentResponse = await fetch(`${app.url}/api/equipment`, {
      method: 'POST', headers,
      body: JSON.stringify({ manufacturer: 'HTTP', model: 'Laser F3' })
    }).then(async (response) => ({ status: response.status, body: await response.json() }));
    assert.equal(equipmentResponse.status, 201);

    const equipmentId = equipmentResponse.body.equipment.id;
    const applicatorResponse = await fetch(`${app.url}/api/equipment/${equipmentId}/applicators`, {
      method: 'POST', headers,
      body: JSON.stringify({ name: '808 HTTP', wavelengthNm: 808, fixedPowerMw: 200, spotAreaCm2: 0.5, modes: ['continuous'] })
    }).then(async (response) => ({ status: response.status, body: await response.json() }));
    assert.equal(applicatorResponse.status, 201);

    const preview = await fetch(`${app.url}/api/protocol-versions/${versionId}/adapt`, {
      method: 'POST', headers,
      body: JSON.stringify({ applicatorId: applicatorResponse.body.applicator.id })
    }).then(async (response) => ({ status: response.status, body: await response.json() }));
    assert.equal(preview.status, 200);
    assert.equal(preview.body.adaptation.referenceParameters.timeS, 40);
    assert.equal(preview.body.adaptation.equipmentDerivedParameters.timeS, 20);
  } finally {
    await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});