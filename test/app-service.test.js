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
  assert.equal(status.tableCount, 21);
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
  assert.equal(service.listPatients().some((item) => item.id === patient.id), false);
  assert.equal(service.listPatients({ includeArchived: true }).some((item) => item.id === patient.id), true);
});

test('F1 encounter records anamnesis and exposes longitudinal patient workspace', () => {
  const db = openDatabase();
  const service = createF0Service(db);
  service.ensureSeedData();
  assert.equal(typeof service.startEncounter, 'function');
  assert.equal(typeof service.finalizeEncounter, 'function');
  assert.equal(typeof service.getPatientWorkspace, 'function');

  const patient = service.createPatient({ fullName: 'Histórico F1' });
  const encounter = service.startEncounter(patient.id, {
    notes: 'Atendimento inicial',
    assessment: {
      chiefComplaint: 'Dor cervical', history: 'Há 3 semanas', medications: 'Nenhuma',
      allergies: 'Negadas', precautions: 'Fotossensibilidade negada', painScore: 7
    }
  });
  assert.equal(encounter.status, 'open');

  let workspace = service.getPatientWorkspace(patient.id);
  assert.equal(workspace.patient.id, patient.id);
  assert.equal(workspace.encounters.length, 1);
  assert.equal(workspace.assessments[0].chiefComplaint, 'Dor cervical');
  assert.equal(workspace.assessments[0].painScore, 7);
  assert.ok(workspace.timeline.some((item) => item.type === 'encounter'));
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

test('session linked to a real encounter appears in patient history', () => {
  const db = openDatabase();
  const service = createF0Service(db);
  service.ensureSeedData();
  const patient = service.createPatient({ fullName: 'Paciente sessão' });
  const encounter = service.startEncounter(patient.id, { assessment: { chiefComplaint: 'Lesão' } });
  const protocol = service.createProtocol({ title: 'PBM F1', changeSummary: 'Inicial' });
  const [version] = service.listProtocolVersions(protocol.id);
  const session = service.createTreatmentSession({
    encounterId: encounter.id, protocolVersionId: version.id,
    plannedEnergyJ: 4, appliedEnergyJ: 4
  });
  assert.equal(session.encounterId, encounter.id);
  const workspace = service.getPatientWorkspace(patient.id);
  assert.ok(workspace.sessions.some((item) => item.id === session.id));
  assert.ok(workspace.timeline.some((item) => item.type === 'treatment_session' && item.id === session.id));
});

test('audit chain remains valid after F1 patient, encounter, protocol and session actions', () => {
  const db = openDatabase();
  const service = createF0Service(db);
  service.ensureSeedData();
  const patient = service.createPatient({ fullName: 'Auditável F1' });
  service.startEncounter(patient.id, { assessment: { chiefComplaint: 'Avaliação' } });
  const protocol = service.createProtocol({ title: 'Auditável', changeSummary: 'Inicial' });
  const [version] = service.listProtocolVersions(protocol.id);
  service.createTreatmentSession({ protocolVersionId: version.id, plannedEnergyJ: 4, appliedEnergyJ: 4 });
  const audit = service.getAudit();
  assert.equal(audit.valid, true);
  const actions = audit.events.map((item) => item.action).join(' ');
  assert.match(actions, /patient\.created/);
  assert.match(actions, /encounter\.created/);
  assert.match(actions, /protocol\.created/);
  assert.match(actions, /treatment_session\.created/);
});
