import { test, expect } from '@playwright/test';

async function openRoute(page, route) {
  const primary = page.locator(`[data-nav="${route}"]`);
  if (await primary.count()) {
    await primary.click();
    return;
  }
  await page.locator(`[data-secondary-nav="${route}"]`).click();
}

test('persisted audit remains filterable through the gateway', async ({ page }) => {
  await page.goto('/');
  await openRoute(page, 'protocols');
  await page.locator('[name="protocol-title"]').fill('Auditoria gateway E2E');
  await page.locator('[name="protocol-summary"]').fill('Evento para filtro auditável');
  await page.locator('[data-create-protocol]').click();
  await expect(page.getByText('Auditoria gateway E2E', { exact: true }).first()).toBeVisible();

  await openRoute(page, 'audit');
  await expect(page.getByRole('heading', { name: 'Auditoria clínica', exact: true, level: 1 })).toBeVisible();
  await expect(page.getByText('Cadeia íntegra', { exact: true })).toBeVisible();
  await page.getByLabel('Filtrar ação').selectOption('protocol.created');

  const event = page.locator('[data-audit-event]').filter({ hasText: 'protocol.created' }).first();
  await expect(event).toBeVisible();
  await expect(event).toContainText('protocol');
  await expect(event).toContainText(/hash/i);
});
