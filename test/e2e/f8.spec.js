import { test, expect } from '@playwright/test';

const EMAIL = 'e2e@localhost.test';
const PASSWORD = 'senha-e2e-segura';

async function login(page) {
  await page.goto('/');
  await expect(page.locator('[data-auth-login]')).toBeVisible();
  await page.locator('[name="login-email"]').fill(EMAIL);
  await page.locator('[name="login-password"]').fill(PASSWORD);
  await page.locator('[data-login-submit]').click();
  await expect(page.locator('body')).toHaveAttribute('data-app-ready', 'true');
}

test('F8 oferece busca clínica avançada determinística e revisão de precauções', async ({ page }) => {
  await login(page);
  await page.locator('[data-nav="protocols"]').click();

  const engine = page.locator('[data-f8-engine]');
  await expect(engine).toBeVisible();
  await expect(engine).toContainText(/decisão.*profissional|não recomenda/i);

  await engine.locator('[name="f8-query"]').fill('cervical');
  await engine.locator('[name="f8-age"]').fill('45');
  await engine.locator('[data-search-f8]').click();

  await expect(engine.locator('[data-f8-result]').first()).toBeVisible();
  await expect(engine.locator('[data-f8-result]').first()).toContainText(/cervical/i);
  await expect(engine).not.toContainText(/score terapêutico|melhor protocolo|recomendado automaticamente/i);
});
