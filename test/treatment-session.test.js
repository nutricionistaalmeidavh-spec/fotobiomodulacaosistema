import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTreatmentSession } from '../src/domain/treatment-sessions.js';

test('session keeps planned and applied parameters as separate immutable snapshots', () => {
  const planned = { wavelengthNm: 808, energyJ: 4, timeSeconds: 40 };
  const applied = { wavelengthNm: 808, energyJ: 3.5, timeSeconds: 35 };
  const session = buildTreatmentSession({
    id: 's1', encounterId: 'e1', performedBy: 'p1', protocolVersionId: 'v1',
    plannedParameters: planned, appliedParameters: applied,
    professionalAdjustmentReason: 'Sensibilidade relatada durante a sessão'
  });
  assert.notEqual(session.plannedParameters, planned);
  assert.notEqual(session.appliedParameters, applied);
  assert.equal(session.plannedParameters.energyJ, 4);
  assert.equal(session.appliedParameters.energyJ, 3.5);
  assert.throws(() => { session.appliedParameters.energyJ = 99; }, TypeError);
});

test('changing planned parameters requires a professional adjustment reason', () => {
  assert.throws(() => buildTreatmentSession({
    id: 's1', encounterId: 'e1', performedBy: 'p1', protocolVersionId: 'v1',
    plannedParameters: { energyJ: 4 }, appliedParameters: { energyJ: 3 }
  }), /adjustment reason/i);
});
