import { test, expect } from '@playwright/test';

test('administrator can open Financeiro and Configurações without falling back to Dashboard', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.locator('[data-nav="finance"]').click();
  await expect(page.getByRole('heading', { name: 'Financeiro', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Pacotes' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Pagamentos' })).toBeVisible();

  await page.locator('[data-nav="settings"]').click();
  await expect(page.getByRole('heading', { name: 'Configurações', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Verificar integridade' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Criar backup' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('qa-desktop-settings.png'), fullPage: true });

  await page.getByRole('button', { name: 'Verificar integridade' }).click();
  await expect(page.getByText('Integridade verificada.', { exact: true })).toBeVisible();
});

test('patient tabs support keyboard navigation and clinical record remains visible', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.locator('[data-nav="patients"]').click();
  await page.getByRole('searchbox', { name: 'Buscar pacientes' }).fill('Ana Martins');
  await page.getByRole('button', { name: 'Ana Martins', exact: true }).first().click();
  const summary = page.getByRole('tab', { name: 'Resumo' });
  await summary.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Anamnese' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Anamnese' })).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('qa-desktop-patient.png'), fullPage: true });
});

test('responsive layout does not produce document overflow on narrow viewports', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-app-ready', 'true');
  await page.screenshot({ path: testInfo.outputPath('qa-mobile-dashboard.png'), fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
  await page.locator('[data-mobile-nav-toggle]').click();
  await page.locator('[data-nav="patients"]').click();
  await expect(page.getByRole('heading', { name: 'Pacientes', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('qa-mobile-patients.png'), fullPage: true });
  const patientsOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(patientsOverflow).toBeLessThanOrEqual(2);
});
