import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const publicRoot = new URL('../src/app/public/', import.meta.url);
const providerUrl = new URL('data/mock-provider.js', publicRoot);

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

test('mock patient creation uses unique local ids and preserves text as data', async () => {
  assert.equal(fs.existsSync(providerUrl), true, 'data/mock-provider.js should exist');
  const { createMockUiProvider } = await import(providerUrl.href);
  const provider = createMockUiProvider();
  const one = provider.createPatient({ fullName: '<img src=x onerror=alert(1)>', email: 'safe@example.test' });
  const two = provider.createPatient({ fullName: 'Paciente Dois' });
  assert.match(one.id, /^mock-patient-/);
  assert.match(two.id, /^mock-patient-/);
  assert.notEqual(one.id, two.id);
  assert.equal(one.fullName, '<img src=x onerror=alert(1)>');
  assert.equal(provider.getPatient(one.id).fullName, '<img src=x onerror=alert(1)>');
});
