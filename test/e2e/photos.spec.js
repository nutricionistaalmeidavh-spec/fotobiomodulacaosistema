import { test, expect } from '@playwright/test';

const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

async function openPhotos(page) {
  await page.goto('/');
  await page.locator('[data-nav="patients"]').click();
  await page.getByRole('searchbox', { name: 'Buscar pacientes' }).fill('Ana Martins');
  await page.getByRole('button', { name: 'Ana Martins', exact: true }).first().click();
  await page.getByRole('tab', { name: 'Fotos' }).click();
}

test.describe('Persisted F4 clinical images', () => {
  test('uploads and previews a permitted clinical photo after reload', async ({ page }) => {
    const region = 'Ombro E2E ' + Date.now();
    await openPhotos(page);
    await page.getByLabel('Arquivo da foto').setInputFiles({ name: 'ombro.png', mimeType: 'image/png', buffer: tinyPng });
    await page.getByLabel('Região fotografada').fill(region);
    await page.getByLabel('Observação da foto').fill('Fotografia armazenada no dispositivo clínico');
    await page.getByRole('button', { name: 'Enviar foto' }).click();
    const card = page.locator('[data-photo-record]').filter({ hasText: region });
    await expect(card).toBeVisible();
    await expect(card.locator('img.photo-preview')).toBeVisible();
    await page.reload();
    await page.locator('[data-nav="patients"]').click();
    await page.getByRole('searchbox', { name: 'Buscar pacientes' }).fill('Ana Martins');
    await page.getByRole('button', { name: 'Ana Martins', exact: true }).first().click();
    await page.getByRole('tab', { name: 'Fotos' }).click();
    await expect(page.locator('[data-photo-record]').filter({ hasText: region })).toBeVisible();
  });

  test('rejects executable/non-image files before upload', async ({ page }) => {
    await openPhotos(page);
    await page.getByLabel('Arquivo da foto').setInputFiles({
      name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('not image')
    });
    await page.getByLabel('Região fotografada').fill('Teste não permitido');
    await page.getByRole('button', { name: 'Enviar foto' }).click();
    await expect(page.getByRole('status').first()).toContainText(/imagem/i);
    await expect(page.locator('[data-photo-record]').filter({ hasText: 'Teste não permitido' })).toHaveCount(0);
  });
});