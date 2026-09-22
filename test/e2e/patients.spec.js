import { test, expect } from '@playwright/test';

async function openPatients(page) {
  await page.goto('/');
  await page.locator('[data-nav="patients"]').click();
  await expect(page.getByRole('heading', { name: 'Pacientes' })).toBeVisible();
}

test.describe('UI-1 Patients', () => {
  test('lists fixtures, searches and exposes an intentional empty state', async ({ page }) => {
    await openPatients(page);
    await expect(page.getByText('Ana Martins', { exact: true })).toBeVisible();
    await expect(page.getByText('Carlos Menezes', { exact: true })).toBeVisible();
    await expect(page.getByText('Marina Rocha', { exact: true })).toBeVisible();

    const search = page.getByRole('searchbox', { name: 'Buscar pacientes' });
    await search.fill('Carlos');
    await expect(page.locator('[data-patient-row]')).toHaveCount(1);
    await expect(page.getByText('Carlos Menezes', { exact: true })).toBeVisible();

    await search.fill('zzzz-sem-match');
    await expect(page.getByText('Nenhum paciente encontrado', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Limpar busca' }).click();
    await expect(search).toHaveValue('');
    await expect(page.locator('[data-patient-row]')).toHaveCount(3);
  });

  test('keeps search focused while typing character by character', async ({ page }) => {
    await openPatients(page);
    const search = page.getByRole('searchbox', { name: 'Buscar pacientes' });
    await search.focus();
    await page.keyboard.type('Carlos');
    await expect(search).toHaveValue('Carlos');
    await expect(search).toBeFocused();
    await expect(page.locator('[data-patient-row]')).toHaveCount(1);
  });

  test('validates create dialog and creates only local mock data', async ({ page }) => {
    await openPatients(page);
    await page.getByRole('button', { name: 'Novo paciente' }).click();
    const dialog = page.getByRole('dialog', { name: 'Novo paciente' });
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: 'Salvar paciente' }).click();
    await expect(dialog.getByText('Informe o nome do paciente.', { exact: true })).toBeVisible();
    await expect(dialog.getByLabel('Nome')).toBeFocused();

    const literalName = '<img src=x onerror=window.__xss=1>';
    await dialog.getByLabel('Nome').fill(literalName);
    await dialog.getByLabel('E-mail').fill('seguro@example.test');
    await dialog.getByRole('button', { name: 'Salvar paciente' }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText(literalName, { exact: true })).toBeVisible();
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  });

  test('dialog can be cancelled and closed without mutating the list', async ({ page }) => {
    await openPatients(page);
    await page.getByRole('button', { name: 'Novo paciente' }).click();
    const dialog = page.getByRole('dialog', { name: 'Novo paciente' });
    await dialog.getByLabel('Nome').fill('Não deve ser criado');
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('Não deve ser criado', { exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'Novo paciente' }).click();
    await page.getByRole('dialog', { name: 'Novo paciente' }).getByRole('button', { name: 'Fechar' }).click();
    await expect(page.getByRole('dialog', { name: 'Novo paciente' })).toBeHidden();
  });
});
