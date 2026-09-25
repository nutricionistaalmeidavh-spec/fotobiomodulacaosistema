import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createAppServer } from '../src/app/server.js';

function cookieFrom(response) { return (response.headers.get('set-cookie') || '').split(';')[0]; }
async function req(url, { method = 'GET', cookie, body } = {}) {
  const response = await fetch(url, {
    method,
    headers: { ...(cookie ? { cookie } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

async function login(base, email, password) {
  const response = await fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password })
  });
  return { status: response.status, cookie: cookieFrom(response), body: await response.json() };
}

test('F10 HTTP enforces admin/professional/reception permissions server-side', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pbm-f10-http-'));
  const app = await createAppServer({ dbFile: path.join(root, 'app.sqlite'), storageRoot: path.join(root, 'assets'), backupRoot: path.join(root, 'backups'), port: 0 });
  try {
    const setup = await fetch(`${app.url}/api/auth/setup`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Admin F10 HTTP', email: 'admin-http-f10@example.test', password: 'senha-admin-f10' })
    });
    assert.equal(setup.status, 201);
    const adminCookie = cookieFrom(setup);
    assert.equal((await req(`${app.url}/api/status`, { cookie: adminCookie })).body.phase, 'F10');

    const professional = await req(`${app.url}/api/admin/accounts`, {
      method: 'POST', cookie: adminCookie,
      body: { name: 'Profissional HTTP', email: 'prof-http-f10@example.test', password: 'senha-prof-f10', role: 'professional' }
    });
    assert.equal(professional.status, 201);
    const reception = await req(`${app.url}/api/admin/accounts`, {
      method: 'POST', cookie: adminCookie,
      body: { name: 'Recepção HTTP', email: 'rec-http-f10@example.test', password: 'senha-rec-f10', role: 'reception' }
    });
    assert.equal(reception.status, 201);

    const profLogin = await login(app.url, 'prof-http-f10@example.test', 'senha-prof-f10');
    const recLogin = await login(app.url, 'rec-http-f10@example.test', 'senha-rec-f10');
    assert.equal(profLogin.status, 200);
    assert.equal(recLogin.status, 200);

    const patient = await req(`${app.url}/api/patients`, { method: 'POST', cookie: recLogin.cookie, body: { fullName: 'Paciente Recepção F10' } });
    assert.equal(patient.status, 201);
    assert.equal((await req(`${app.url}/api/appointments`, { cookie: recLogin.cookie })).status, 200);
    assert.equal((await req(`${app.url}/api/payments`, { cookie: recLogin.cookie })).status, 200);
    assert.equal((await req(`${app.url}/api/patients/${patient.body.patient.id}/workspace`, { cookie: recLogin.cookie })).status, 403);
    assert.equal((await req(`${app.url}/api/protocols`, { cookie: recLogin.cookie })).status, 403);

    assert.equal((await req(`${app.url}/api/patients/${patient.body.patient.id}/workspace`, { cookie: profLogin.cookie })).status, 200);
    assert.equal((await req(`${app.url}/api/protocols`, { cookie: profLogin.cookie })).status, 200);
    assert.equal((await req(`${app.url}/api/payments`, { cookie: profLogin.cookie })).status, 403);
    assert.equal((await req(`${app.url}/api/admin/accounts`, { cookie: profLogin.cookie })).status, 403);

    const accounts = await req(`${app.url}/api/admin/accounts`, { cookie: adminCookie });
    assert.equal(accounts.status, 200);
    assert.equal(accounts.body.accounts.length, 3);
    assert.equal(accounts.body.accounts.some((item) => Object.hasOwn(item, 'passwordHash')), false);

    const integrity = await req(`${app.url}/api/admin/integrity`, { cookie: adminCookie });
    assert.equal(integrity.status, 200);
    assert.equal(integrity.body.integrity.valid, true);
  } finally {
    await app.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('F10 HTTP revokes sessions and disables accounts', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pbm-f10-revoke-http-'));
  const app = await createAppServer({ dbFile: path.join(root, 'app.sqlite'), port: 0 });
  try {
    const setup = await fetch(`${app.url}/api/auth/setup`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Admin', email: 'admin2-f10@example.test', password: 'senha-admin-f10' })
    });
    const adminCookie = cookieFrom(setup);
    const created = await req(`${app.url}/api/admin/accounts`, {
      method: 'POST', cookie: adminCookie,
      body: { name: 'Profissional Revogar', email: 'revoke-f10@example.test', password: 'senha-revoke-f10', role: 'professional' }
    });
    const targetId = created.body.account.accountId;
    const first = await login(app.url, 'revoke-f10@example.test', 'senha-revoke-f10');
    assert.equal((await req(`${app.url}/api/status`, { cookie: first.cookie })).status, 200);
    assert.equal((await req(`${app.url}/api/admin/accounts/${targetId}/revoke-sessions`, { method: 'POST', cookie: adminCookie, body: {} })).status, 200);
    assert.equal((await req(`${app.url}/api/status`, { cookie: first.cookie })).status, 401);
    assert.equal((await req(`${app.url}/api/admin/accounts/${targetId}`, { method: 'PATCH', cookie: adminCookie, body: { active: false } })).status, 200);
    assert.equal((await login(app.url, 'revoke-f10@example.test', 'senha-revoke-f10')).status, 401);
  } finally {
    await app.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
