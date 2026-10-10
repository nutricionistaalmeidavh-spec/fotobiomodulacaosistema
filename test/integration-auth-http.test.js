import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createAppServer } from '../src/app/server.js';

function cookieFrom(response) {
  return (response.headers.get('set-cookie') || '').split(';')[0];
}

async function jsonRequest(base, pathname, { method = 'GET', cookie = '', body } = {}) {
  const response = await fetch(`${base}${pathname}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' })
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  return { response, body: await response.json().catch(() => ({})) };
}

test('integrated server protects API while preserving the current main static shell', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pbm-integrated-auth-'));
  const app = await createAppServer({
    dbFile: path.join(root, 'app.sqlite'),
    storageRoot: path.join(root, 'assets'),
    backupRoot: path.join(root, 'backups'),
    port: 0
  });

  try {
    const shell = await fetch(`${app.url}/`);
    assert.equal(shell.status, 200);
    const html = await shell.text();
    assert.match(html, /ArtiSys Fotobiomodula[cç][aã]o/i);
    assert.match(html, /\/app\.js/);
    assert.doesNotMatch(html, /f10-bootstrap\.js|f[2-9]-ui\.js|f10-ui\.js/);

    const anonymousPatients = await fetch(`${app.url}/api/patients`);
    assert.equal(anonymousPatients.status, 401);

    const setup = await fetch(`${app.url}/api/auth/setup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Admin Integração', email: 'admin-integracao@example.test', password: 'senha-integracao-123' })
    });
    assert.equal(setup.status, 201);
    const adminCookie = cookieFrom(setup);
    assert.ok(adminCookie.startsWith('pbm_session='));

    const status = await jsonRequest(app.url, '/api/auth/status', { cookie: adminCookie });
    assert.equal(status.response.status, 200);
    assert.equal(status.body.authenticated, true);
    assert.equal(status.body.user.role, 'admin');

    const protectedPatients = await jsonRequest(app.url, '/api/patients', { cookie: adminCookie });
    assert.equal(protectedPatients.response.status, 200);

    const logout = await jsonRequest(app.url, '/api/auth/logout', { method: 'POST', cookie: adminCookie, body: {} });
    assert.equal(logout.response.status, 200);
    assert.equal((await fetch(`${app.url}/api/patients`, { headers: { cookie: adminCookie } })).status, 401);
  } finally {
    await app.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
