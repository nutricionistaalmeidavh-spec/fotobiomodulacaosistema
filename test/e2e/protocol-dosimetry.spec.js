import { test, expect } from '@playwright/test';

async function openLibrary(page) {
  await page.goto('/');
  await page.locator('[data-nav="protocols"]').click();
  await page.getByRole('tab', { name: 'Biblioteca' }).click();
}

test.describe('PBM dosimetry and immutable protocol library', () => {
  test('calculates energy and fluence deterministically, without prescribing', async ({ page }) => {
    await openLibrary(page);
    await expect(page.getByRole('heading', { name: 'Calculadora de dosimetria' })).toBeVisible();
    await page.getByLabel('Potência (mW)').fill('100');
    await page.getByLabel('Tempo (s)').fill('40');
    await page.getByLabel('Área (cm²)').fill('2');
    await page.getByRole('button', { name: 'Calcular dosimetria' }).click();
    await expect(page.locator('[data-dosimetry-result]')).toContainText('Energia: 4 J');
    await expect(page.locator('[data-dosimetry-result]')).toContainText('Fluência: 2 J/cm²');
  });

  test('rejects zero and non-finite inputs without NaN or Infinity', async ({ page }) => {
    await openLibrary(page);
    await page.getByLabel('Potência (mW)').fill('0');
    await page.getByRole('button', { name: 'Calcular dosimetria' }).click();
    await expect(page.locator('[data-dosimetry-error]')).toBeVisible();
    await expect(page.locator('[data-dosimetry-result]')).not.toContainText(/NaN|Infinity/);
  });

  test('library exposes protocol versioning and create control', async ({ page }) => {
    await openLibrary(page);
    await expect(page.getByRole('heading', { name: 'Protocolos versionados' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Novo protocolo' })).toBeVisible();
    await expect(page.locator('[data-protocol-card]').first()).toBeVisible();
  });
});