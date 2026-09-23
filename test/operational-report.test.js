import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveOperationalReport } from '../src/app/public/data/operational-report.js';

const patients = [
  { id: 'p1', status: 'active', pendingItems: ['Reavaliar'] },
  { id: 'p2', status: 'active', pendingItems: [] },
  { id: 'p3', status: 'inactive', pendingItems: ['Encerrado'] }
];

const sessions = [
  {
    id: 's1', startedAt: '2026-09-20T10:00:00Z', protocolTitle: 'Analgesia cervical',
    plannedParameters: { energyJ: 4 }, appliedParameters: { energyJ: 4 }
  },
  {
    id: 's2', startedAt: '2026-09-21T10:00:00Z', protocolTitle: 'Analgesia cervical',
    plannedParameters: { energyJ: 4 }, appliedParameters: { energyJ: 5 }
  },
  {
    id: 's3', startedAt: '2026-08-01T10:00:00Z', protocolTitle: 'Recuperação muscular',
    plannedParameters: { energyJ: 6 }, appliedParameters: { energyJ: 6 }
  }
];

test('derives descriptive operational metrics for the selected period', () => {
  const report = deriveOperationalReport({
    patients,
    sessions,
    protocols: [],
    filters: { from: '2026-09-01', to: '2026-09-30' }
  });
  assert.equal(report.sessionCount, 2);
  assert.equal(report.activePatientCount, 2);
  assert.equal(report.pendingFollowUpCount, 1);
  assert.equal(report.divergenceCount, 1);
  assert.deepEqual(report.protocolUsage, [{ name: 'Analgesia cervical', count: 2 }]);
  assert.deepEqual(report.basis, { patients: 'local', sessions: 'persisted', protocols: 'persisted' });
});

test('future period returns zero sessions without changing patient operational totals', () => {
  const report = deriveOperationalReport({
    patients,
    sessions,
    protocols: [],
    filters: { from: '2099-01-01', to: '2099-01-31' }
  });
  assert.equal(report.sessionCount, 0);
  assert.equal(report.divergenceCount, 0);
  assert.equal(report.activePatientCount, 2);
  assert.deepEqual(report.protocolUsage, []);
});

test('invalid reversed period fails explicitly', () => {
  assert.throws(
    () => deriveOperationalReport({ patients, sessions, protocols: [], filters: { from: '2026-10-01', to: '2026-09-01' } }),
    /Período inválido/i
  );
});
