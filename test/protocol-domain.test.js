import test from 'node:test';
import assert from 'node:assert/strict';
import { createProtocolVersion, normalizeProtocolStatus } from '../src/domain/protocols.js';

test('createProtocolVersion increments a protocol without mutating older versions', () => {
  const previous = Object.freeze({ id: 'v1', protocolId: 'p1', versionNumber: 1, status: 'published' });
  const next = createProtocolVersion(previous, { id: 'v2', changeSummary: 'nova referência' });
  assert.deepEqual(next, {
    id: 'v2', protocolId: 'p1', versionNumber: 2, status: 'draft', changeSummary: 'nova referência'
  });
  assert.equal(previous.versionNumber, 1);
});

test('only known protocol statuses are accepted', () => {
  assert.equal(normalizeProtocolStatus('published'), 'published');
  assert.throws(() => normalizeProtocolStatus('automatic-prescription'), /invalid protocol status/i);
});
