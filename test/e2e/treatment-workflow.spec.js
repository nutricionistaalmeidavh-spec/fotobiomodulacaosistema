import { test, expect } from '@playwright/test';

async function openSessions(page) {
  await page.goto('/');
  await page.locator('[data-secondary-nav="sessions"]').click();
}

test.describe('UI-6 guided treatment workflow', () => {
  test('shows five stages and navigates without losing the session form', async ({ page }) => {
    await openSessions(page);
    const stages = ['Planejamento', 'Segurança', 'Aplicação', 'Registro', 'Evolução'];
    for (const label of stages) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
    await page.getByRole('button', { name: 'Segurança', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Segurança pré-sessão' })).toBeVisible();
    await page.getByRole('button', { name: 'Aplicação', exact: true }).click();
    await expect(page.getByLabel('Energia aplicada (J)')).toBeVisible();
    await page.getByRole('button', { name: 'Registro', exact: true }).click();
    await expect(page.getByLabel('Motivo profissional do ajuste')).toBeVisible();
  });

  test('real session write still requires professional adjustment reason', async ({ page }) => {
    await openSessions(page);
    await page.getByRole('button', { name: 'Planejamento', exact: true }).click();
    await page.getByLabel('Energia planejada (J)').fill('4');
    await page.getByRole('button', { name: 'Aplicação', exact: true }).click();
    await page.getByLabel('Energia aplicada (J)').fill('5');
    await page.getByRole('button', { name: 'Registro', exact: true }).click();
    await page.getByLabel('Motivo profissional do ajuste').fill('');
    await page.getByRole('button', { name: 'Registrar sessão' }).click();
    await expect(page.getByText(/Informe o motivo profissional/i)).toBeVisible();
    await page.getByLabel('Motivo profissional do ajuste').fill('Ajuste documentado no atendimento E2E');
    await page.getByRole('button', { name: 'Registrar sessão' }).click();
    await expect(page.getByText(/Sessão registrada com parâmetros planejados e aplicados separados/i)).toBeVisible();
    await page.getByRole('button', { name: 'Evolução', exact: true }).click();
    await expect(page.getByText('Ajuste documentado no atendimento E2E', { exact: false })).toBeVisible();
  });

  test('evolution stage exposes persisted F0 session history', async ({ page }) => {
    await openSessions(page);
    await page.getByRole('button', { name: 'Registro', exact: true }).click();
    await page.getByRole('button', { name: 'Registrar sessão' }).click();
    await expect(page.getByText(/Sessão registrada com parâmetros planejados e aplicados separados/i)).toBeVisible();
    await page.getByRole('button', { name: 'Evolução', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Histórico de sessões' })).toBeVisible();
    await expect(page.getByText(/Planejado: 4 J/).first()).toBeVisible();
  });
});
