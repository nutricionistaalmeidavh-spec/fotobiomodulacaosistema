import test from 'node:test';
import assert from 'node:assert/strict';
import { createClinicalDataGateway } from '../src/app/public/data/clinical-data-gateway.js';
import {
  ADMIN_ADAPTER_METHODS,
  AUTH_ADAPTER_METHODS,
  CLINICAL_ADAPTER_METHODS,
  F0_ADAPTER_METHODS,
  OPERATIONS_ADAPTER_METHODS
} from '../src/app/public/data/contracts.js';

function fake(methods, overrides = {}) {
  return Object.fromEntries(methods.map((name) => [name, async (...args) => ({ name, args })]).concat(Object.entries(overrides)));
}

function gateway(overrides = {}) {
  return createClinicalDataGateway({
    f0Adapter: fake(F0_ADAPTER_METHODS, overrides.f0),
    clinicalAdapter: fake(CLINICAL_ADAPTER_METHODS, overrides.clinical),
    operationsAdapter: fake(OPERATIONS_ADAPTER_METHODS, overrides.operations),
    authAdapter: fake(AUTH_ADAPTER_METHODS, overrides.auth),
    adminAdapter: fake(ADMIN_ADAPTER_METHODS, overrides.admin)
  });
}

test('gateway rejects a partial persisted clinical adapter', () => {
  const broken = fake(CLINICAL_ADAPTER_METHODS);
  delete broken.listEvolution;
  assert.throws(() => createClinicalDataGateway({
    f0Adapter: fake(F0_ADAPTER_METHODS),
    clinicalAdapter: broken,
    operationsAdapter: fake(OPERATIONS_ADAPTER_METHODS),
    authAdapter: fake(AUTH_ADAPTER_METHODS),
    adminAdapter: fake(ADMIN_ADAPTER_METHODS)
  }), /clinicalAdapter must implement listEvolution\(\)/);
});

test('gateway exposes persisted clinical, operational, auth and admin boundaries', async () => {
  const g = gateway({
    clinical: { createPatient: async (input) => ({ id: 'p1', ...input, source: 'persisted' }) },
    operations: { getOperationalReport: async () => ({ sessionCount: 4 }) },
    auth: { getAuthStatus: async () => ({ authenticated: true, user: { role: 'admin' } }) },
    admin: { listAccounts: async () => [{ id: 'a1' }] }
  });
  assert.equal((await g.createPatient({ fullName: 'Ana' })).source, 'persisted');
  assert.equal((await g.getOperationalReport()).sessionCount, 4);
  assert.equal((await g.getAuthStatus()).user.role, 'admin');
  assert.equal((await g.listAccounts()).length, 1);
});

test('persisted write failure propagates without fixture fallback', async () => {
  const g = gateway({ f0: { createSession: async () => { throw new Error('backend unavailable'); } } });
  await assert.rejects(() => g.createSession({ plannedEnergyJ: 4 }), /backend unavailable/);
});
