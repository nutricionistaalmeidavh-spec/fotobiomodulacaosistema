import { test, expect } from '@playwright/test';

async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
}

test.describe('Canonical responsive clinical shell', () => {
  test('dashboard uses persistent operational indicators without browser exceptions', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await expect(page.locator('body')).toHaveAttribute('data-app-ready', 'true');
    await expect(page.getByRole('heading', { name: 'Hoje na clínica' })).toBeVisible();
    for (const label of ['Sessões hoje', 'Pacientes ativos', 'Retornos pendentes', 'Protocolos cadastrados']) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    expect(errors).toEqual([]);
  });

  test('quick action opens patient directory through the canonical router', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Ver pacientes' }).click();
    await expect(page.getByRole('heading', { name: 'Pacientes' })).toBeVisible();
    await expect(page.locator('[data-nav="patients"]')).toHaveAttribute('aria-current', 'page');
  });

  test('settings is an operational administrator module, not an empty placeholder', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-nav="settings"]').click();
    await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Verificar integridade' })).toBeVisible();
    await expect(page.locator('[data-planned-route="settings"]')).toHaveCount(0);
  });

  test('desktop traverses all implemented primary and secondary routes without overflow', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    for (const route of ['dashboard', 'patients', 'agenda', 'protocols', 'equipment', 'finance', 'reports', 'settings']) {
      await page.locator('[data-nav="' + route + '"]').click();
      await expect(page.locator('[data-nav="' + route + '"]')).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('#view')).not.toBeEmpty();
      await noOverflow(page);
    }
    for (const route of ['sessions', 'audit']) {
      await page.locator('[data-secondary-nav="' + route + '"]').click();
      await expect(page.locator('#view')).not.toBeEmpty();
      await noOverflow(page);
    }
  });

  test('patient workspace renders longitudinal evolution and clinical photos tabs', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-nav="patients"]').click();
    await page.getByRole('searchbox', { name: 'Buscar pacientes' }).fill('Carlos Menezes');
    await page.getByRole('button', { name: 'Carlos Menezes', exact: true }).first().click();
    for (const tab of ['Evolução', 'Fotos']) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      await expect(page.getByRole('tabpanel')).not.toBeEmpty();
      await noOverflow(page);
    }
  });

  test('mobile keyboard menu traverses all authorized sections', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const toggle = page.getByRole('button', { name: /Menu/ });
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    for (const route of ['dashboard', 'patients', 'agenda', 'protocols', 'equipment', 'finance', 'reports', 'settings']) {
      if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
      await page.locator('[data-nav="' + route + '"]').click();
      await expect(page.locator('[data-nav="' + route + '"]')).toHaveAttribute('aria-current', 'page');
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await noOverflow(page);
    }
  });
});