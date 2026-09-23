import { test, expect } from '@playwright/test';

async function openReports(page) {
  await page.goto('/');
  await page.locator('[data-nav="reports"]').click();
  await expect(page.getByRole('heading', { name: 'Relatórios operacionais', exact: true, level: 1 })).toBeVisible();
}

test.describe('UI-8 reports', () => {
  test('renders descriptive operational metrics through the gateway', async ({ page }) => {
    await openReports(page);
    await expect(page.locator('[data-planned-route="reports"]')).toHaveCount(0);
    await expect(page.getByText('Sessões no período', { exact: true })).toBeVisible();
    await expect(page.getByText('Pacientes ativos', { exact: true })).toBeVisible();
    await expect(page.getByText('Retornos pendentes', { exact: true })).toBeVisible();
    await expect(page.getByText('Divergências planejado × aplicado', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Uso por protocolo', exact: true })).toBeVisible();
    await expect(page.getByText(/descritivo.*não.*recomendação/i)).toBeVisible();
  });

  test('invalid period renders validation without breaking navigation', async ({ page }) => {
    await openReports(page);
    await page.getByLabel('Período de').fill('2026-09-22');
    await page.getByLabel('Período até').fill('2026-09-20');
    await page.getByRole('button', { name: 'Aplicar período' }).click();
    await expect(page.getByText(/Período inválido/i)).toBeVisible();
    await expect(page.locator('[data-nav="reports"]')).toHaveAttribute('aria-current', 'page');
  });
});
