import { test, expect } from '@playwright/test';

function localInput(date) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

async function createPatientWithSession(page, suffix, label) {
  const patientResponse = await page.request.post('/api/patients', { data: { fullName: `${label} ${suffix}` } });
  expect(patientResponse.ok()).toBeTruthy();
  const patient = (await patientResponse.json()).patient;
  const encounterResponse = await page.request.post(`/api/patients/${patient.id}/encounters`, {
    data: { assessment: { chiefComplaint: 'Contexto operacional F9' } }
  });
  expect(encounterResponse.ok()).toBeTruthy();
  const encounter = (await encounterResponse.json()).encounter;
  const protocolResponse = await page.request.post('/api/protocols', {
    data: {
      title: `Protocolo financeiro ${label} ${suffix}`,
      changeSummary: 'Versão F9',
      parameters: {
        wavelengthNm: 808,
        powerMw: 100,
        timeS: 40,
        areaCm2: 0.5,
        mode: 'continuous',
        points: 1,
        technique: 'contact'
      }
    }
  });
  expect(protocolResponse.ok()).toBeTruthy();
  const protocol = (await protocolResponse.json()).protocol;
  const version = protocol.versions[0];
  const sessionResponse = await page.request.post('/api/sessions', {
    data: {
      encounterId: encounter.id,
      protocolVersionId: version.id,
      plannedEnergyJ: 4,
      appliedEnergyJ: 4
    }
  });
  expect(sessionResponse.ok()).toBeTruthy();
  return { patient, session: (await sessionResponse.json()).session };
}

test('F9 agenda persists recurrence and completing an appointment never creates a PBM session', async ({ page }) => {
  const suffix = Date.now();
  const patientResponse = await page.request.post('/api/patients', { data: { fullName: `Paciente Agenda ${suffix}` } });
  const patient = (await patientResponse.json()).patient;
  const sessionsBefore = (await (await page.request.get('/api/sessions')).json()).sessions.length;
  const start = new Date(Date.now() + 86400000);
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 3600000);

  await page.goto('/');
  await page.locator('[data-nav="agenda"]').click();
  await expect(page.getByRole('heading', { name: 'Agenda', exact: true })).toBeVisible();
  await page.getByLabel('Paciente da agenda').selectOption(patient.id);
  await page.getByLabel('Data e hora inicial').fill(localInput(start));
  await page.getByLabel('Data e hora final').fill(localInput(end));
  await page.getByLabel('Tipo de atendimento').selectOption('return');
  await page.getByLabel('Repetições').fill('2');
  await page.getByLabel('Intervalo (dias)').fill('7');
  await page.getByLabel('Observação da agenda').fill('Retorno operacional recorrente');
  await page.getByRole('button', { name: 'Agendar' }).click();

  const cards = page.locator('[data-agenda-item]').filter({ hasText: `Paciente Agenda ${suffix}` });
  await expect(cards).toHaveCount(2);
  await cards.first().getByLabel(/Status de Paciente Agenda/).selectOption('completed');
  await expect(cards.first()).toContainText('Concluído');

  const sessionsAfter = (await (await page.request.get('/api/sessions')).json()).sessions.length;
  expect(sessionsAfter).toBe(sessionsBefore);

  await page.reload();
  await page.locator('[data-nav="agenda"]').click();
  await expect(page.locator('[data-agenda-item]').filter({ hasText: `Paciente Agenda ${suffix}` })).toHaveCount(2);
  await expect(page.getByText(/Persistido/).first()).toBeVisible();
  await expect(page.getByText(/Somente local|não persistido/i)).toHaveCount(0);
});

test('F9 finance consumes only same-patient sessions, persists payments and T10 reports backend totals', async ({ page }) => {
  const suffix = Date.now();
  const primary = await createPatientWithSession(page, suffix, 'Paciente Financeiro');
  const other = await createPatientWithSession(page, suffix, 'Paciente Outro');

  await page.goto('/');
  await page.locator('[data-nav="finance"]').click();
  await expect(page.getByRole('heading', { name: 'Financeiro', exact: true })).toBeVisible();

  await page.getByRole('tab', { name: 'Pacotes' }).click();
  await page.getByLabel('Paciente do pacote').selectOption(primary.patient.id);
  await page.getByLabel('Nome do pacote').fill(`Pacote ${suffix}`);
  await page.getByLabel('Sessões incluídas').fill('3');
  await page.getByLabel('Valor total (R$)').fill('300');
  await page.getByRole('button', { name: 'Criar pacote' }).click();
  const packageCard = page.locator('[data-finance-package]').filter({ hasText: `Pacote ${suffix}` });
  await expect(packageCard).toContainText(/3 restantes/i);

  const packagePayload = await (await page.request.get(`/api/packages?patientId=${encodeURIComponent(primary.patient.id)}`)).json();
  const pack = packagePayload.packages.find((item) => item.name === `Pacote ${suffix}`);
  expect(pack).toBeTruthy();

  const wrongConsume = await page.request.post(`/api/packages/${pack.id}/consume`, { data: { treatmentSessionId: other.session.id } });
  expect(wrongConsume.ok()).toBeFalsy();
  const unchanged = (await (await page.request.get(`/api/packages?patientId=${encodeURIComponent(primary.patient.id)}`)).json()).packages.find((item) => item.id === pack.id);
  expect(unchanged.usedSessions).toBe(0);

  await packageCard.getByLabel('Sessão para consumir').selectOption(primary.session.id);
  await packageCard.getByRole('button', { name: 'Consumir sessão' }).click();
  await expect(packageCard).toContainText(/2 restantes/i);

  await page.getByRole('tab', { name: 'Pagamentos' }).click();
  await page.getByLabel('Paciente da cobrança').selectOption(primary.patient.id);
  await page.getByLabel('Valor (R$)').fill('123.45');
  await page.getByLabel('Forma de pagamento').selectOption('pix');
  await page.getByLabel('Referência').fill(`COB-${suffix}`);
  await page.getByRole('button', { name: 'Registrar cobrança' }).click();
  const paymentCard = page.locator('[data-finance-payment]').filter({ hasText: `COB-${suffix}` });
  await expect(paymentCard).toContainText('R$ 123,45');
  await expect(paymentCard).toContainText('Pendente');

  await page.locator('[data-nav="reports"]').click();
  await expect(page.getByRole('heading', { name: 'Relatórios operacionais', exact: true })).toBeVisible();
  await expect(page.locator('[data-report-metric="pending-cents"]')).toContainText('R$ 123,45');

  await page.locator('[data-nav="finance"]').click();
  await page.getByRole('tab', { name: 'Pagamentos' }).click();
  const reloadedPaymentCard = page.locator('[data-finance-payment]').filter({ hasText: `COB-${suffix}` });
  await reloadedPaymentCard.getByRole('button', { name: 'Marcar como pago' }).click();
  await expect(reloadedPaymentCard).toContainText('Pago');

  await page.locator('[data-nav="reports"]').click();
  await expect(page.locator('[data-report-metric="received-cents"]')).toContainText('R$ 123,45');
  await expect(page.getByText(/eficácia|prognóstico|recomendação clínica/i)).toHaveCount(0);

  await page.reload();
  await page.locator('[data-nav="finance"]').click();
  await page.getByRole('tab', { name: 'Pagamentos' }).click();
  await expect(page.locator('[data-finance-payment]').filter({ hasText: `COB-${suffix}` })).toContainText('Pago');
});
