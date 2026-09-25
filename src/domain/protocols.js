const PROTOCOL_STATUSES = new Set(['draft', 'published', 'retired']);
const PBM_MODES = new Set(['continuous', 'pulsed']);

function positiveNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${label} must be greater than zero`);
  return number;
}

function round(value) {
  return Number(Number(value).toFixed(6));
}

function approximatelyEqual(a, b) {
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= scale * 1e-6;
}

export function normalizeProtocolStatus(value) {
  const status = String(value ?? '').trim().toLowerCase();
  if (!PROTOCOL_STATUSES.has(status)) {
    throw new Error(`Invalid protocol status: ${value}`);
  }
  return status;
}

export function calculateEnergyJ({ powerMw, timeS }) {
  const power = positiveNumber(powerMw, 'Power');
  const time = positiveNumber(timeS, 'Time');
  return round((power / 1000) * time);
}

export function calculateFluenceJcm2({ energyJ, areaCm2 }) {
  const energy = positiveNumber(energyJ, 'Energy');
  const area = positiveNumber(areaCm2, 'Area');
  return round(energy / area);
}

export function calculateIrradianceMwCm2({ powerMw, areaCm2 }) {
  const power = positiveNumber(powerMw, 'Power');
  const area = positiveNumber(areaCm2, 'Area');
  return round(power / area);
}

export function normalizePbmParameters(input = {}) {
  const wavelengthNm = positiveNumber(input.wavelengthNm, 'Wavelength');
  const powerMw = positiveNumber(input.powerMw, 'Power');
  const timeS = positiveNumber(input.timeS, 'Time');
  const areaCm2 = positiveNumber(input.areaCm2, 'Area');
  const mode = String(input.mode ?? '').trim().toLowerCase();
  if (!PBM_MODES.has(mode)) throw new Error(`Invalid PBM mode: ${input.mode}`);

  const points = Number(input.points);
  if (!Number.isInteger(points) || points <= 0) throw new Error('Points must be a positive integer');
  const technique = String(input.technique ?? '').trim();
  if (!technique) throw new Error('Technique is required');

  let frequencyHz = null;
  if (mode === 'pulsed') frequencyHz = positiveNumber(input.frequencyHz, 'Frequency');

  const energyJ = calculateEnergyJ({ powerMw, timeS });
  const irradianceMwCm2 = calculateIrradianceMwCm2({ powerMw, areaCm2 });
  const fluenceJcm2 = calculateFluenceJcm2({ energyJ, areaCm2 });

  if (input.energyJ != null && !approximatelyEqual(positiveNumber(input.energyJ, 'Energy'), energyJ)) {
    throw new Error('Energy is inconsistent with power and time');
  }
  if (input.irradianceMwCm2 != null && !approximatelyEqual(positiveNumber(input.irradianceMwCm2, 'Irradiance'), irradianceMwCm2)) {
    throw new Error('Irradiance is inconsistent with power and area');
  }
  if (input.fluenceJcm2 != null && !approximatelyEqual(positiveNumber(input.fluenceJcm2, 'Fluence'), fluenceJcm2)) {
    throw new Error('Fluence is inconsistent with energy and area');
  }

  return Object.freeze({
    wavelengthNm: round(wavelengthNm),
    powerMw: round(powerMw),
    irradianceMwCm2,
    fluenceJcm2,
    energyJ,
    timeS: round(timeS),
    areaCm2: round(areaCm2),
    mode,
    frequencyHz: frequencyHz == null ? null : round(frequencyHz),
    points,
    technique
  });
}

export function createProtocolVersion(previous, input) {
  if (!previous?.protocolId || !Number.isInteger(previous?.versionNumber)) {
    throw new Error('Previous protocol version is required');
  }
  if (!input?.id) throw new Error('New protocol version id is required');
  if (!input?.changeSummary?.trim()) throw new Error('Change summary is required');

  return Object.freeze({
    id: input.id,
    protocolId: previous.protocolId,
    versionNumber: previous.versionNumber + 1,
    status: 'draft',
    changeSummary: input.changeSummary.trim()
  });
}
