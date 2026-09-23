import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createAppServer } from '../src/app/server.js';

function cookieFrom(response) {
  return (response.headers.get('set-cookie') || '').split(';')[0];
}

test('F2 protocol features remain available under F4 server', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pbm-f2-http-'));
  const app = await createAppServer({ dbFile: path.join(dir, 'app.sqlite'), port: 0 });
  try {
    const setup = await fetch(`${app.url}/api/auth/setup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Profissional F2', email: 'f2-http@example.test', password: 'senha-http-f2' })
    });
    assert.equal(setup.status, 201);
    const cookie = cookieFrom(setup);
    const headers = { 'content-type': 'application/json', cookie };

    const status = await fetch(`${app.url}/api/status`, { headers: { cookie } }).then((response) => response.json());
    assert.equal(status.phase, 'F4');

    const created = await fetch(`${app.url}/api/protocols`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: 'Cervicalgia F2 HTTP',
        changeSummary: 'v1 estruturada',
        parameters: {
          wavelengthNm: 808,
          powerMw: 100,
          timeS: 40,
          areaCm2: 0.5,
          mode: 'continuous',
          points: 4,
          technique: 'contact'
        },
        indications: [{
          condition: 'Cervicalgia',
          symptom: 'Dor cervical',
          bodyRegion: 'Cervical',
          therapeuticGoal: 'Analgesia',
          clinicalPhase: 'aguda'
        }]
      })
    }).then(async (response) => ({ status: response.status, body: await response.json() }));

    assert.equal(created.status, 201);
    const version = created.body.protocol.versions[0];
    assert.equal(version.parameters.energyJ, 4);
    assert.equal(version.parameters.fluenceJcm2, 8);
    assert.equal(version.indications[0].symptom, 'Dor cervical');
    assert.equal(version.indications[0].clinicalPhase, 'aguda');

    const matching = await fetch(`${app.url}/api/protocols?symptom=dor%20cervical&bodyRegion=cervical&clinicalPhase=aguda`, {
      headers: { cookie }
    }).then((response) => response.json());
    assert.ok(matching.protocols.some((protocol) => protocol.id === created.body.protocol.id));

    const wrongSymptom = await fetch(`${app.url}/api/protocols?symptom=dor%20lombar`, {
      headers: { cookie }
    }).then((response) => response.json());
    assert.equal(wrongSymptom.protocols.some((protocol) => protocol.id === created.body.protocol.id), false);
  } finally {
    await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});