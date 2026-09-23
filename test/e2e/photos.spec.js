import { test, expect } from '@playwright/test';

const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQMcAAAAASUVORK5CYII=', 'base64');

async function openAnaPhotos(page) {
  await page.goto('/');
  await page.locator('[data-nav="patients"]').click();
  await page.getByRole('button', { name: 'Ana Martins', exact: true }).click();
  await page.getByRole('tab', { name: 'Fotos' }).click();
}

test.describe('UI-7 photos', () => {
  test('adds local photo preview metadata and removes only after confirmation', async ({ page }) => {
    await openAnaPhotos(page);
    await page.getByLabel('Arquivo da foto').setInputFiles({ name: 'ombro.png', mimeType: 'image/png', buffer: tinyPng });
    await page.getByLabel('Região fotografada').fill('Ombro direito');
    await page.getByLabel('Data da foto').fill('2026-09-22');
    await page.getByLabel('Observação da foto').fill('Vista anterior E2E');
    await page.getByRole('button', { name: 'Adicionar foto local' }).click();

    await expect(page.getByText('Ombro direito', { exact: true })).toBeVisible();
    await expect(page.getByText(/Pré-visualização local · não enviada ao backend/i)).toBeVisible();
    await expect(page.locator('img[alt*="Ombro direito"]')).toBeVisible();

    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByRole('button', { name: /Remover foto Ombro direito/i }).click();
    await expect(page.getByText('Ombro direito', { exact: true })).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: /Remover foto Ombro direito/i }).click();
    await expect(page.getByText(/Nenhuma foto registrada/i)).toBeVisible();
  });

  test('rejects a non-image file without creating metadata', async ({ page }) => {
    await openAnaPhotos(page);
    await page.getByLabel('Arquivo da foto').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') });
    await page.getByLabel('Região fotografada').fill('Ombro direito');
    await page.getByRole('button', { name: 'Adicionar foto local' }).click();
    await expect(page.getByRole('status')).toContainText(/imagem/i);
    await expect(page.getByText('Ombro direito', { exact: true })).toHaveCount(0);
  });
});
