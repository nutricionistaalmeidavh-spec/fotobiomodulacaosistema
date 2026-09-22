import { createHash } from 'node:crypto';

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hashBody(event) {
  return createHash('sha256').update(canonical({
    id: event.id,
    actorType: event.actorType,
    actorId: event.actorId ?? null,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    payload: event.payload ?? {},
    prevHash: event.prevHash ?? null,
    createdAt: event.createdAt
  })).digest('hex');
}

export function buildAuditEvent(input) {
  for (const key of ['id', 'actorType', 'action', 'entityType', 'entityId', 'createdAt']) {
    if (!input?.[key]) throw new Error(`${key} is required`);
  }
  const event = {
    id: input.id,
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    payload: structuredClone(input.payload ?? {}),
    prevHash: input.previousEvent?.eventHash ?? null,
    createdAt: input.createdAt
  };
  return Object.freeze({ ...event, eventHash: hashBody(event) });
}

export function verifyAuditChain(events) {
  let previousHash = null;
  for (const event of events) {
    if ((event.prevHash ?? null) !== previousHash) return false;
    if (event.eventHash !== hashBody(event)) return false;
    previousHash = event.eventHash;
  }
  return true;
}
