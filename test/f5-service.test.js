import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/db/database.js';
import { createF5Service } from '../src/app/f5-service.js';

test('F5 records canonical outcomes and exposes an ordered longitudinal series', () => {
  const db = openDatabase();
  const service = createF5Service(db);
  service.ensureSeedData();

  const patient = service.createPatient({ fullName: 'Paciente longitudinal F5' });
  const encounter = service.startEncounter(patient.id, {
    assessment: { chiefComplaint: 'Dor cervical', painScore: 8 }
  });

  const baseline = service.recordOutcome({
    patientId: patient.id,
    encounterId: encounter.id,
    metricType: 'vas_pain',
    metricValue: 8,
    narrative: 'Dor antes da primeira aplicação',
    baselineGroup: 'cervical-cycle-1',
    measuredAt: '2026-09-23T10:00:00.000Z'
  });
  const followup = service.recordOutcome({
    patientId: patient.id,
    encounterId: encounter.id,
    metricType: 'vas_pain',
    metricValue: 5,
    narrative: 'Dor após acompanhamento',
    baselineGroup: 'cervical-cycle-1',
    measuredAt: '2026-09-23T11:00:00.000Z'
  });

  assert.equal(service.getStatus().phase, 'F5');
  assert.equal(baseline.metricUnit, '0-10');
  assert.equal(baseline.baselineGroup, 'cervical-cycle-1');
  assert.ok(baseline.professionalId);
  assert.equal(followup.metricValue, 5);

  const series = service.getOutcomeSeries(patient.id, 'vas_pain', { baselineGroup: 'cervical-cycle-1' });
  assert.deepEqual(series.points.map((point) => point.metricValue), [8, 5]);
  assert.equal(series.firstValue, 8);
  assert.equal(series.latestValue, 5);
  assert.equal(series.absoluteChange, -3);
});

test('F5 patient timeline unifies clinical events and outcomes in reverse chronological order', () => {
  const db = openDatabase();
  const service = createF5Service(db);
  service.ensureSeedData();

  const patient = service.createPatient({ fullName: 'Timeline F5' });
  const encounter = service.startEncounter(patient.id, {
    assessment: { chiefComplaint: 'Edema de tornozelo' }
  });
  service.recordOutcome({
    patientId: patient.id,
    encounterId: encounter.id,
    metricType: 'edema',
    metricValue: 27.4,
    metricUnit: 'cm',
    narrative: 'Perimetria inicial',
    baselineGroup: 'ankle-edema',
    measuredAt: '2026-09-23T12:00:00.000Z'
  });

  const workspace = service.getPatientWorkspace(patient.id);
  assert.ok(workspace.outcomes.some((item) => item.metricType === 'edema'));
  assert.ok(workspace.timeline.some((item) => item.type === 'outcome'));

  const timestamps = workspace.timeline.map((item) => String(item.at || ''));
  assert.deepEqual(timestamps, [...timestamps].sort((a, b) => b.localeCompare(a)));
});