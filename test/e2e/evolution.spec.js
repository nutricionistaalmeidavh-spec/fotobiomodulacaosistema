import { test, expect } from '@playwright/test';

async function openEvolution(page) {
  await page.goto('/');
  await page.locator('[data-nav="patients"]').click();
  await page.getByRole('searchbox', { name: 'Buscar pacientes' }).fill('Ana Martins');
  await page.getByRole('button', { name: 'Ana Martins', exact: true }).first().click();
  await page.getByRole('tab', { name: 'Evolução' }).click();
}

test.describe('Persisted F5 longitudinal outcomes', () => {
  test('records descriptive evolution and preserves it through reload', async ({ page }) => {
    const narrative = 'Reavaliação descritiva ' + Date.now();
    await openEvolution(page);
    await page.getByLabel('Tipo de desfecho').selectOption('text');
    await page.getByLabel('Narrativa').fill(narrative);
    await page.getByRole('button', { name: 'Registrar evolução' }).click();
    await expect(page.getByText(narrative).first()).toBeVisible();
    await page.reload();
    await page.locator('[data-nav="patients"]').click();
    await page.getByRole('searchbox', { name: 'Buscar pacientes' }).fill('Ana Martins');
    await page.getByRole('button', { name: 'Ana Martins', exact: true }).first().click();
    await page.getByRole('tab', { name: 'Evolução' }).click();
    await expect(page.getByText(narrative).first()).toBeVisible();
  });

  test('filters longitudinal outcomes by canonical metric type', async ({ page }) => {
    await openEvolution(page);
    const select = page.getByLabel('Filtrar tipo');
    await select.selectOption('rom');
    await expect(page.getByRole('heading', { name: 'Acompanhamento longitudinal' })).toBeVisible();
    await expect(page.locator('[data-evolution-view]')).toBeVisible();
    await select.selectOption('');
    await expect(page.locator('[data-evolution-view]')).toBeVisible();
  });
});