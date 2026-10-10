import fs from 'node:fs';
import path from 'node:path';
import { request } from '@playwright/test';

const baseURL = 'http://127.0.0.1:8788';
const storagePath = path.resolve('.tmp/e2e-admin-storage.json');
const ADMIN = { name: 'Admin E2E', email: 'admin-e2e@example.test', password: 'senha-e2e-admin-123' };

async function ensureAccount(api, input) {
  const accounts = await api.get('/api/admin/accounts').then((response) => response.json());
  if ((accounts.accounts || []).some((item) => item.email === input.email)) return;
  const created = await api.post('/api/admin/accounts', { data: input });
  if (!created.ok()) throw new Error(`Falha ao criar ${input.role} E2E: ${created.status()} ${await created.text()}`);
}

async function ensurePatient(api, input) {
  const patients = await api.get('/api/patients').then((response) => response.json());
  const existing = (patients.patients || []).find((item) => item.email === input.email);
  if (existing) return existing;
  const created = await api.post('/api/patients', { data: input });
  if (!created.ok()) throw new Error(`Falha ao criar paciente E2E: ${created.status()} ${await created.text()}`);
  return (await created.json()).patient;
}

export default async function globalSetup() {
  fs.mkdirSync(path.dirname(storagePath), { recursive: true });
  const api = await request.newContext({ baseURL });
  const status = await api.get('/api/auth/status').then((response) => response.json());
  if (status.setupRequired) {
    const setup = await api.post('/api/auth/setup', { data: ADMIN });
    if (!setup.ok()) throw new Error(`Falha no setup E2E: ${setup.status()} ${await setup.text()}`);
  } else if (!status.authenticated) {
    const login = await api.post('/api/auth/login', { data: { email: ADMIN.email, password: ADMIN.password } });
    if (!login.ok()) throw new Error(`Falha no login E2E: ${login.status()} ${await login.text()}`);
  }

  await ensureAccount(api, { name: 'Profissional E2E', email: 'professional-e2e@example.test', password: 'senha-e2e-prof-123', role: 'professional' });
  await ensureAccount(api, { name: 'Recepção E2E', email: 'reception-e2e@example.test', password: 'senha-e2e-recepcao-123', role: 'reception' });

  await ensurePatient(api, { fullName: 'Ana Martins', email: 'ana.martins@example.test', phone: '(16) 99900-1001', notes: 'Acompanhamento clínico E2E.' });
  await ensurePatient(api, { fullName: 'Carlos Menezes', email: 'carlos.menezes@example.test', phone: '(16) 99900-1002', notes: 'Retorno E2E.' });
  const marina = await ensurePatient(api, { fullName: 'Marina Rocha', email: 'marina.rocha@example.test', phone: '(16) 99900-1003', notes: 'Ciclo encerrado E2E.' });
  if (marina?.active !== false) await api.post(`/api/patients/${encodeURIComponent(marina.id)}/archive`, { data: {} });

  await api.storageState({ path: storagePath });
  await api.dispose();
}
