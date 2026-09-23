import { test, expect } from '@playwright/test';

async function openAgenda(page) {
  await page.goto('/');
  await page.locator('[data-nav="agenda"]').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Agenda', exact: true })).toBeVisible();
}

test.describe('UI-8 agenda', () => {
  test('creates, filters and updates a local agenda item', async ({ page }) => {
    await openAgenda(page);
    await page.getByLabel('Paciente da agenda').selectOption('mock-patient-001');
    await page.getByLabel('Data e hora').fill('2026-10-02T10:15');
    await page.getByLabel('Observação da agenda').fill('Retorno pós-avaliação E2E');
    await page.getByRole('button', { name: 'Adicionar à agenda' }).click();

    const item = page.locator('[data-agenda-item]').filter({ hasText: 'Retorno pós-avaliação E2E' });
    await expect(item).toContainText('Ana Martins');
    await expect(item).toContainText(/Somente local|não persistido/i);

    await item.getByRole('combobox', { name: /Status de Ana Martins/i }).selectOption('completed');
    await page.getByLabel('Filtrar status').selectOption('completed');
    await expect(item).toBeVisible();
    await expect(item).toContainText(/Concluído/i);
  });

  test('linked agenda item opens the patient workspace', async ({ page }) => {
    await openAgenda(page);
    const anaItem = page.locator('[data-agenda-item]').filter({ hasText: 'Ana Martins' }).first();
    await anaItem.getByRole('button', { name: 'Abrir paciente Ana Martins' }).click();
    await expect(page.getByRole('heading', { name: 'Ana Martins', exact: true })).toBeVisible();
    await expect(page.locator('[data-nav="patients"]')).toHaveAttribute('aria-current', 'page');
  });

  test('agenda remains usable at narrow mobile width without global overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const menu = page.locator('[data-mobile-nav-toggle]');
    await menu.click();
    await page.locator('[data-nav="agenda"]').click();
    await expect(page.getByRole('heading', { level: 1, name: 'Agenda', exact: true })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });
});
