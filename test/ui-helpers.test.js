import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const publicRoot = new URL('../src/app/public/', import.meta.url);
const providerUrl = new URL('data/mock-provider.js', publicRoot);
const patientsViewUrl = new URL('features/patients.js', publicRoot);

test('mock UI provider exists and returns deterministic copied snapshots', async () => {
  assert.equal(fs.existsSync(providerUrl), true, 'data/mock-provider.js should exist');
  const { createMockUiProvider } = await import(providerUrl.href);
  const provider = createMockUiProvider();
  const dashboard = provider.getDashboard();
  assert.deepEqual(
    {
      sessionsToday: dashboard.sessionsToday,
      activePatients: dashboard.activePatients,
      pendingFollowUps: dashboard.pendingFollowUps,
      recentProtocols: dashboard.recentProtocols
    },
    { sessionsToday: 3, activePatients: 2, pendingFollowUps: 2, recentProtocols: 4 }
  );
  const firstRead = provider.listPatients();
  firstRead[0].fullName = 'mutated outside provider';
  assert.notEqual(provider.listPatients()[0].fullName, 'mutated outside provider');
});

test('mock patient creation uses unique local ids, validates name and preserves text as data', async () => {
  const { createMockUiProvider } = await import(providerUrl.href);
  const provider = createMockUiProvider();
  assert.throws(() => provider.createPatient({ fullName: '   ' }), /obrigatório/i);
  const one = provider.createPatient({ fullName: '<img src=x onerror=alert(1)>', email: 'safe@example.test' });
  const two = provider.createPatient({ fullName: 'Paciente Dois' });
  assert.match(one.id, /^mock-patient-/);
  assert.match(two.id, /^mock-patient-/);
  assert.notEqual(one.id, two.id);
  assert.equal(one.fullName, '<img src=x onerror=alert(1)>');
  assert.equal(provider.getPatient(one.id).fullName, '<img src=x onerror=alert(1)>');
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
