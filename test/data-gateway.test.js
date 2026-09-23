import test from 'node:test';
import assert from 'node:assert/strict';
import { createClinicalDataGateway } from '../src/app/public/data/clinical-data-gateway.js';

function fakeF0(overrides = {}) {
  return {
    getFoundationStatus: async () => ({ phase: 'F0', tableCount: 19 }),
    listProtocols: async () => [],
    createProtocol: async (input) => ({ id: 'p1', ...input, source: 'persisted' }),
    createProtocolVersion: async () => ({ versionNumber: 2, source: 'persisted' }),
    listEquipment: async () => [],
    listSessions: async () => [],
    createSession: async (input) => ({ id: 's1', ...input, source: 'persisted' }),
    getAuditState: async () => ({ valid: true, events: [], source: 'persisted' }),
    ...overrides
  };
}

function fakeLocal(overrides = {}) {
  return {
    getDashboard: async () => ({ sessionsToday: 0 }),
    listPatients: async () => [],
    getPatient: async () => null,
    createPatient: async (input) => ({ id: 'local-p1', ...input, source: 'local' }),
    getClinicalIntake: async () => ({ source: 'local' }),
    updateAnamnesis: async () => ({ source: 'local' }),
    updateConsent: async () => ({ source: 'local' }),
    updateSafetyChecklist: async () => ({ source: 'local' }),
    listEvolution: async () => [],
    addEvolution: async (patientId, input) => ({ id: 'e1', patientId, ...input, source: 'local' }),
    listPhotos: async () => [],
    addPhotoMetadata: async (patientId, input) => ({ id: 'ph1', patientId, ...input, source: 'local' }),
    removePhotoMetadata: async () => true,
    listAgenda: async () => [],
    createAgendaItem: async (input) => ({ id: 'a1', ...input, source: 'local' }),
    updateAgendaItem: async () => ({ source: 'local' }),
    ...overrides
  };
}

test('gateway rejects a partial local adapter at construction time', () => {
  const broken = fakeLocal();
  delete broken.listEvolution;
  assert.throws(
    () => createClinicalDataGateway({ f0Adapter: fakeF0(), localAdapter: broken }),
    /localAdapter must implement listEvolution\(\)/
  );
});

test('gateway preserves local and persisted source metadata', async () => {
  const gateway = createClinicalDataGateway({ f0Adapter: fakeF0(), localAdapter: fakeLocal() });
  assert.equal((await gateway.createPatient({ fullName: 'Ana' })).source, 'local');
  assert.equal((await gateway.createSession({ plannedEnergyJ: 4 })).source, 'persisted');
});

test('persisted write failure propagates without local fallback', async () => {
  let localWrites = 0;
  const gateway = createClinicalDataGateway({
    f0Adapter: fakeF0({ createSession: async () => { throw new Error('backend unavailable'); } }),
    localAdapter: fakeLocal({ createAgendaItem: async () => { localWrites += 1; } })
  });
  await assert.rejects(() => gateway.createSession({ plannedEnergyJ: 4 }), /backend unavailable/);
  assert.equal(localWrites, 0);
});

test('gateway uses an injected operational report adapter when available', async () => {
  let calls = 0;
  const report = { sessionCount: 99 };
  const gateway = createClinicalDataGateway({
    f0Adapter: fakeF0(),
    localAdapter: fakeLocal(),
    reportAdapter: {
      async getOperationalReport(filters) {
        calls += 1;
        assert.deepEqual(filters, { from: '2026-09-20' });
        return report;
      }
    }
  });
  assert.equal(await gateway.getOperationalReport({ from: '2026-09-20' }), report);
  assert.equal(calls, 1);
});

export { fakeF0, fakeLocal };
