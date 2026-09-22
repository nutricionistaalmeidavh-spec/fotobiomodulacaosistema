import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/db/database.js';
import { createF0Service } from '../src/app/f0-service.js';

test('F0 service exposes schema status and seeded foundation records', () => {
  const db = openDatabase();
  const service = createF0Service(db);
  service.ensureSeedData();
  const status = service.getStatus();
  assert.equal(status.phase, 'F0');
  assert.equal(status.tableCount, 19);
  assert.equal(service.listPatients().length, 1);
  assert.equal(service.listEquipment().length, 1);
});

test('creating a protocol records v1 and creating a version appends v2 without mutating v1', () => {
  const db = openDatabase();
  const service = createF0Service(db);
  service.ensureSeedData();
  const protocol = service.createProtocol({ title: 'Dor cervical', changeSummary: 'Inicial' });
  const first = service.listProtocolVersions(protocol.id);
  assert.equal(first.length, 1);
  assert.equal(first[0].versionNumber, 1);
  service.createProtocolVersion(protocol.id, { changeSummary: 'Ajuste documental' });
  const versions = service.listProtocolVersions(protocol.id);
  assert.deepEqual(versions.map((item) => item.versionNumber), [1, 2]);
  assert.equal(versions[0].changeSummary, 'Inicial');
});

test('creating a session requires a reason when applied energy differs from planned energy', () => {
  const db = openDatabase();
  const service = createF0Service(db);
  service.ensureSeedData();
  const protocol = service.createProtocol({ title: 'Sessão', changeSummary: 'Inicial' });
  const [version] = service.listProtocolVersions(protocol.id);
  assert.throws(() => service.createTreatmentSession({
    protocolVersionId: version.id,
    plannedEnergyJ: 4,
    appliedEnergyJ: 5,
    professionalAdjustmentReason: ''
  }), /Professional adjustment reason is required/i);
  const session = service.createTreatmentSession({
    protocolVersionId: version.id,
    plannedEnergyJ: 4,
    appliedEnergyJ: 5,
    professionalAdjustmentReason: 'Resposta clínica observada'
  });
  assert.equal(session.appliedParameters.energyJ, 5);
  assert.equal(session.professionalAdjustmentReason, 'Resposta clínica observada');
});

test('audit chain remains valid after protocol and session actions', () => {
  const db = openDatabase();
  const service = createF0Service(db);
  service.ensureSeedData();
  const protocol = service.createProtocol({ title: 'Auditável', changeSummary: 'Inicial' });
  const [version] = service.listProtocolVersions(protocol.id);
  service.createTreatmentSession({ protocolVersionId: version.id, plannedEnergyJ: 4, appliedEnergyJ: 4 });
  const audit = service.getAudit();
  assert.equal(audit.valid, true);
  assert.match(audit.events.map((item) => item.action).join(' '), /protocol\.created/);
  assert.match(audit.events.map((item) => item.action).join(' '), /treatment_session\.created/);
});
