import { test, expect } from '@playwright/test';

async function openProtocols(page) {
  await page.goto('/');
  await page.locator('[data-nav="protocols"]').click();
}

test.describe('UI-4 protocol dosimetry', () => {
  test('calculates energy and fluence transparently without recommending treatment', async ({ page }) => {
    await openProtocols(page);
    await expect(page.getByRole('heading', { name: 'Calculadora de dosimetria' })).toBeVisible();
    await page.getByLabel('Potência (mW)').fill('100');
    await page.getByLabel('Tempo (s)').fill('40');
    await page.getByLabel('Área (cm²)').fill('2');
    await page.getByRole('button', { name: 'Calcular dosimetria' }).click();
    const result = page.locator('[data-dosimetry-result]');
    await expect(result).toContainText('Energia: 4 J');
    await expect(result).toContainText('Fluência: 2 J/cm²');
    await expect(page.getByText(/não é recomendação clínica/i)).toBeVisible();
  });

  test('invalid zero input produces validation instead of NaN or Infinity', async ({ page }) => {
    await openProtocols(page);
    await page.getByLabel('Potência (mW)').fill('0');
    await page.getByRole('button', { name: 'Calcular dosimetria' }).click();
    await expect(page.locator('[data-dosimetry-error]')).toBeVisible();
    await expect(page.locator('[data-dosimetry-result]')).not.toContainText(/NaN|Infinity/);
  });

  test('versioned protocol library remains available beside the calculator', async ({ page }) => {
    await openProtocols(page);
    await expect(page.getByRole('heading', { name: 'Biblioteca clínica versionada' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Criar protocolo + v1' })).toBeVisible();
    await expect(page.getByText('Versionamento imutável', { exact: true })).toBeVisible();
  });
});
