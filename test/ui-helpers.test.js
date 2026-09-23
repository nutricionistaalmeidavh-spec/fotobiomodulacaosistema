import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const publicRoot = new URL('../src/app/public/', import.meta.url);
const localAdapterUrl = new URL('data/adapters/local-clinical-adapter.js', publicRoot);
const fixturesUrl = new URL('data/fixtures.js', publicRoot);
const patientsViewUrl = new URL('features/patients.js', publicRoot);
const workspaceUrl = new URL('features/patient-workspace.js', publicRoot);
const photosUrl = new URL('features/photos.js', publicRoot);

test('local clinical adapter returns deterministic copied snapshots', async () => {
  assert.equal(fs.existsSync(localAdapterUrl), true, 'local clinical adapter should exist');
  const { createLocalClinicalAdapter } = await import(localAdapterUrl.href);
  const { UI_FIXTURES } = await import(fixturesUrl.href);
  const adapter = createLocalClinicalAdapter(UI_FIXTURES);
  const dashboard = await adapter.getDashboard();
  assert.deepEqual(
    {
      sessionsToday: dashboard.sessionsToday,
      activePatients: dashboard.activePatients,
      pendingFollowUps: dashboard.pendingFollowUps,
      recentProtocols: dashboard.recentProtocols
    },
    { sessionsToday: 3, activePatients: 2, pendingFollowUps: 2, recentProtocols: 4 }
  );
  const firstRead = await adapter.listPatients();
  firstRead[0].fullName = 'mutated outside adapter';
  assert.notEqual((await adapter.listPatients())[0].fullName, 'mutated outside adapter');
});

test('local patient creation uses unique ids, validates name and preserves text as data', async () => {
  const { createLocalClinicalAdapter } = await import(localAdapterUrl.href);
  const { UI_FIXTURES } = await import(fixturesUrl.href);
  const adapter = createLocalClinicalAdapter(UI_FIXTURES);
  await assert.rejects(() => adapter.createPatient({ fullName: '   ' }), /obrigatório/i);
  const one = await adapter.createPatient({ fullName: '<img src=x onerror=alert(1)>', email: 'safe@example.test' });
  const two = await adapter.createPatient({ fullName: 'Paciente Dois' });
  assert.match(one.id, /^local-patient-/);
  assert.match(two.id, /^local-patient-/);
  assert.notEqual(one.id, two.id);
  assert.equal(one.fullName, '<img src=x onerror=alert(1)>');
  assert.equal((await adapter.getPatient(one.id)).fullName, '<img src=x onerror=alert(1)>');
});

test('patient filter is accent/case insensitive and supports status filtering', async () => {
  assert.equal(fs.existsSync(patientsViewUrl), true, 'features/patients.js should exist');
  const { filterPatients } = await import(patientsViewUrl.href);
  const patients = [
    { id: '1', fullName: 'José Ávila', email: 'jose@example.test', phone: '111', status: 'active' },
    { id: '2', fullName: 'MARIA Souza', email: 'maria@example.test', phone: '222', status: 'inactive' }
  ];
  assert.deepEqual(filterPatients(patients, 'jose', 'all').map((item) => item.id), ['1']);
  assert.deepEqual(filterPatients(patients, 'souZA', 'all').map((item) => item.id), ['2']);
  assert.deepEqual(filterPatients(patients, '', 'active').map((item) => item.id), ['1']);
  assert.deepEqual(filterPatients(patients, 'não existe', 'all'), []);
});

test('patient workspace exposes the exact approved local tab registry', async () => {
  assert.equal(fs.existsSync(workspaceUrl), true, 'features/patient-workspace.js should exist');
  const { WORKSPACE_TABS } = await import(workspaceUrl.href);
  assert.deepEqual(WORKSPACE_TABS.map((item) => item.id), [
    'summary', 'anamnesis', 'protocols', 'sessions', 'evolution', 'photos', 'documents', 'consents'
  ]);
});

test('local photo validation rejects non-images and files above five MiB', async () => {
  const { MAX_LOCAL_PHOTO_BYTES, validateLocalPhotoFile } = await import(photosUrl.href);
  assert.equal(MAX_LOCAL_PHOTO_BYTES, 5 * 1024 * 1024);
  assert.throws(() => validateLocalPhotoFile({ type: 'text/plain', size: 10 }), /imagem/i);
  assert.throws(() => validateLocalPhotoFile({ type: 'image/png', size: MAX_LOCAL_PHOTO_BYTES + 1 }), /5 MiB/i);
  assert.doesNotThrow(() => validateLocalPhotoFile({ type: 'image/png', size: MAX_LOCAL_PHOTO_BYTES }));
});
