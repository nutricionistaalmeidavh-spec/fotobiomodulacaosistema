import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/db/database.js';
import { createF7Service } from '../src/app/f7-service.js';

test('F7 records a confirmed anatomical body-map point on a real PBM session', () => {
  const db = openDatabase();
  const service = createF7Service(db);
  service.ensureSeedData();

  const patient = service.createPatient({ fullName: 'Paciente body map F7' });
  const encounter = service.startEncounter(patient.id, {
    assessment: { chiefComplaint: 'Dor cervical' }
  });
  const protocol = service.createProtocol({
    title: 'Protocolo F7',
    changeSummary: 'Versão inicial',
    parameters: { wavelengthNm: 808, powerMw: 100, timeSeconds: 40, areaCm2: 0.5 }
  });
  const version = service.listProtocolVersions(protocol.id)[0];
  const session = service.createTreatmentSession({
    encounterId: encounter.id,
    protocolVersionId: version.id,
    plannedEnergyJ: 4,
    appliedEnergyJ: 4
  });

  const point = service.recordBodyMapPoint(session.id, {
    sequenceNumber: 1,
    regionId: 'cervical',
    view: 'posterior',
    laterality: 'midline',
    x: 0.5,
    y: 0.18,
    anatomicalLabel: 'C4-C5'
  });

  assert.equal(service.getStatus().phase, 'F7');
  assert.equal(point.bodyRegion, 'Cervical');
  assert.equal(point.anatomicalLabel, 'C4-C5');
  assert.deepEqual(point.coordinates, {
    schemaVersion: 1,
    regionId: 'cervical',
    view: 'posterior',
    laterality: 'midline',
    x: 0.5,
    y: 0.18
  });

  const stored = service.listBodyMapPoints(patient.id);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].treatmentSessionId, session.id);
  assert.equal(stored[0].coordinates.regionId, 'cervical');

  const workspace = service.getPatientWorkspace(patient.id);
  assert.equal(workspace.bodyMapPoints.length, 1);
  assert.ok(workspace.timeline.some((item) => item.type === 'application_point' && item.coordinates?.regionId === 'cervical'));
});

test('F7 keeps body-map registration free of automatic dose selection', () => {
  const db = openDatabase();
  const service = createF7Service(db);
  service.ensureSeedData();
  const catalog = service.getBodyMapCatalog();

  assert.ok(catalog.some((item) => item.id === 'cervical'));
  assert.ok(catalog.every((item) => !('dose' in item) && !('energyJ' in item) && !('recommendedDose' in item)));
});
