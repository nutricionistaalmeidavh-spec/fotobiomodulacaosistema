import { test, expect } from '@playwright/test';

async function openReports(page) {
  await page.goto('/');
  await page.locator('[data-nav="reports"]').click();
  await expect(page.getByRole('heading', { name: 'Relatórios operacionais' })).toBeVisible();
}

test.describe('Persisted F9 operational and finance reports', () => {
  test('renders canonical operational and financial totals from the gateway', async ({ page }) => {
    await openReports(page);
    for (const key of ['sessions', 'patients-attended', 'appointments', 'protocols-used',
      'outcomes', 'received-cents', 'pending-cents']) {
      await expect(page.locator('[data-report-metric="' + key + '"]')).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'Agendamentos por situação' })).toBeVisible();
    await expect(page.getByText(/Dados do banco local/)).toBeVisible();
  });

  test('inverted period displays clear validation while retaining the navigation', async ({ page }) => {
    await openReports(page);
    await page.getByLabel('Período de').fill('2026-10-22');
    await page.getByLabel('Período até').fill('2026-10-20');
    await page.getByRole('button', { name: 'Aplicar período' }).click();
    await expect(page.getByRole('alert')).toContainText(/Período inválido/i);
    await expect(page.locator('[data-nav="reports"]')).toHaveAttribute('aria-current', 'page');
  });
});