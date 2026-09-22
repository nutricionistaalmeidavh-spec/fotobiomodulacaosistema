const PROTOCOL_STATUSES = new Set(['draft', 'published', 'retired']);

export function normalizeProtocolStatus(value) {
  const status = String(value ?? '').trim().toLowerCase();
  if (!PROTOCOL_STATUSES.has(status)) {
    throw new Error(`Invalid protocol status: ${value}`);
  }
  return status;
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
