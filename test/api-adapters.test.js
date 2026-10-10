import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthApiAdapter } from '../src/app/public/data/adapters/auth-api-adapter.js';
import { createClinicalApiAdapter } from '../src/app/public/data/adapters/clinical-api-adapter.js';
import { createOperationsApiAdapter } from '../src/app/public/data/adapters/operations-api-adapter.js';

function responder(routes, calls) {
  return async (path, options = {}) => {
    calls.push({ path: String(path), method: options.method || 'GET', body: options.body });
    const route = routes[String(path)];
    if (!route) return new Response(JSON.stringify({ error: 'missing fake route' }), { status: 404, headers: { 'content-type': 'application/json' } });
    return new Response(JSON.stringify(route.body), { status: route.status || 200, headers: { 'content-type': 'application/json' } });
  };
}

test('auth adapter uses cookie-backed same-origin auth endpoints', async () => {
  const calls = [];
  const request = responder({
    '/api/auth/status': { body: { authenticated: false, setupRequired: true } },
    '/api/auth/login': { body: { user: { role: 'admin' } } }
  }, calls);
  const adapter = createAuthApiAdapter({ request });
  assert.equal((await adapter.getAuthStatus()).setupRequired, true);
  assert.equal((await adapter.login({ email: 'a@b.c', password: 'x' })).user.role, 'admin');
  assert.deepEqual(calls.map((item) => [item.path, item.method]), [['/api/auth/status', 'GET'], ['/api/auth/login', 'POST']]);
});

test('clinical adapter normalizes persisted patient status for the existing main UI', async () => {
  const calls = [];
  const adapter = createClinicalApiAdapter({ request: responder({
    '/api/patients': { body: { patients: [{ id: 'p1', fullName: 'Paciente', active: true }] } }
  }, calls) });
  const patients = await adapter.listPatients();
  assert.equal(patients[0].status, 'active');
  assert.equal(patients[0].source, 'persisted');
});

test('operations adapter maps the existing agenda contract onto persisted appointments', async () => {
  const calls = [];
  const adapter = createOperationsApiAdapter({ request: responder({
    '/api/appointments?status=scheduled': { body: { appointments: [{ id: 'a1', startAt: '2026-09-25T10:00:00', status: 'scheduled' }] } }
  }, calls) });
  const items = await adapter.listAgenda({ status: 'scheduled' });
  assert.equal(items[0].startsAt, '2026-09-25T10:00:00');
  assert.equal(items[0].source, 'persisted');
});
