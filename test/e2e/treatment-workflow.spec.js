import { test, expect } from '@playwright/test';

async function openSessions(page) {
  await page.goto('/');
  await page.locator('[data-secondary-nav="sessions"]').click();
}

test.describe('Guided safety and real PBM session flow', () => {
  test('exposes all five stages while retaining separate planned/applied energy fields', async ({ page }) => {
    await openSessions(page);
    for (const label of ['Planejamento', 'Segurança', 'Aplicação', 'Registro', 'Evolução']) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
    await page.getByRole('button', { name: 'Planejamento' }).click();
    await page.getByLabel('Energia planejada (J)').fill('3.4');
    await page.getByRole('button', { name: 'Segurança' }).click();
    await expect(page.locator('[data-session-safety]')).toHaveCount(6);
    await page.getByRole('button', { name: 'Aplicação' }).click();
    await expect(page.getByLabel('Energia aplicada (J)')).toHaveValue('4');
    await page.getByRole('button', { name: 'Planejamento' }).click();
    await expect(page.getByLabel('Energia planejada (J)')).toHaveValue('3.4');
  });

  test('applied dose mismatch requires a professional justification before write', async ({ page }) => {
    await openSessions(page);
    await page.getByRole('button', { name: 'Aplicação' }).click();
    await page.getByLabel('Energia aplicada (J)').fill('5');
    await page.getByRole('button', { name: 'Registro' }).click();
    await page.getByRole('button', { name: 'Registrar sessão' }).click();
    await expect(page.getByRole('status')).toContainText(/motivo profissional/i);
  });

  test('session safety checklist is required and non-automatic', async ({ page }) => {
    await openSessions(page);
    await page.getByRole('button', { name: 'Segurança' }).click();
    await expect(page.locator('[data-session-safety]')).toHaveCount(6);
    await expect(page.getByText(/decisão clínica permanece exclusivamente profissional/i)).toBeVisible();
    await page.getByRole('button', { name: 'Registro' }).click();
    await page.getByRole('button', { name: 'Registrar sessão' }).click();
    await expect(page.getByRole('status')).toContainText(/Revise e confirme os seis itens/i);
  });
});