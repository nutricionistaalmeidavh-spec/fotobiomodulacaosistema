function round(value) {
  return Number(Number(value).toFixed(6));
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function supportsWavelength(applicator, wavelengthNm) {
  const target = Number(wavelengthNm);
  const available = Array.isArray(applicator?.wavelengthsNm)
    ? applicator.wavelengthsNm.map(Number)
    : [Number(applicator?.wavelengthNm)];
  return Number.isFinite(target) && available.some((value) => Number.isFinite(value) && value === target);
}

function resolvePower(applicator, selectedPowerMw, warnings) {
  const fixed = positiveNumber(applicator?.fixedPowerMw);
  if (fixed) return fixed;

  const min = positiveNumber(applicator?.minPowerMw);
  const max = positiveNumber(applicator?.maxPowerMw);
  if (!min && !max) {
    warnings.push('power_missing');
    return null;
  }

  const selected = positiveNumber(selectedPowerMw);
  if (!selected) {
    warnings.push('power_selection_required');
    return null;
  }
  if ((min && selected < min) || (max && selected > max)) {
    warnings.push('selected_power_out_of_range');
    return null;
  }
  return selected;
}

export function adaptProtocolToApplicator({ referenceParameters = {}, applicator = {}, selectedPowerMw = null } = {}) {
  const warnings = [];

  if (!supportsWavelength(applicator, referenceParameters.wavelengthNm)) {
    warnings.push('wavelength_incompatible');
  }

  const modes = Array.isArray(applicator.modes) ? applicator.modes : [];
  if (!modes.includes(referenceParameters.mode)) {
    warnings.push('mode_incompatible');
  }

  if (referenceParameters.mode === 'pulsed' && referenceParameters.frequencyHz != null) {
    const targetFrequency = Number(referenceParameters.frequencyHz);
    const frequencies = Array.isArray(applicator.frequenciesHz) ? applicator.frequenciesHz.map(Number) : [];
    if (!frequencies.some((frequency) => Number.isFinite(frequency) && frequency === targetFrequency)) {
      warnings.push('frequency_incompatible');
    }
  }

  const powerMw = resolvePower(applicator, selectedPowerMw, warnings);
  const areaCm2 = positiveNumber(applicator.spotAreaCm2);
  if (!areaCm2) warnings.push('spot_area_missing');

  const energyJ = positiveNumber(referenceParameters.energyJ);
  if (!energyJ) warnings.push('energy_missing');

  const timeS = powerMw && energyJ ? round((energyJ * 1000) / powerMw) : null;
  const irradianceMwCm2 = powerMw && areaCm2 ? round(powerMw / areaCm2) : null;
  const fluenceJcm2 = energyJ && areaCm2 ? round(energyJ / areaCm2) : null;

  const blockingWarnings = new Set([
    'wavelength_incompatible',
    'mode_incompatible',
    'frequency_incompatible',
    'power_missing',
    'power_selection_required',
    'selected_power_out_of_range',
    'energy_missing'
  ]);

  const referenceSnapshot = Object.freeze({ ...referenceParameters });
  const equipmentDerivedParameters = Object.freeze({
    powerMw,
    timeS,
    energyJ,
    areaCm2,
    irradianceMwCm2,
    fluenceJcm2
  });

  return Object.freeze({
    compatible: !warnings.some((warning) => blockingWarnings.has(warning)),
    referenceParameters: referenceSnapshot,
    equipmentDerivedParameters,
    warnings: Object.freeze([...warnings])
  });
}
