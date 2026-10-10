import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/db/database.js';
import { createF9Service } from '../src/app/f9-service.js';

function setup() {
  const db = openDatabase(':memory:');
  const service = createF9Service(db);
  service.ensureSeedData();
  const patient = service.createPatient({ fullName: 'Paciente F9' });
  return { db, service, patient };
}

test('F9 materializes recurring appointments and updates status without creating PBM sessions', () => {
  const { db, service, patient } = setup();
  assert.equal(service.getStatus().phase, 'F9');
  const created = service.createAppointments({
    patientId: patient.id,
    startsAt: '2026-10-01T09:00:00.000Z',
    endsAt: '2026-10-01T10:00:00.000Z',
    appointmentType: 'return',
    recurrence: { count: 3, intervalDays: 7 },
    notes: 'Retorno seriado'
  });
  assert.equal(created.length, 3);
  assert.equal(new Set(created.map((item) => item.recurrenceSeriesId)).size, 1);
  assert.equal(service.listSessions().length, 0);
  const updated = service.updateAppointment(created[0].id, { status: 'confirmed' });
  assert.equal(updated.status, 'confirmed');
  assert.equal(service.listSessions().length, 0);
  db.close();
});

test('F9 packages consume only real patient sessions once', () => {
  const { db, service, patient } = setup();
  const encounter = service.startEncounter(patient.id, { assessment: { chiefComplaint: 'Teste F9' } });
  const protocol = service.createProtocol({ title: 'Protocolo F9', changeSummary: 'v1' });
  const version = service.listProtocolVersions(protocol.id)[0];
  const session = service.createTreatmentSession({
    encounterId: encounter.id,
    protocolVersionId: version.id,
    plannedEnergyJ: 4,
    appliedEnergyJ: 4
  });
  const pack = service.createTreatmentPackage({
    patientId: patient.id,
    name: 'Pacote 3 sessões',
    totalSessions: 3,
    totalAmountCents: 30000
  });
  const usage = service.consumeTreatmentPackage(pack.id, session.id);
  assert.equal(usage.treatmentSessionId, session.id);
  assert.equal(service.listTreatmentPackages({ patientId: patient.id })[0].usedSessions, 1);
  assert.throws(() => service.consumeTreatmentPackage(pack.id, session.id), /já consumida|already/i);
  db.close();
});

test('F9 payments use integer cents and reports received versus pending values descriptively', () => {
  const { db, service, patient } = setup();
  assert.throws(() => service.createPayment({ patientId: patient.id, amountCents: 99.5 }), /centavos|integer/i);
  const paid = service.createPayment({ patientId: patient.id, amountCents: 15000, paymentMethod: 'pix', dueAt: '2026-10-02T12:00:00.000Z' });
  service.createPayment({ patientId: patient.id, amountCents: 5000, paymentMethod: 'dinheiro', dueAt: '2026-10-15T12:00:00.000Z' });
  service.markPaymentPaid(paid.id, '2026-10-02T12:00:00.000Z');
  const report = service.getOperationsReport({ from: '2026-10-01T00:00:00.000Z', to: '2026-10-31T23:59:59.999Z' });
  assert.equal(report.finance.receivedCents, 15000);
  assert.equal(report.finance.pendingCents, 5000);
  assert.equal(Object.hasOwn(report, 'forecast'), false);
  assert.equal(Object.hasOwn(report, 'prediction'), false);
  db.close();
});
