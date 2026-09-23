import { test, expect } from '@playwright/test';

async function expectNoGlobalOverflow(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe('UI foundation and operational dashboard', () => {
  test('loads without runtime errors and exposes operational metrics and recent activity', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto('/');
    await expect(page.locator('body')).toHaveAttribute('data-app-ready', 'true');
    await expect(page.getByRole('heading', { name: 'Hoje na clínica' })).toBeVisible();
    await expect(page.getByText('Sessões hoje', { exact: true })).toBeVisible();
    await expect(page.getByText('Pacientes ativos', { exact: true })).toBeVisible();
    await expect(page.getByText('Retornos pendentes', { exact: true })).toBeVisible();
    await expect(page.getByText('Protocolos recentes', { exact: true })).toBeVisible();
    await expect(page.getByText('Sessão concluída', { exact: true }).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('quick action navigates to Patients through application routing', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Ver pacientes' }).click();
    await expect(page.getByRole('heading', { name: 'Pacientes' })).toBeVisible();
    await expect(page.locator('[data-nav="patients"]')).toHaveAttribute('aria-current', 'page');
  });

  test('remaining planned primary route renders an explicit nonblank boundary', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-nav="settings"]').click();
    await expect(page.getByRole('heading', { name: 'Configurações', exact: true, level: 1 })).toBeVisible();
    await expect(page.locator('[data-planned-route="settings"]')).toContainText(/sem simular persistência/i);
    await expect(page.locator('[data-nav="settings"]')).toHaveAttribute('aria-current', 'page');
  });

  test('desktop traverses implemented primary and F0 routes without overflow', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    for (const route of ['dashboard', 'patients', 'agenda', 'protocols', 'equipment', 'reports']) {
      await page.locator(`[data-nav="${route}"]`).click();
      await expect(page.locator(`[data-nav="${route}"]`)).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('#view')).not.toBeEmpty();
      await expectNoGlobalOverflow(page);
    }
    for (const route of ['sessions', 'audit']) {
      await page.locator(`[data-secondary-nav="${route}"]`).click();
      await expect(page.locator(`[data-secondary-nav="${route}"]`)).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('#view')).not.toBeEmpty();
      await expectNoGlobalOverflow(page);
    }
  });

  test('patient workspace exposes Evolution and Photos in the final route traversal', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-nav="patients"]').click();
    await page.getByRole('button', { name: 'Carlos Menezes', exact: true }).click();
    for (const tab of ['Evolução', 'Fotos']) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      await expect(page.getByRole('tabpanel')).not.toBeEmpty();
      await expectNoGlobalOverflow(page);
    }
  });

  test('mobile navigation traverses all primary routes by keyboard-safe menu without overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const toggle = page.getByRole('button', { name: /Menu/ });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.focus();
    await expect(toggle).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    for (const route of ['dashboard', 'patients', 'agenda', 'protocols', 'equipment', 'reports', 'settings']) {
      if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
      await expect(page.locator(`[data-nav="${route}"]`)).toBeVisible();
      await page.locator(`[data-nav="${route}"]`).click();
      await expect(page.locator(`[data-nav="${route}"]`)).toHaveAttribute('aria-current', 'page');
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('#view')).not.toBeEmpty();
      await expectNoGlobalOverflow(page);
    }
  });
});
