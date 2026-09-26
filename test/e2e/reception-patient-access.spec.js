import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:8788';
const EMPTY_STORAGE = { cookies: [], origins: [] };

async function loginReception(browser) {
  const context = await browser.newContext({ baseURL: BASE, storageState: EMPTY_STORAGE });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByLabel('E-mail').fill('reception-e2e@example.test');
  await page.getByLabel('Senha').fill('senha-e2e-recepcao-123');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.locator('body')).toHaveAttribute('data-app-ready', 'true');
  return { context, page };
}

test('reception edits patient demographics without loading clinical workspace', async ({ browser }) => {
  const { context, page } = await loginReception(browser);
  const clinicalRequests = [];
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname;
    if (/\/(workspace|timeline|outcomes|consents|media|sessions|protocols|equipment|documents)(?:\b|\/)/.test(pathname)) clinicalRequests.push(pathname);
  });

  try {
    await page.locator('[data-nav="patients"]').click();
    await expect(page.getByRole('heading', { name: 'Pacientes', exact: true })).toBeVisible();
    const row = page.locator('[data-patient-row]').filter({ hasText: 'Ana Martins' });
    await row.getByRole('button', { name: 'Editar cadastro de Ana Martins' }).click();

    const dialog = page.getByRole('dialog', { name: 'Editar paciente' });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Telefone').fill('(16) 98888-1212');
    await dialog.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(row).toContainText('(16) 98888-1212');

    await expect(row.getByRole('button', { name: 'Abrir prontuário de Ana Martins' })).toHaveCount(0);
    expect(clinicalRequests).toEqual([]);

    await page.reload();
    await page.locator('[data-nav="patients"]').click();
    const reloadedRow = page.locator('[data-patient-row]').filter({ hasText: 'Ana Martins' });
    await expect(reloadedRow).toContainText('(16) 98888-1212');
    expect(clinicalRequests).toEqual([]);
  } finally {
    await context.close();
  }
});
