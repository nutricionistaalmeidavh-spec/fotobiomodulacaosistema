import { test, expect } from '@playwright/test';

test('audited protocol creation is filterable through persistent F10 gateway', async ({ page }) => {
  const create = await page.request.post('/api/protocols', {
    data: { title: 'Auditoria clínica ' + Date.now(), changeSummary: 'Registro rastreável' }
  });
  expect(create.status()).toBe(201);
  await page.goto('/');
  await page.locator('[data-secondary-nav="audit"]').click();
  await expect(page.getByRole('heading', { name: 'Auditoria clínica' })).toBeVisible();
  await expect(page.getByText('Cadeia íntegra', { exact: true })).toBeVisible();
  await page.getByLabel('Filtrar ação').selectOption('protocol.created');
  const auditEvent = page.locator('[data-audit-event]').filter({ hasText: 'protocol.created' }).first();
  await expect(auditEvent).toContainText(/hash/i);
});