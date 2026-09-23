import { test, expect } from '@playwright/test';

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

  test('remaining planned primary routes render explicit nonblank boundaries', async ({ page }) => {
    await page.goto('/');
    for (const [route, title] of [['reports', 'Relatórios'], ['settings', 'Configurações']]) {
      await page.locator(`[data-nav="${route}"]`).click();
      await expect(page.getByRole('heading', { name: title, exact: true, level: 1 })).toBeVisible();
      await expect(page.locator(`[data-planned-route="${route}"]`)).toContainText(/sem simular persistência/i);
      await expect(page.locator(`[data-nav="${route}"]`)).toHaveAttribute('aria-current', 'page');
    }
  });

  test('desktop shell has no global horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('mobile navigation is keyboard reachable, closes after selection and has no shell overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const toggle = page.getByRole('button', { name: /Menu/ });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.focus();
    await expect(toggle).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('[data-nav="agenda"]')).toBeVisible();
    await page.locator('[data-nav="agenda"]').click();
    await expect(page.getByRole('heading', { name: 'Agenda', exact: true, level: 1 })).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByText(/somente local.*não persistido/i).first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
