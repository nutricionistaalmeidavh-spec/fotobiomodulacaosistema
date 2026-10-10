import { test, expect } from '@playwright/test';

test('application shell exposes all implemented clinical and financial modules', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-app-ready', 'true');
  await expect(page.locator('[data-nav]')).toHaveText([
    'Dashboard', 'Pacientes', 'Agenda', 'Protocolos', 'Equipamentos',
    'Financeiro', 'Relatórios', 'Configurações'
  ]);
  await expect(page.locator('[data-secondary-nav]')).toHaveText(['Sessões', 'Auditoria']);
  await expect(page.getByRole('heading', { name: 'Hoje na clínica' })).toBeVisible();
});