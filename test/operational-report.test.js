import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveOperationalReport } from '../src/app/public/data/operational-report.js';

const patients = [
  { id: 'p1', status: 'active', pendingItems: ['retorno'] },
  { id: 'p2', status: 'inactive', pendingItems: [] }
];

const sessions = [
  { createdAt: '2026-09-20T10:00:00Z', protocolTitle: 'Cervical', plannedParameters: { energyJ: 4 }, appliedParameters: { energyJ: 5 } },
  { createdAt: '2026-09-21T10:00:00Z', protocolTitle: 'Cervical', plannedParameters: { energyJ: 4 }, appliedParameters: { energyJ: 4 } }
];

test('derives descriptive operational metrics', () => {
  const report = deriveOperationalReport({ patients, sessions, protocols: [], filters: { from: '2026-09-20', to: '2026-09-21' } });
  assert.equal(report.sessionCount, 2);
  assert.equal(report.activePatientCount, 1);
  assert.equal(report.pendingFollowUpCount, 1);
  assert.equal(report.divergenceCount, 1);
  assert.deepEqual(report.protocolUsage, [{ protocol: 'Cervical', count: 2 }]);
});

test('rejects an inverted period', () => {
  assert.throws(
    () => deriveOperationalReport({ patients, sessions, protocols: [], filters: { from: '2026-09-22', to: '2026-09-20' } }),
    /Período inválido/
  );
});
