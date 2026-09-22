import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createAppServer } from '../src/app/server.js';

test('HTTP app exposes F0 status, protocol/session writes and a valid audit chain', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pbm-http-'));
  const app = await createAppServer({ dbFile: path.join(dir, 'app.sqlite'), port: 0 });
  try {
    const status = await fetch(`${app.url}/api/status`).then((response) => response.json());
    assert.equal(status.phase, 'F0');
    assert.equal(status.tableCount, 19);

    const created = await fetch(`${app.url}/api/protocols`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'HTTP E2E', changeSummary: 'v1' })
    }).then(async (response) => ({ status: response.status, body: await response.json() }));
    assert.equal(created.status, 201);
    const versionId = created.body.protocol.versions[0].id;

    const invalidSession = await fetch(`${app.url}/api/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ protocolVersionId: versionId, plannedEnergyJ: 4, appliedEnergyJ: 5 })
    });
    assert.equal(invalidSession.status, 400);

    const validSession = await fetch(`${app.url}/api/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        protocolVersionId: versionId,
        plannedEnergyJ: 4,
        appliedEnergyJ: 5,
        professionalAdjustmentReason: 'Validação HTTP'
      })
    });
    assert.equal(validSession.status, 201);

    const audit = await fetch(`${app.url}/api/audit`).then((response) => response.json());
    assert.equal(audit.valid, true);
    assert.deepEqual(audit.events.map((item) => item.action), ['protocol.created', 'treatment_session.created']);
  } finally {
    await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
