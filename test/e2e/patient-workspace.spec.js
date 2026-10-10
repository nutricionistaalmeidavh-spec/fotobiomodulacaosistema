import { test, expect } from '@playwright/test';

async function openPatient(page) {
  await page.goto('/');
  await page.locator('[data-nav="patients"]').click();
  await page.getByRole('searchbox', { name: 'Buscar pacientes' }).fill('Carlos Menezes');
  await page.getByRole('button', { name: 'Carlos Menezes', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Carlos Menezes', exact: true })).toBeVisible();
}

test.describe('Canonical persisted patient workspace', () => {
  test('keeps identity and all eight professional tabs visible', async ({ page }) => {
    await openPatient(page);
    await expect(page.getByRole('tablist', { name: 'Navegação do paciente' }).getByRole('tab')).toHaveText([
      'Resumo', 'Anamnese', 'Protocolos', 'Sessões', 'Evolução', 'Fotos', 'Documentos', 'Consentimentos'
    ]);
    await expect(page.locator('.patient-context-header')).toContainText('carlos.menezes@example.test');
    await expect(page.locator('[data-nav="patients"]')).toHaveAttribute('aria-current', 'page');
  });

  test('summary represents true clinical records instead of old mock warnings', async ({ page }) => {
    await openPatient(page);
    await expect(page.getByRole('heading', { name: 'Visão geral clínica' })).toBeVisible();
    await expect(page.getByText('Última sessão', { exact: false })).toBeVisible();
    await expect(page.getByText('Próxima sessão', { exact: false })).toBeVisible();
    await expect(page.getByText('Protocolo atual', { exact: false })).toBeVisible();
  });

  test('all patient tabs render meaningful clinical content', async ({ page }) => {
    await openPatient(page);
    const expected = [
      ['Anamnese', 'Anamnese clínica'], ['Protocolos', 'Protocolo em uso'],
      ['Sessões', 'Sessão'], ['Evolução', 'Registrar evolução'],
      ['Fotos', 'Adicionar foto clínica'], ['Documentos', 'PDF'],
      ['Consentimentos', 'Consentimento informado']
    ];
    for (const [tab, visibleText] of expected) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      await expect(page.getByRole('tabpanel')).toContainText(visibleText);
    }
    await page.getByRole('tab', { name: 'Resumo' }).click();
    await expect(page.getByRole('tabpanel')).toContainText('Visão geral clínica');
  });

  test('back returns to the same patient directory', async ({ page }) => {
    await openPatient(page);
    await page.getByRole('button', { name: 'Voltar para pacientes' }).click();
    await expect(page.getByRole('heading', { name: 'Pacientes', exact: true })).toBeVisible();
    await expect(page.locator('[data-nav="patients"]')).toHaveAttribute('aria-current', 'page');
  });
});