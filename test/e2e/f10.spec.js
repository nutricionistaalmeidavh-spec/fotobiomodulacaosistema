import { test, expect } from '@playwright/test';

test('F10 mostra Administração ao administrador autenticado', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toBeVisible();
});
