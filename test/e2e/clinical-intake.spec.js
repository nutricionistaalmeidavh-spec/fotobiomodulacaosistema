import { test, expect } from '@playwright/test';

async function openPatient(page) {
  await page.goto('/');
  await page.locator('[data-nav="patients"]').click();
  await page.getByRole('searchbox', { name: 'Buscar pacientes' }).fill('Carlos Menezes');
  await page.getByRole('button', { name: 'Carlos Menezes', exact: true }).first().click();
}

test.describe('F1 anamnesis, persistent C09 and F4 consents', () => {
  test('anamnesis includes typed clinical fields and six safety checkpoints', async ({ page }) => {
    await openPatient(page);
    await page.getByRole('tab', { name: 'Anamnese' }).click();
    for (const label of ['Queixa principal', 'Histórico clínico', 'Medicações informadas', 'Alergias', 'Precauções', 'Dor (0–10)']) {
      await expect(page.getByLabel(label, { exact: true })).toBeVisible();
    }
    await expect(page.locator('[data-c09-checklist] [data-safety-key]')).toHaveCount(6);
  });

  test('anamnesis and safety review persist through reload', async ({ page }) => {
    const complaint = 'Queixa persistente ' + Date.now();
    await openPatient(page);
    await page.getByRole('tab', { name: 'Anamnese' }).click();
    await page.getByLabel('Queixa principal').fill(complaint);
    await page.getByRole('button', { name: 'Salvar anamnese' }).click();
    await expect(page.getByRole('status').first()).toContainText(/Anamnese salva/);
    for (const input of await page.locator('[data-c09-checklist] [data-safety-key]').all()) await input.check();
    await page.getByRole('button', { name: 'Registrar revisão de segurança' }).click();
    await expect(page.getByRole('status').first()).toContainText(/Revisão C09 registrada/);
    await page.reload();
    await page.locator('[data-nav="patients"]').click();
    await page.getByRole('searchbox', { name: 'Buscar pacientes' }).fill('Carlos Menezes');
    await page.getByRole('button', { name: 'Carlos Menezes', exact: true }).first().click();
    await page.getByRole('tab', { name: 'Anamnese' }).click();
    await expect(page.getByLabel('Queixa principal')).toHaveValue(complaint);
    await expect(page.locator('[data-c09-checklist] [data-safety-key]:checked')).toHaveCount(6);
  });

  test('consent is versioned and recorded without claiming digital signature', async ({ page }) => {
    await openPatient(page);
    await page.getByRole('tab', { name: 'Consentimentos' }).click();
    await expect(page.getByRole('heading', { name: 'Consentimento informado' })).toBeVisible();
    await expect(page.getByText(/não afirma assinatura digital/i)).toBeVisible();
    await page.getByRole('button', { name: 'Registrar aceite' }).click();
    await expect(page.getByText('Aceito', { exact: true }).first()).toBeVisible();
    await expect(page.locator('[data-consent-history] [data-consent-record]').first()).toBeVisible();
  });
});