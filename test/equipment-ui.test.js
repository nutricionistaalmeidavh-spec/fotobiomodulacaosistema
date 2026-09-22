import test from 'node:test';
import assert from 'node:assert/strict';
import { equipmentReadiness, renderEquipmentWorkspace } from '../src/app/public/features/equipment-workspace.js';

test('equipment readiness describes technical completeness only', () => {
  const complete = equipmentReadiness({ manufacturer: 'Acme', model: 'PBM-1', applicator: { name: 'Probe', wavelengthNm: 808, maxPowerMw: 100 } });
  assert.deepEqual(complete, { complete: true, label: 'Dados técnicos completos' });
  const incomplete = equipmentReadiness({ manufacturer: 'Acme', model: 'PBM-2', applicator: { name: 'Probe' } });
  assert.deepEqual(incomplete, { complete: false, label: 'Dados técnicos incompletos' });
});

test('equipment workspace shows technical data without clinical compatibility claims', () => {
  const html = renderEquipmentWorkspace([{ manufacturer: 'Acme', model: 'PBM-1', serialNumber: 'SN-1', applicator: { name: 'Probe', wavelengthNm: 808, maxPowerMw: 100 } }]);
  assert.match(html, /Acme PBM-1/);
  assert.match(html, /808 nm/);
  assert.match(html, /100 mW/);
  assert.match(html, /Probe/);
  assert.match(html, /Dados técnicos completos/);
  assert.doesNotMatch(html, /compatível para tratamento/i);
});
