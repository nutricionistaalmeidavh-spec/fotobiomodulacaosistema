const SUPPORTED_TYPES = new Set(['vas_pain', 'functional_numeric', 'edema', 'rom', 'text']);

function cleanText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function finiteNumber(value, label = 'Outcome value') {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} must be finite`);
  return number;
}

export function normalizeOutcome(input = {}) {
  const type = cleanText(input.type);
  if (!SUPPORTED_TYPES.has(type)) throw new Error(`Unsupported outcome type: ${type ?? '<empty>'}`);

  const narrative = cleanText(input.narrative);

  if (type === 'text') {
    if (!narrative) throw new Error('Text outcome narrative is required');
    return { type, value: null, unit: null, narrative };
  }

  const value = finiteNumber(input.value);

  if (type === 'vas_pain') {
    if (value < 0 || value > 10) throw new Error('VAS pain value must be between 0 and 10');
    return { type, value, unit: '0-10', narrative };
  }

  if (type === 'functional_numeric') {
    return { type, value, unit: cleanText(input.unit), narrative };
  }

  if (type === 'edema') {
    const unit = cleanText(input.unit);
    if (!unit) throw new Error('Edema outcome unit is required');
    return { type, value, unit, narrative };
  }

  return {
    type,
    value,
    unit: cleanText(input.unit) || 'deg',
    narrative
  };
}
