import { test, expect } from '@playwright/test';

async function openAnaEvolution(page) {
  await page.goto('/');
  await page.locator('[data-nav="patients"]').click();
  await page.getByRole('button', { name: 'Ana Martins', exact: true }).click();
  await page.getByRole('tab', { name: 'Evolução' }).click();
}

test.describe('UI-7 evolution', () => {
  test('adds and filters local evolution without claiming persistence', async ({ page }) => {
    await openAnaEvolution(page);
    await page.getByLabel('Título da evolução').fill('Reavaliação funcional E2E');
    await page.getByLabel('Data da evolução').fill('2026-09-22');
    await page.getByLabel('Categoria da evolução').selectOption('assessment');
    await page.getByLabel('Observações da evolução').fill('Registro descritivo sem interpretação automática.');
    await page.getByRole('button', { name: 'Adicionar evolução' }).click();
    await expect(page.getByText('Reavaliação funcional E2E')).toBeVisible();
    await expect(page.getByText(/Somente local|não persistido/i).first()).toBeVisible();
    await page.getByLabel('Filtrar categoria').selectOption('session');
    await expect(page.getByText('Reavaliação funcional E2E')).toBeHidden();
  });

  test('evolution keeps an intentional empty state when filters have no matches', async ({ page }) => {
    await openAnaEvolution(page);
    await page.getByLabel('Filtrar categoria').selectOption('assessment');
    await page.getByLabel('Filtrar de').fill('2027-01-01');
    await expect(page.getByText(/Nenhuma evolução encontrada/i)).toBeVisible();
  });
});
