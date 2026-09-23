import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createAppServer } from '../src/app/server.js';

function cookieFrom(response) {
  return (response.headers.get('set-cookie') || '').split(';')[0];
}

async function jsonRequest(url, { method = 'GET', cookie, body } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' })
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  return { status: response.status, body: await response.json() };
}

test('F8 HTTP exposes authenticated deterministic clinical search', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pbm-f8-http-'));
  const app = await createAppServer({ dbFile: path.join(dir, 'app.sqlite'), port: 0 });
  try {
    const unauthenticated = await jsonRequest(`${app.url}/api/clinical-engine/protocols?condition=cervicalgia`);
    assert.equal(unauthenticated.status, 401);

    const setup = await fetch(`${app.url}/api/auth/setup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Profissional F8', email: 'f8-http@example.test', password: 'senha-f8-http' })
    });
    assert.equal(setup.status, 201);
    const cookie = cookieFrom(setup);

    const status = await jsonRequest(`${app.url}/api/status`, { cookie });
    assert.equal(status.body.phase, 'F8');

    const protocol = await jsonRequest(`${app.url}/api/protocols`, {
      method: 'POST', cookie,
      body: {
        title: 'Protocolo HTTP F8',
        changeSummary: 'v1',
        parameters: { wavelengthNm: 808, powerMw: 100, timeS: 40, areaCm2: 0.5, mode: 'continuous' },
        indications: [{
          condition: 'cervicalgia', symptom: 'dor cervical', bodyRegion: 'cervical',
          therapeuticGoal: 'analgesia', clinicalPhase: 'aguda',
          minAgeYears: 18, maxAgeYears: 70, professionalArea: 'fisioterapia'
        }]
      }
    });
    assert.equal(protocol.status, 201);

    const search = await jsonRequest(
      `${app.url}/api/clinical-engine/protocols?condition=cervicalgia&ageYears=45&professionalArea=fisioterapia&wavelengthNm=808`,
      { cookie }
    );
    assert.equal(search.status, 200);
    assert.equal(search.body.results.length, 1);
    assert.equal(search.body.results[0].protocol.title, 'Protocolo HTTP F8');
    assert.equal(Object.hasOwn(search.body.results[0], 'score'), false);
  } finally {
    await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
