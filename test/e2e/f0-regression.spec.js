import { test, expect } from '@playwright/test';

async function openRoute(page, route) {
  const direct = page.locator(`[data-nav="${route}"]`);
  if (await direct.count()) {
    await direct.click();
    return;
  }
  await page.locator(`[data-secondary-nav="${route}"]`).click();
}

test.describe('F0 regressions after UI foundation refactor', () => {
  test('protocol versions remain append-only', async ({ page }) => {
    await page.goto('/');
    await openRoute(page, 'protocols');
    await page.locator('[name="protocol-title"]').fill('Dor cervical E2E');
    await page.locator('[name="protocol-summary"]').fill('Versão inicial E2E');
    await page.locator('[data-create-protocol]').click();
    await expect(page.getByText('Dor cervical E2E', { exact: true }).first()).toBeVisible();
    await page.locator('[name="version-summary"]').fill('Ajuste documental E2E');
    await page.locator('[data-create-version]').click();
    await expect(page.getByText('Ajuste documental E2E', { exact: false })).toBeVisible();
    await expect(page.getByText('v2', { exact: false }).first()).toBeVisible();
    await expect(page.locator('[data-edit-protocol-version]')).toHaveCount(0);
  });

  test('session adjustment still requires a professional reason', async ({ page }) => {
    await page.goto('/');
    await openRoute(page, 'sessions');
    await page.locator('[name="planned-energy"]').fill('4');
    await page.locator('[name="applied-energy"]').fill('5');
    await page.locator('[name="adjustment-reason"]').fill('');
    await page.locator('[data-create-session]').click();
    await expect(page.getByText(/Informe o motivo profissional/i)).toBeVisible();
    await page.locator('[name="adjustment-reason"]').fill('Resposta clínica observada E2E');
    await page.locator('[data-create-session]').click();
    await expect(page.getByText('Resposta clínica observada E2E', { exact: false })).toBeVisible();
    await expect(page.getByText(/Aplicado: 5 J/i)).toBeVisible();
  });

  test('audit chain remains valid after a real UI write', async ({ page }) => {
    await page.goto('/');
    await openRoute(page, 'protocols');
    await page.locator('[name="protocol-title"]').fill('Protocolo auditável E2E');
    await page.locator('[name="protocol-summary"]').fill('Criação auditável E2E');
    await page.locator('[data-create-protocol]').click();
    await expect(page.getByText('Protocolo auditável E2E', { exact: true }).first()).toBeVisible();
    await openRoute(page, 'audit');
    await expect(page.getByText('Cadeia íntegra', { exact: true })).toBeVisible();
    await expect(page.getByText('protocol.created', { exact: true }).first()).toBeVisible();
  });
});
