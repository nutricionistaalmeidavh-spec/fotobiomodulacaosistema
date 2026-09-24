import { test, expect } from '@playwright/test';

const EMAIL = 'e2e@localhost.test';
const PASSWORD = 'senha-e2e-segura';

async function login(page) {
  await page.goto('/');
  await page.locator('[name="login-email"]').fill(EMAIL);
  await page.locator('[name="login-password"]').fill(PASSWORD);
  await page.locator('[data-login-submit]').click();
  await expect(page.locator('body')).toHaveAttribute('data-app-ready', 'true');
}

test('F10 mostra administração, integridade e backup ao administrador', async ({ page }) => {
  await login(page);
  await expect(page.locator('[data-phase-badge]')).toHaveText('F10 concluída');
  await expect(page.locator('[data-nav="admin"]')).toBeVisible();
  await page.locator('[data-nav="admin"]').click();
  const admin = page.locator('[data-f10-admin]');
  await expect(admin).toBeVisible();
  await expect(admin.locator('[data-f10-account]').first()).toBeVisible();
  await admin.locator('[data-check-integrity-f10]').click();
  await expect(admin.locator('[data-f10-integrity]')).toContainText('Integridade OK');
  await admin.locator('[data-create-backup-f10]').click();
  await expect(admin.locator('[data-f10-backup]')).toContainText('Backup verificado');
});
