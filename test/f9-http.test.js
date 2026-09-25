import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createAppServer } from '../src/app/server.js';

function cookieFrom(response) { return (response.headers.get('set-cookie') || '').split(';')[0]; }
async function req(url, { method = 'GET', cookie, body } = {}) {
  const response = await fetch(url, { method, headers: { ...(cookie ? { cookie } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() };
}

test('F9 HTTP remains available under later server composition', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pbm-f9-http-'));
  const app = await createAppServer({ dbFile: path.join(dir, 'app.sqlite'), port: 0 });
  try {
    assert.equal((await req(`${app.url}/api/appointments`)).status, 401);
    const setup = await fetch(`${app.url}/api/auth/setup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Admin F9', email: 'f9@example.test', password: 'senha-f9-local' }) });
    const cookie = cookieFrom(setup);
    assert.ok(['F9', 'F10'].includes((await req(`${app.url}/api/status`, { cookie })).body.phase));
    const patient = await req(`${app.url}/api/patients`, { method: 'POST', cookie, body: { fullName: 'Paciente HTTP F9' } });
    const patientId = patient.body.patient.id;

    const appointment = await req(`${app.url}/api/appointments`, { method: 'POST', cookie, body: { patientId, startsAt: '2026-10-10T10:00:00.000Z', endsAt: '2026-10-10T11:00:00.000Z', appointmentType: 'evaluation' } });
    assert.equal(appointment.status, 201);
    const confirmed = await req(`${app.url}/api/appointments/${appointment.body.appointments[0].id}`, { method: 'PATCH', cookie, body: { status: 'confirmed' } });
    assert.equal(confirmed.body.appointment.status, 'confirmed');

    const pack = await req(`${app.url}/api/packages`, { method: 'POST', cookie, body: { patientId, name: 'Pacote HTTP', totalSessions: 4, totalAmountCents: 40000 } });
    assert.equal(pack.status, 201);
    const payment = await req(`${app.url}/api/payments`, { method: 'POST', cookie, body: { patientId, packageId: pack.body.package.id, amountCents: 40000, paymentMethod: 'pix' } });
    assert.equal(payment.status, 201);
    assert.equal((await req(`${app.url}/api/payments/${payment.body.payment.id}/pay`, { method: 'POST', cookie, body: { paidAt: '2026-10-10T12:00:00.000Z' } })).status, 200);
    const report = await req(`${app.url}/api/reports/operations?from=2026-10-01T00:00:00.000Z&to=2026-10-31T23:59:59.999Z`, { cookie });
    assert.equal(report.status, 200);
    assert.equal(report.body.report.finance.receivedCents, 40000);
  } finally {
    await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
