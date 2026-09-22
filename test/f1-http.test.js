import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppServer } from '../src/app/server.js';

function jsonHeaders(extra = {}) {
  return { 'content-type': 'application/json', ...extra };
}

function cookieFrom(response) {
  const raw = response.headers.get('set-cookie') || '';
  return raw.split(';')[0];
}

test('clinical API requires local authentication and supports first-run setup', async (t) => {
  const app = await createAppServer({ dbFile: ':memory:', port: 0 });
  t.after(() => app.close());

  const status = await fetch(`${app.url}/api/auth/status`);
  assert.equal(status.status, 200);
  assert.equal((await status.json()).setupRequired, true);

  const blocked = await fetch(`${app.url}/api/patients`);
  assert.equal(blocked.status, 401);

  const setup = await fetch(`${app.url}/api/auth/setup`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ name: 'Profissional F1', email: 'admin@example.test', password: 'senha-f1-segura' })
  });
  assert.equal(setup.status, 201);
  const cookie = cookieFrom(setup);
  assert.match(cookie, /^pbm_session=/);

  const authenticated = await fetch(`${app.url}/api/auth/status`, { headers: { cookie } });
  const authenticatedPayload = await authenticated.json();
  assert.equal(authenticatedPayload.authenticated, true);
  assert.equal(authenticatedPayload.user.email, 'admin@example.test');
});

test('authenticated API creates patient, anamnesis, encounter and patient workspace', async (t) => {
  const app = await createAppServer({ dbFile: ':memory:', port: 0 });
  t.after(() => app.close());

  const setup = await fetch(`${app.url}/api/auth/setup`, {
    method: 'POST', headers: jsonHeaders(),
    body: JSON.stringify({ name: 'Profissional HTTP', email: 'http@example.test', password: 'senha-http-segura' })
  });
  const cookie = cookieFrom(setup);
  const authHeaders = jsonHeaders({ cookie });

  const created = await fetch(`${app.url}/api/patients`, {
    method: 'POST', headers: authHeaders,
    body: JSON.stringify({ fullName: 'Paciente HTTP', email: 'paciente-http@example.test', phone: '16999991111' })
  });
  assert.equal(created.status, 201);
  const patient = (await created.json()).patient;
  assert.equal(patient.fullName, 'Paciente HTTP');

  const encounterResponse = await fetch(`${app.url}/api/patients/${patient.id}/encounters`, {
    method: 'POST', headers: authHeaders,
    body: JSON.stringify({
      notes: 'Primeiro atendimento',
      assessment: { chiefComplaint: 'Dor lombar', history: 'Há 10 dias', painScore: 6 }
    })
  });
  assert.equal(encounterResponse.status, 201);
  const encounter = (await encounterResponse.json()).encounter;
  assert.equal(encounter.status, 'open');

  const workspaceResponse = await fetch(`${app.url}/api/patients/${patient.id}/workspace`, { headers: { cookie } });
  assert.equal(workspaceResponse.status, 200);
  const workspace = await workspaceResponse.json();
  assert.equal(workspace.patient.id, patient.id);
  assert.equal(workspace.assessments[0].chiefComplaint, 'Dor lombar');
  assert.ok(workspace.timeline.some((item) => item.type === 'encounter'));

  const finalized = await fetch(`${app.url}/api/encounters/${encounter.id}/finalize`, {
    method: 'POST', headers: authHeaders, body: '{}'
  });
  assert.equal(finalized.status, 200);
  assert.equal((await finalized.json()).encounter.status, 'finalized');
});

test('logout revokes session and login rejects wrong password before accepting correct password', async (t) => {
  const app = await createAppServer({ dbFile: ':memory:', port: 0 });
  t.after(() => app.close());

  const setup = await fetch(`${app.url}/api/auth/setup`, {
    method: 'POST', headers: jsonHeaders(),
    body: JSON.stringify({ name: 'Profissional Login', email: 'login@example.test', password: 'senha-login-segura' })
  });
  const cookie = cookieFrom(setup);

  const logout = await fetch(`${app.url}/api/auth/logout`, { method: 'POST', headers: jsonHeaders({ cookie }), body: '{}' });
  assert.equal(logout.status, 200);
  const revoked = await fetch(`${app.url}/api/patients`, { headers: { cookie } });
  assert.equal(revoked.status, 401);

  const wrong = await fetch(`${app.url}/api/auth/login`, {
    method: 'POST', headers: jsonHeaders(),
    body: JSON.stringify({ email: 'login@example.test', password: 'errada' })
  });
  assert.equal(wrong.status, 401);

  const login = await fetch(`${app.url}/api/auth/login`, {
    method: 'POST', headers: jsonHeaders(),
    body: JSON.stringify({ email: 'login@example.test', password: 'senha-login-segura' })
  });
  assert.equal(login.status, 200);
  const loginCookie = cookieFrom(login);
  const allowed = await fetch(`${app.url}/api/patients`, { headers: { cookie: loginCookie } });
  assert.equal(allowed.status, 200);
});
