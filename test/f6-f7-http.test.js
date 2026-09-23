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

test('F6/F7 HTTP remains available under later composition', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pbm-f7-http-'));
  const app = await createAppServer({ dbFile: path.join(dir, 'app.sqlite'), port: 0 });
  try {
    const setup = await fetch(`${app.url}/api/auth/setup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Profissional F7', email: 'f7-http@example.test', password: 'senha-f7-http' })
    });
    assert.equal(setup.status, 201);
    const cookie = cookieFrom(setup);

    const status = await jsonRequest(`${app.url}/api/status`, { cookie });
    assert.equal(status.status, 200);
    assert.ok(['F8', 'F9', 'F10'].includes(status.body.phase));

    const evidence = await jsonRequest(`${app.url}/api/evidence`, {
      method: 'POST', cookie,
      body: {
        title: 'Evidence HTTP F6',
        publicationYear: 2025,
        studyType: 'systematic_review',
        conditions: ['cervicalgia'],
        bodyRegions: ['cervical'],
        wavelengthsNm: [808]
      }
    });
    assert.equal(evidence.status, 201);
    assert.equal(evidence.body.evidence.title, 'Evidence HTTP F6');

    const search = await jsonRequest(`${app.url}/api/evidence?q=cervical&wavelengthNm=808`, { cookie });
    assert.equal(search.status, 200);
    assert.equal(search.body.evidence.length, 1);

    const protocol = await jsonRequest(`${app.url}/api/protocols`, {
      method: 'POST', cookie,
      body: { title: 'Protocolo HTTP F6', changeSummary: 'v1' }
    });
    assert.equal(protocol.status, 201);
    const versionId = protocol.body.protocol.versions[0].id;

    const link = await jsonRequest(`${app.url}/api/protocol-versions/${versionId}/evidence`, {
      method: 'POST', cookie,
      body: { evidenceId: evidence.body.evidence.id, relationType: 'context', note: 'Referência documental' }
    });
    assert.equal(link.status, 201);
    assert.equal(link.body.link.protocolVersionId, versionId);

    const linked = await jsonRequest(`${app.url}/api/protocol-versions/${versionId}/evidence`, { cookie });
    assert.equal(linked.status, 200);
    assert.equal(linked.body.evidence.length, 1);

    const patient = await jsonRequest(`${app.url}/api/patients`, {
      method: 'POST', cookie, body: { fullName: 'Paciente HTTP F7' }
    });
    const patientId = patient.body.patient.id;
    const encounter = await jsonRequest(`${app.url}/api/patients/${patientId}/encounters`, {
      method: 'POST', cookie, body: { assessment: { chiefComplaint: 'Dor cervical' } }
    });
    const session = await jsonRequest(`${app.url}/api/sessions`, {
      method: 'POST', cookie,
      body: {
        encounterId: encounter.body.encounter.id,
        protocolVersionId: versionId,
        plannedEnergyJ: 4,
        appliedEnergyJ: 4
      }
    });
    assert.equal(session.status, 201);

    const catalog = await jsonRequest(`${app.url}/api/body-map/catalog`, { cookie });
    assert.equal(catalog.status, 200);
    assert.ok(catalog.body.regions.some((item) => item.id === 'cervical'));

    const point = await jsonRequest(`${app.url}/api/sessions/${session.body.session.id}/body-map-points`, {
      method: 'POST', cookie,
      body: {
        sequenceNumber: 1,
        regionId: 'cervical',
        view: 'posterior',
        laterality: 'midline',
        x: 0.5,
        y: 0.18,
        anatomicalLabel: 'C4-C5'
      }
    });
    assert.equal(point.status, 201);
    assert.equal(point.body.point.coordinates.regionId, 'cervical');

    const points = await jsonRequest(`${app.url}/api/patients/${patientId}/body-map-points`, { cookie });
    assert.equal(points.status, 200);
    assert.equal(points.body.points.length, 1);
    assert.equal(points.body.points[0].anatomicalLabel, 'C4-C5');
  } finally {
    await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
