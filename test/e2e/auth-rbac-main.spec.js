import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:8788';

async function loginAs(browser, email, password) {
  const context = await browser.newContext({ baseURL: BASE });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Entrar', exact: true })).toBeVisible();
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.locator('body')).toHaveAttribute('data-app-ready', 'true');
  return { context, page };
}

test.describe('F10 auth and RBAC on canonical main UI', () => {
  test('admin session enters the preserved main chrome with all current routes', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toHaveAttribute('data-app-ready', 'true');
    await expect(page.getByText(/Admin E2E · admin/)).toBeVisible();
    for (const route of ['patients', 'agenda', 'protocols', 'equipment', 'reports', 'settings']) {
      await expect(page.locator(`[data-nav="${route}"]`)).toBeVisible();
    }
    await expect(page.locator('[data-secondary-nav="sessions"]')).toBeVisible();
    await expect(page.locator('[data-secondary-nav="audit"]')).toBeVisible();
  });

  test('professional receives clinical routes without finance, audit or admin routes', async ({ browser }) => {
    const { context, page } = await loginAs(browser, 'professional-e2e@example.test', 'senha-e2e-prof-123');
    try {
      for (const route of ['patients', 'agenda', 'protocols', 'equipment']) {
        await expect(page.locator(`[data-nav="${route}"]`)).toBeVisible();
      }
      await expect(page.locator('[data-secondary-nav="sessions"]')).toBeVisible();
      await expect(page.locator('[data-nav="reports"]')).toHaveCount(0);
      await expect(page.locator('[data-nav="settings"]')).toHaveCount(0);
      await expect(page.locator('[data-secondary-nav="audit"]')).toHaveCount(0);
      const forbidden = await page.request.get('/api/reports/operations');
      expect(forbidden.status()).toBe(403);
    } finally {
      await context.close();
    }
  });

  test('reception loads administrative patient directory without clinical requests', async ({ browser }) => {
    const { context, page } = await loginAs(browser, 'reception-e2e@example.test', 'senha-e2e-recepcao-123');
    const clinicalRequests = [];
    page.on('request', (request) => {
      if (/\/(workspace|timeline|outcomes|consents|media|sessions|protocols|equipment)(?:\b|\/)/.test(new URL(request.url()).pathname)) {
        clinicalRequests.push(new URL(request.url()).pathname);
      }
    });
    try {
      await expect(page.locator('[data-nav="patients"]')).toBeVisible();
      await expect(page.locator('[data-nav="agenda"]')).toBeVisible();
      await expect(page.locator('[data-nav="reports"]')).toBeVisible();
      for (const route of ['protocols', 'equipment', 'settings']) await expect(page.locator(`[data-nav="${route}"]`)).toHaveCount(0);
      await expect(page.locator('[data-secondary-nav="sessions"]')).toHaveCount(0);
      await expect(page.locator('[data-secondary-nav="audit"]')).toHaveCount(0);

      await page.locator('[data-nav="patients"]').click();
      await expect(page.getByRole('heading', { name: 'Pacientes', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Ana Martins', exact: true }).click();
      await expect(page.getByText('Seu perfil pode acessar o cadastro administrativo, mas não o prontuário clínico.')).toBeVisible();
      expect(clinicalRequests).toEqual([]);

      expect((await page.request.get('/api/audit')).status()).toBe(403);
      expect((await page.request.get('/api/protocols')).status()).toBe(403);
    } finally {
      await context.close();
    }
  });

  test('logout returns to login and revoked session cannot reopen the app', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Sair', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Entrar', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Entrar', exact: true })).toBeVisible();
  });
});
