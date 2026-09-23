import { test, expect } from '@playwright/test';

async function openCarlosWorkspace(page) {
  await page.goto('/');
  await page.locator('[data-nav="patients"]').click();
  await page.getByRole('button', { name: 'Carlos Menezes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Carlos Menezes', exact: true })).toBeVisible();
}

test.describe('UI-2 patient workspace', () => {
  test('keeps patient identity visible and exposes all approved local tabs', async ({ page }) => {
    await openCarlosWorkspace(page);
    const tablist = page.getByRole('tablist', { name: 'Navegação do paciente' });
    await expect(tablist.getByRole('tab')).toHaveText([
      'Resumo', 'Anamnese', 'Protocolos', 'Sessões', 'Evolução', 'Fotos', 'Documentos', 'Consentimentos'
    ]);
    await expect(page.locator('[data-nav="patients"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.patient-context-header').getByText('carlos.menezes@example.test', { exact: true })).toBeVisible();
  });

  test('summary shows clinical warning, current protocol, pending work and timeline', async ({ page }) => {
    await openCarlosWorkspace(page);
    await expect(page.getByRole('alert')).toContainText('medicação fotossensibilizante');
    await expect(page.getByText('Tendinopatia de ombro · v4', { exact: true })).toBeVisible();
    await expect(page.getByText('Confirmar atualização medicamentosa', { exact: true })).toBeVisible();
    await expect(page.getByText('Alerta clínico registrado', { exact: true })).toBeVisible();
    await expect(page.getByText('18/09/2026 · 14:10', { exact: true })).toBeVisible();
    await expect(page.getByText('30/09/2026 · 15:30', { exact: true })).toBeVisible();
  });

  test('switches every workspace tab without blank content', async ({ page }) => {
    await openCarlosWorkspace(page);
    const expected = [
      ['Anamnese', 'Anamnese clínica'],
      ['Protocolos', 'Protocolo em uso'],
      ['Sessões', 'Sessões do paciente'],
      ['Evolução', 'Adicionar evolução'],
      ['Fotos', 'Nenhuma foto registrada'],
      ['Documentos', 'Nenhum documento registrado'],
      ['Consentimentos', 'Nenhum consentimento registrado']
    ];
    for (const [tab, visibleText] of expected) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      await expect(page.getByRole('tabpanel')).toContainText(visibleText);
    }
    await page.getByRole('tab', { name: 'Resumo', exact: true }).click();
    await expect(page.getByRole('tabpanel')).toContainText('Visão geral clínica');
  });

  test('returns to patient directory preserving the global Patients context', async ({ page }) => {
    await openCarlosWorkspace(page);
    await page.getByRole('button', { name: 'Voltar para pacientes' }).click();
    await expect(page.getByRole('heading', { name: 'Pacientes', exact: true })).toBeVisible();
    await expect(page.locator('[data-nav="patients"]')).toHaveAttribute('aria-current', 'page');
  });
});
