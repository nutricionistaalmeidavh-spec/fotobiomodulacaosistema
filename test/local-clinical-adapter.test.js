import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalClinicalAdapter } from '../src/app/public/data/adapters/local-clinical-adapter.js';

const seed = {
  dashboard: {},
  agenda: [],
  patients: [{
    id: 'p1', fullName: 'Ana', status: 'active', timeline: [], evolution: [], photos: [],
    pendingItems: [],
    clinicalIntake: { anamnesis: {}, consent: {}, safetyChecklist: {} }
  }]
};

test('evolution rejects blank title without mutation', async () => {
  const adapter = createLocalClinicalAdapter(seed);
  await assert.rejects(() => adapter.addEvolution('p1', { title: '   ', date: '2026-09-22' }), /título/i);
  assert.deepEqual(await adapter.listEvolution('p1'), []);
});

test('evolution filters by category/date and remains local', async () => {
  const adapter = createLocalClinicalAdapter(seed);
  await adapter.addEvolution('p1', { date: '2026-09-20', category: 'session', title: 'Sessão 1', notes: 'Sem intercorrência' });
  await adapter.addEvolution('p1', { date: '2026-09-22', category: 'assessment', title: 'Reavaliação', notes: 'Registro descritivo' });
  const result = await adapter.listEvolution('p1', { category: 'assessment', from: '2026-09-21', to: '2026-09-23' });
  assert.equal(result.length, 1);
  assert.equal(result[0].title, 'Reavaliação');
  assert.equal(result[0].source, 'local');
});

test('photo metadata is local and removable', async () => {
  const adapter = createLocalClinicalAdapter(seed);
  const created = await adapter.addPhotoMetadata('p1', {
    capturedDate: '2026-09-22', region: 'Ombro direito', observation: 'Vista anterior', previewDataUrl: 'data:image/png;base64,AA=='
  });
  assert.equal(created.source, 'local');
  assert.equal((await adapter.listPhotos('p1')).length, 1);
  assert.equal(await adapter.removePhotoMetadata('p1', created.id), true);
  assert.deepEqual(await adapter.listPhotos('p1'), []);
});

test('agenda rejects unknown status without mutation', async () => {
  const adapter = createLocalClinicalAdapter(seed);
  await assert.rejects(() => adapter.createAgendaItem({ patientId: 'p1', startsAt: '2026-09-23T09:00', status: 'done-ish' }), /status/i);
  assert.deepEqual(await adapter.listAgenda(), []);
});

test('agenda validates before mutation and supports status updates', async () => {
  const adapter = createLocalClinicalAdapter(seed);
  const created = await adapter.createAgendaItem({ patientId: 'p1', startsAt: '2026-09-23T09:00', status: 'scheduled', note: 'Retorno' });
  assert.equal(created.source, 'local');
  assert.equal((await adapter.listAgenda({ status: 'scheduled' })).length, 1);
  const updated = await adapter.updateAgendaItem(created.id, { status: 'completed' });
  assert.equal(updated.status, 'completed');
  const before = await adapter.listAgenda();
  await assert.rejects(() => adapter.updateAgendaItem(created.id, { status: 'unknown' }), /status/i);
  assert.deepEqual(await adapter.listAgenda(), before);
});

test('agenda rejects invalid date without mutation', async () => {
  const adapter = createLocalClinicalAdapter(seed);
  await assert.rejects(() => adapter.createAgendaItem({ patientId: 'p1', startsAt: 'not-a-date', status: 'scheduled' }), /Data\/hora/i);
  assert.deepEqual(await adapter.listAgenda(), []);
});
