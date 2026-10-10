import { test, expect } from '@playwright/test';

async function openPatients(page) {
  await page.goto('/');
  await page.locator('[data-nav="patients"]').click();
  await expect(page.getByRole('heading', { name: 'Pacientes', exact: true })).toBeVisible();
}

test.describe('Persisted F1 patient directory', () => {
  test('searches accent-insensitively and displays an intentional empty state', async ({ page }) => {
    await openPatients(page);
    const search = page.getByRole('searchbox', { name: 'Buscar pacientes' });
    await search.fill('Carlos Menezes');
    await expect(page.locator('[data-patient-row]')).toHaveCount(1);
    await search.fill('paciente-inexistente-999999');
    await expect(page.getByText('Nenhum paciente encontrado', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Limpar busca' }).click();
    await expect(search).toHaveValue('');
    await expect(page.getByText('Ana Martins', { exact: true }).first()).toBeVisible();
  });

  test('typing keeps patient search focused', async ({ page }) => {
    await openPatients(page);
    const search = page.getByRole('searchbox', { name: 'Buscar pacientes' });
    await search.focus();
    await page.keyboard.type('Carlos');
    await expect(search).toHaveValue('Carlos');
    await expect(search).toBeFocused();
    await expect(page.locator('[data-patient-row]')).toHaveCount(1);
  });

  test('patient registration is persisted and escapes untrusted markup', async ({ page }) => {
    const fullName = '<img src=x onerror=window.__xss=1> ' + Date.now();
    await openPatients(page);
    await page.getByRole('button', { name: 'Novo paciente' }).click();
    const dialog = page.getByRole('dialog', { name: 'Novo paciente' });
    await dialog.getByRole('button', { name: 'Salvar paciente' }).click();
    await expect(dialog.getByText('Informe o nome do paciente.')).toBeVisible();
    await dialog.getByLabel('Nome').fill(fullName);
    await dialog.getByLabel('E-mail').fill('seguro-' + Date.now() + '@example.test');
    await dialog.getByRole('button', { name: 'Salvar paciente' }).click();
    await expect(dialog).toBeHidden();
    const search = page.getByRole('searchbox', { name: 'Buscar pacientes' });
    await search.fill(fullName);
    await expect(page.getByText(fullName, { exact: true }).first()).toBeVisible();
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    await page.reload();
    await page.locator('[data-nav="patients"]').click();
    await page.getByRole('searchbox', { name: 'Buscar pacientes' }).fill(fullName);
    await expect(page.getByText(fullName, { exact: true }).first()).toBeVisible();
  });

  test('cancel and close preserve the existing patient collection', async ({ page }) => {
    await openPatients(page);
    await page.getByRole('button', { name: 'Novo paciente' }).click();
    const dialog = page.getByRole('dialog', { name: 'Novo paciente' });
    await dialog.getByLabel('Nome').fill('Rascunho não salvo ' + Date.now());
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).toBeHidden();
    await page.getByRole('button', { name: 'Novo paciente' }).click();
    await page.getByRole('dialog', { name: 'Novo paciente' }).getByRole('button', { name: 'Fechar' }).click();
    await expect(page.getByRole('dialog', { name: 'Novo paciente' })).toBeHidden();
  });
});