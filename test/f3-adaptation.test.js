import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptProtocolToApplicator } from '../src/domain/equipment-adaptation.js';

test('F3 derives equipment time without mutating the reference protocol', () => {
  const reference = Object.freeze({
    wavelengthNm: 808,
    energyJ: 4,
    powerMw: 100,
    timeS: 40,
    areaCm2: 0.5,
    mode: 'continuous',
    frequencyHz: null
  });
  const result = adaptProtocolToApplicator({
    referenceParameters: reference,
    applicator: {
      wavelengthNm: 808,
      fixedPowerMw: 200,
      spotAreaCm2: 0.5,
      modes: ['continuous'],
      frequenciesHz: []
    }
  });

  assert.equal(result.compatible, true);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.equipmentDerivedParameters.powerMw, 200);
  assert.equal(result.equipmentDerivedParameters.timeS, 20);
  assert.equal(result.equipmentDerivedParameters.energyJ, 4);
  assert.equal(result.equipmentDerivedParameters.irradianceMwCm2, 400);
  assert.equal(result.equipmentDerivedParameters.fluenceJcm2, 8);
  assert.equal(reference.timeS, 40);
});

test('F3 reports wavelength, mode and frequency incompatibility explicitly', () => {
  const result = adaptProtocolToApplicator({
    referenceParameters: {
      wavelengthNm: 808,
      energyJ: 4,
      mode: 'pulsed',
      frequencyHz: 10
    },
    applicator: {
      wavelengthNm: 660,
      fixedPowerMw: 100,
      spotAreaCm2: 1,
      modes: ['continuous', 'pulsed'],
      frequenciesHz: [5]
    }
  });

  assert.equal(result.compatible, false);
  assert.ok(result.warnings.includes('wavelength_incompatible'));
  assert.ok(result.warnings.includes('frequency_incompatible'));
});

test('F3 never silently chooses power for a variable-power applicator', () => {
  const reference = { wavelengthNm: 808, energyJ: 4, mode: 'continuous', frequencyHz: null };
  const applicator = {
    wavelengthNm: 808,
    minPowerMw: 50,
    maxPowerMw: 200,
    spotAreaCm2: 0.5,
    modes: ['continuous'],
    frequenciesHz: []
  };

  const missing = adaptProtocolToApplicator({ referenceParameters: reference, applicator });
  assert.equal(missing.compatible, false);
  assert.ok(missing.warnings.includes('power_selection_required'));
  assert.equal(missing.equipmentDerivedParameters.powerMw, null);

  const selected = adaptProtocolToApplicator({
    referenceParameters: reference,
    applicator,
    selectedPowerMw: 150
  });
  assert.equal(selected.compatible, true);
  assert.equal(selected.equipmentDerivedParameters.powerMw, 150);
  assert.equal(selected.equipmentDerivedParameters.timeS, 26.666667);

  const outOfRange = adaptProtocolToApplicator({
    referenceParameters: reference,
    applicator,
    selectedPowerMw: 300
  });
  assert.equal(outOfRange.compatible, false);
  assert.ok(outOfRange.warnings.includes('selected_power_out_of_range'));
});

test('F3 reports missing power and spot area instead of inventing values', () => {
  const result = adaptProtocolToApplicator({
    referenceParameters: { wavelengthNm: 808, energyJ: 4, mode: 'continuous', frequencyHz: null },
    applicator: { wavelengthNm: 808, modes: ['continuous'], frequenciesHz: [] }
  });

  assert.equal(result.compatible, false);
  assert.ok(result.warnings.includes('power_missing'));
  assert.ok(result.warnings.includes('spot_area_missing'));
  assert.equal(result.equipmentDerivedParameters.powerMw, null);
  assert.equal(result.equipmentDerivedParameters.timeS, null);
  assert.equal(result.equipmentDerivedParameters.irradianceMwCm2, null);
  assert.equal(result.equipmentDerivedParameters.fluenceJcm2, null);
});
