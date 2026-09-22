function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function buildTreatmentSession(input) {
  const required = ['id', 'encounterId', 'performedBy'];
  for (const key of required) if (!input?.[key]) throw new Error(`${key} is required`);

  const plannedParameters = structuredClone(input.plannedParameters ?? {});
  const appliedParameters = structuredClone(input.appliedParameters ?? plannedParameters);
  const changed = stable(plannedParameters) !== stable(appliedParameters);
  if (changed && !String(input.professionalAdjustmentReason ?? '').trim()) {
    throw new Error('Professional adjustment reason is required when applied parameters differ from planned parameters');
  }

  return Object.freeze({
    id: input.id,
    encounterId: input.encounterId,
    performedBy: input.performedBy,
    protocolVersionId: input.protocolVersionId ?? null,
    equipmentId: input.equipmentId ?? null,
    applicatorId: input.applicatorId ?? null,
    plannedParameters: deepFreeze(plannedParameters),
    appliedParameters: deepFreeze(appliedParameters),
    professionalAdjustmentReason: String(input.professionalAdjustmentReason ?? '').trim() || null,
    status: input.status ?? 'planned'
  });
}
