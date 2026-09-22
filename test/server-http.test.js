import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createAppServer } from '../src/app/server.js';

function cookieFrom(response) {
  return (response.headers.get('set-cookie') || '').split(';')[0];
}

test('HTTP app exposes authenticated F2 status, protocol/session writes and a valid audit chain', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pbm-http-'));
  const app = await createAppServer({ dbFile: path.join(dir, 'app.sqlite'), port: 0 });
  try {
    const setup = await fetch(`${app.url}/api/auth/setup`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'HTTP Profissional', email: 'http-core@example.test', password: 'senha-http-core' })
    });
    assert.equal(setup.status, 201);
    const cookie = cookieFrom(setup);
    const headers = { 'content-type': 'application/json', cookie };

    const statusResponse = await fetch(`${app.url}/api/status`, { headers: { cookie } });
    assert.equal(statusResponse.status, 200);
    const status = await statusResponse.json();
    assert.equal(status.phase, 'F2');
    assert.equal(status.tableCount, 21);

    const created = await fetch(`${app.url}/api/protocols`, {
      method: 'POST', headers,
      body: JSON.stringify({ title: 'HTTP E2E', changeSummary: 'v1' })
    }).then(async (response) => ({ status: response.status, body: await response.json() }));
    assert.equal(created.status, 201);
    const versionId = created.body.protocol.versions[0].id;

    const invalidSession = await fetch(`${app.url}/api/sessions`, {
      method: 'POST', headers,
      body: JSON.stringify({ protocolVersionId: versionId, plannedEnergyJ: 4, appliedEnergyJ: 5 })
    });
    assert.equal(invalidSession.status, 400);

    const validSession = await fetch(`${app.url}/api/sessions`, {
      method: 'POST', headers,
      body: JSON.stringify({
        protocolVersionId: versionId,
        plannedEnergyJ: 4,
        appliedEnergyJ: 5,
        professionalAdjustmentReason: 'Validação HTTP'
      })
    });
    assert.equal(validSession.status, 201);

    const audit = await fetch(`${app.url}/api/audit`, { headers: { cookie } }).then((response) => response.json());
    assert.equal(audit.valid, true);
    assert.deepEqual(audit.events.map((item) => item.action), ['protocol.created', 'treatment_session.created']);
  } finally {
    await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});