import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAuditEvent, verifyAuditChain } from '../src/core/audit.js';

test('audit events form a verifiable hash chain', () => {
  const first = buildAuditEvent({
    id: 'a1', actorType: 'system', action: 'create', entityType: 'patient', entityId: 'p1',
    payload: { source: 'test' }, createdAt: '2026-09-22T18:00:00.000Z'
  });
  const second = buildAuditEvent({
    id: 'a2', actorType: 'professional', actorId: 'pro1', action: 'update', entityType: 'patient', entityId: 'p1',
    payload: { field: 'phone' }, previousEvent: first, createdAt: '2026-09-22T18:01:00.000Z'
  });
  assert.equal(second.prevHash, first.eventHash);
  assert.equal(verifyAuditChain([first, second]), true);
});

test('audit verification detects payload tampering', () => {
  const first = buildAuditEvent({
    id: 'a1', actorType: 'system', action: 'create', entityType: 'patient', entityId: 'p1',
    payload: { source: 'test' }, createdAt: '2026-09-22T18:00:00.000Z'
  });
  const tampered = { ...first, payload: { source: 'altered' } };
  assert.equal(verifyAuditChain([tampered]), false);
});
