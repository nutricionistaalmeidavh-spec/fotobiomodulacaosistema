import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/db/database.js';
import { createF0Service } from '../src/app/f0-service.js';

test('clinical service exposes F1 schema status and seeded foundation records', () => {
  const db = openDatabase();
  const service = createF0Service(db);
  service.ensureSeedData();
  const status = service.getStatus();
  assert.equal(status.phase, 'F1');
  assert.ok(status.tableCount >= 21);
  assert.ok(status.tables.includes('patients'));
  assert.ok(status.tables.includes('protocol_versions'));
  assert.ok(status.tables.includes('audit_events'));
  assert.equal(service.listPatients().length, 1);
  assert.equal(service.listEquipment().length, 1);
});

test('F1 patient workflow creates, updates and archives without destructive deletion', () => {
  const db = openDatabase();
  const service = createF0Service(db);
  service.ensureSeedData();
  assert.equal(typeof service.createPatient, 'function');
  assert.equal(typeof service.updatePatient, 'function');
  assert.equal(typeof service.archivePatient, 'function');

  const patient = service.createPatient({
    fullName: 'Paciente F1', birthDate: '1990-05-10', email: 'paciente@example.test',
    phone: '16999990000', emergencyContact: 'Contato F1', notes: 'Cadastro inicial'
  });
  assert.equal(patient.fullName, 'Paciente F1');

  const updated = service.updatePatient(patient.id, { phone: '16888880000', notes: 'Atualizado' });
  assert.equal(updated.phone, '16888880000');
  assert.equal(updated.notes, 'Atualizado');

  const archived = service.archivePatient(patient.id);
  assert.equal(archived.active, false);
  assert.ok(archived.archivedAt);
  assert.equal(service.listPatients().some((item) => item.id === patient.id), false);
  assert.equal(service.listPatients({ includeArchived: true }).some((item) => item.id === patient.id), true);
});

test('F1 encounter records anamnesis and exposes longitudinal patient workspace', () => {
  const db = openDatabase();
  const service = createF0Service(db);
  service.ensureSeedData();
  const patient = service.createPatient({ fullName: 'Paciente Atendimento' });
  const encounter = service.startEncounter(patient.id, {
    notes: 'Primeiro atendimento',
    assessment: {
      chiefComplaint: 'Dor cervical', history: 'Dor há 2 semanas', medications: 'Nenhuma',
      allergies: 'Negadas', precautions: 'Sem sinais de alerta', painScore: 7
    }
  });
  assert.equal(encounter.status, 'open');
  let workspace = service.getPatientWorkspace(patient.id);
  assert.equal(workspace.patient.fullName, 'Paciente Atendimento');
  assert.equal(workspace.assessments[0].chiefComplaint, 'Dor cervical');
  assert.equal(workspace.assessments[0].painScore, 7);
  assert.equal(workspace.encounters[0].id, encounter.id);
  assert.ok(workspace.timeline.some((item) => item.type === 'assessment'));

  service.finalizeEncounter(encounter.id);
  workspace = service.getPatientWorkspace(patient.id);
  assert.equal(workspace.encounters[0].status, 'finalized');
  assert.ok(workspace.encounters[0].finalizedAt);
});

test('creating a protocol records v1 and creating a version appends v2 without mutating v1', () => {
  const db = openDatabase();
  const service = createF0Service(db);
  service.ensureSeedData();
  const protocol = service.createProtocol({ title: 'Dor cervical', changeSummary: 'v1', parameters: { energyJ: 4 } });
  const versions1 = service.listProtocolVersions(protocol.id);
  assert.equal(versions1.length, 1);
  assert.equal(versions1[0].versionNumber, 1);
  assert.deepEqual(versions1[0].parameters, { energyJ: 4 });
  service.createProtocolVersion(protocol.id, { changeSummary: 'v2', parameters: { energyJ: 5 } });
  const versions2 = service.listProtocolVersions(protocol.id);
  assert.equal(versions2.length, 2);
  assert.deepEqual(versions2[0].parameters, { energyJ: 4 });
  assert.deepEqual(versions2[1].parameters, { energyJ: 5 });
});

test('creating a session requires a reason when applied energy differs from planned energy', () => {
  const db = openDatabase();
  const service = createF0Service(db);
  service.ensureSeedData();
  const protocol = service.createProtocol({ title: 'Sessão', changeSummary: 'v1' });
  const version = service.listProtocolVersions(protocol.id)[0];
  assert.throws(() => service.createTreatmentSession({ protocolVersionId: version.id, plannedEnergyJ: 4, appliedEnergyJ: 5 }), /reason/i);
  const session = service.createTreatmentSession({
    protocolVersionId: version.id, plannedEnergyJ: 4, appliedEnergyJ: 5,
    professionalAdjustmentReason: 'Resposta clínica observada'
  });
  assert.deepEqual(session.plannedParameters, { energyJ: 4 });
  assert.deepEqual(session.appliedParameters, { energyJ: 5 });
});

test('session linked to a real encounter appears in patient history', () => {
  const db = openDatabase();
  const service = createF0Service(db);
  service.ensureSeedData();
  const patient = service.createPatient({ fullName: 'Paciente Sessão' });
  const encounter = service.startEncounter(patient.id, { assessment: { chiefComplaint: 'Dor' } });
  const protocol = service.createProtocol({ title: 'PBM paciente', changeSummary: 'v1' });
  const version = service.listProtocolVersions(protocol.id)[0];
  const session = service.createTreatmentSession({ encounterId: encounter.id, protocolVersionId: version.id, plannedEnergyJ: 4, appliedEnergyJ: 4 });
  const workspace = service.getPatientWorkspace(patient.id);
  assert.ok(workspace.sessions.some((item) => item.id === session.id));
  assert.ok(workspace.timeline.some((item) => item.type === 'treatment_session' && item.id === session.id));
});

test('audit chain remains valid after F1 patient, encounter, protocol and session actions', () => {
  const db = openDatabase();
  const service = createF0Service(db);
  service.ensureSeedData();
  const patient = service.createPatient({ fullName: 'Audit F1' });
  const encounter = service.startEncounter(patient.id, { assessment: { chiefComplaint: 'Auditoria' } });
  const protocol = service.createProtocol({ title: 'Audit protocol', changeSummary: 'v1' });
  const version = service.listProtocolVersions(protocol.id)[0];
  service.createTreatmentSession({ encounterId: encounter.id, protocolVersionId: version.id, plannedEnergyJ: 4, appliedEnergyJ: 4 });
  const audit = service.getAudit();
  assert.equal(audit.valid, true);
  assert.ok(audit.events.some((event) => event.action === 'patient.created'));
  assert.ok(audit.events.some((event) => event.action === 'encounter.created'));
  assert.ok(audit.events.some((event) => event.action === 'protocol.created'));
  assert.ok(audit.events.some((event) => event.action === 'treatment_session.created'));
});
