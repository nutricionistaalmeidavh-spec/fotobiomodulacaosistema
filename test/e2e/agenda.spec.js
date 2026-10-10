import { test, expect } from '@playwright/test';

async function openAgenda(page) {
  await page.goto('/');
  await page.locator('[data-nav="agenda"]').click();
  await expect(page.getByRole('heading', { name: 'Agenda', exact: true })).toBeVisible();
}

test.describe('Persisted F9 appointments', () => {
  test('creates, filters and marks an appointment completed without creating a session', async ({ page }) => {
    const note = 'Retorno E2E ' + Date.now();
    await openAgenda(page);
    const patientPayload = await (await page.request.get('/api/patients')).json();
    const patient = patientPayload.patients.find(p => p.fullName === 'Ana Martins');
    await page.getByLabel('Paciente da agenda').selectOption(patient.id);
    await page.getByLabel('Data e hora inicial').fill('2026-10-20T10:15');
    await page.getByLabel('Data e hora final').fill('2026-10-20T11:15');
    await page.getByLabel('Observação da agenda').fill(note);
    await page.getByRole('button', { name: 'Agendar' }).click();
    const item = page.locator('[data-agenda-item]').filter({ hasText: note });
    await expect(item).toContainText('Ana Martins');
    await expect(item).toContainText('Persistido');
    await item.getByRole('combobox', { name: /Status de Ana Martins/ }).selectOption('completed');
    await page.getByLabel('Filtrar status').selectOption('completed');
    await expect(item).toContainText('Concluído');
    await page.reload();
    await page.locator('[data-nav="agenda"]').click();
    await expect(page.locator('[data-agenda-item]').filter({ hasText: note })).toContainText('Concluído');
  });

  test('linked appointment opens the authorized patient record', async ({ page }) => {
    const note = 'Agendamento vinculável ' + Date.now();
    await openAgenda(page);
    const patientPayload = await (await page.request.get('/api/patients')).json();
    const patient = patientPayload.patients.find(p => p.fullName === 'Ana Martins');
    await page.getByLabel('Paciente da agenda').selectOption(patient.id);
    await page.getByLabel('Data e hora inicial').fill('2026-10-21T10:15');
    await page.getByLabel('Data e hora final').fill('2026-10-21T11:15');
    await page.getByLabel('Observação da agenda').fill(note);
    await page.getByRole('button', { name: 'Agendar' }).click();
    await page.locator('[data-agenda-item]').filter({ hasText: note }).getByRole('button', { name: 'Abrir paciente Ana Martins' }).click();
    await expect(page.getByRole('heading', { name: 'Ana Martins', exact: true })).toBeVisible();
  });

  test('agenda remains usable at 390px without page-level horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.locator('[data-mobile-nav-toggle]').click();
    await page.locator('[data-nav="agenda"]').click();
    await expect(page.getByRole('heading', { name: 'Agenda', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  });
});