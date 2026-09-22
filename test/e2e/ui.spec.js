import { test, expect } from '@playwright/test';

test('application smoke exposes the approved shell and F0 tools', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-app-ready', 'true');
  await expect(page.locator('[data-nav]')).toHaveText([
    'Dashboard', 'Pacientes', 'Agenda', 'Protocolos', 'Equipamentos', 'Relatórios', 'Configurações'
  ]);
  await expect(page.locator('[data-secondary-nav]')).toHaveText(['Sessões F0', 'Auditoria']);
  await expect(page.getByRole('heading', { name: 'Hoje na clínica' })).toBeVisible();
});
