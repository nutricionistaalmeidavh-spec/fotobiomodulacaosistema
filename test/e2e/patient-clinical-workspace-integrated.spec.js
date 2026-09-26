import { test, expect } from '@playwright/test';

async function openPatients(page) {
  await page.goto('/');
  await page.locator('[data-nav="patients"]').click();
  await expect(page.getByRole('heading', { name: 'Pacientes', exact: true })).toBeVisible();
}

async function openPatientByName(page, name) {
  await page.getByRole('searchbox', { name: 'Buscar pacientes' }).fill(name);
  await page.getByRole('button', { name, exact: true }).first().click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
}

test('patient clinical workspace persists F1/F4/F5 records through reload', async ({ page }) => {
  const suffix = Date.now();
  const patientName = `Paciente Integrado ${suffix}`;
  const patientEmail = `integrado-${suffix}@example.test`;

  await openPatients(page);
  await page.getByRole('button', { name: 'Novo paciente' }).click();
  const dialog = page.getByRole('dialog', { name: 'Novo paciente' });
  await dialog.getByLabel('Nome').fill(patientName);
  await dialog.getByLabel('E-mail').fill(patientEmail);
  await dialog.getByLabel('Telefone').fill('(16) 99999-0001');
  await dialog.getByRole('button', { name: 'Salvar paciente' }).click();
  await expect(page.getByText(patientName, { exact: true })).toBeVisible();

  await openPatientByName(page, patientName);

  await page.getByRole('tab', { name: 'Anamnese' }).click();
  await page.getByLabel('Queixa principal').fill('Dor no ombro direito');
  await page.getByLabel('Histórico clínico').fill('Sintomas há três semanas.');
  await page.getByLabel('Medicações informadas').fill('Nenhuma');
  await page.getByLabel('Alergias').fill('Sem alergias conhecidas');
  await page.getByRole('textbox', { name: 'Precauções', exact: true }).fill('Reavaliar sensibilidade local');
  await page.getByLabel('Dor (0–10)').fill('6');
  await page.getByRole('button', { name: 'Salvar anamnese' }).click();
  await expect(page.getByText(/Anamnese salva no prontuário/)).toBeVisible();

  await page.getByRole('tab', { name: 'Consentimentos' }).click();
  await page.getByRole('button', { name: 'Registrar aceite' }).click();
  await expect(page.getByText('Aceito', { exact: true }).first()).toBeVisible();

  await page.getByRole('tab', { name: 'Evolução' }).click();
  await page.getByLabel('Tipo de desfecho').selectOption('vas_pain');
  await page.getByLabel('Valor').fill('6');
  await page.getByLabel('Narrativa').fill('Linha de base antes do ciclo.');
  await page.getByRole('button', { name: 'Registrar evolução' }).click();
  await expect(page.getByText(/VAS dor/i).first()).toBeVisible();

  await page.getByRole('tab', { name: 'Fotos' }).click();
  await page.getByLabel('Arquivo da foto').setInputFiles({
    name: 'ombro.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
  });
  await page.getByLabel('Região fotografada').fill('Ombro direito');
  await page.getByLabel('Observação da foto').fill('Vista anterior');
  await page.getByRole('button', { name: 'Enviar foto' }).click();
  await expect(page.getByText('Ombro direito', { exact: true })).toBeVisible();
  await expect(page.getByText(/Persistido/).first()).toBeVisible();

  await page.getByRole('tab', { name: 'Documentos' }).click();
  await expect(page.getByLabel('Atendimento para PDF')).toBeVisible();
  await page.getByRole('button', { name: 'Gerar PDF do atendimento' }).click();
  await expect(page.getByText(/PDF do atendimento/i).first()).toBeVisible();

  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-app-ready', 'true');
  await page.locator('[data-nav="patients"]').click();
  await openPatientByName(page, patientName);

  await page.getByRole('tab', { name: 'Anamnese' }).click();
  await expect(page.getByLabel('Queixa principal')).toHaveValue('Dor no ombro direito');
  await expect(page.getByLabel('Alergias')).toHaveValue('Sem alergias conhecidas');
  await expect(page.getByLabel('Dor (0–10)')).toHaveValue('6');

  await page.getByRole('tab', { name: 'Consentimentos' }).click();
  await expect(page.getByText('Aceito', { exact: true }).first()).toBeVisible();

  await page.getByRole('tab', { name: 'Evolução' }).click();
  await expect(page.getByText('Linha de base antes do ciclo.', { exact: true })).toBeVisible();

  await page.getByRole('tab', { name: 'Fotos' }).click();
  await expect(page.getByText('Ombro direito', { exact: true })).toBeVisible();

  await page.getByRole('tab', { name: 'Documentos' }).click();
  await expect(page.getByText(/PDF do atendimento/i).first()).toBeVisible();
});
