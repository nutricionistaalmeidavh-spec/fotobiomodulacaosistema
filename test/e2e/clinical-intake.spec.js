import { test, expect } from '@playwright/test';

async function openCarlosWorkspace(page) {
  await page.goto('/');
  await page.locator('[data-nav="patients"]').click();
  await page.getByRole('button', { name: 'Carlos Menezes', exact: true }).click();
}

test.describe('UI-3 clinical intake', () => {
  test('anamnesis has structured local draft fields and C09 safety checklist', async ({ page }) => {
    await openCarlosWorkspace(page);
    await page.getByRole('tab', { name: 'Anamnese', exact: true }).click();
    const panel = page.getByRole('tabpanel');
    await expect(panel.getByLabel('Queixa principal')).toBeVisible();
    await expect(panel.getByLabel('Objetivo do atendimento')).toBeVisible();
    await expect(panel.getByLabel('Medicações informadas')).toBeVisible();
    await expect(panel.getByText(/não persistido/i)).toBeVisible();
    await expect(panel.getByRole('heading', { name: 'Checklist de segurança pré-sessão' })).toBeVisible();
    await expect(panel.getByLabel('Confirmação profissional')).toBeVisible();
  });

  test('anamnesis draft updates only local UI state', async ({ page }) => {
    await openCarlosWorkspace(page);
    await page.getByRole('tab', { name: 'Anamnese', exact: true }).click();
    const complaint = page.getByLabel('Queixa principal');
    await complaint.fill('Queixa alterada somente na interface');
    await page.getByRole('button', { name: 'Salvar rascunho local' }).click();
    await expect(page.getByText(/rascunho local atualizado/i)).toBeVisible();
    await expect(complaint).toHaveValue('Queixa alterada somente na interface');
  });

  test('consent exposes explicit local simulation state', async ({ page }) => {
    await openCarlosWorkspace(page);
    await page.getByRole('tab', { name: 'Consentimentos', exact: true }).click();
    const panel = page.getByRole('tabpanel');
    await expect(panel.getByRole('heading', { name: 'Consentimento informado' })).toBeVisible();
    await expect(panel.getByText('Pendente', { exact: true })).toBeVisible();
    await expect(panel.getByText(/registro local/i)).toBeVisible();
    await page.getByRole('button', { name: 'Simular consentimento coletado' }).click();
    await expect(panel.getByText('Coletado localmente', { exact: true })).toBeVisible();
  });
});
