import { test, expect } from '@playwright/test';

test('protocol workspace persists structured protocol, evidence link and deterministic clinical search', async ({ page }) => {
  const suffix = Date.now();
  const title = `Protocolo Ombro ${suffix}`;
  const evidenceTitle = `Revisão PBM ${suffix}`;

  await page.goto('/');
  await page.locator('[data-nav="protocols"]').click();
  await expect(page.getByRole('heading', { name: 'Protocolos', exact: true })).toBeVisible();

  await page.getByRole('tab', { name: 'Biblioteca' }).click();
  await page.getByRole('button', { name: 'Novo protocolo' }).click();
  const protocolDialog = page.getByRole('dialog', { name: 'Novo protocolo' });
  await protocolDialog.getByLabel('Título').fill(title);
  await protocolDialog.getByLabel('Resumo da versão').fill('Versão inicial estruturada');
  await protocolDialog.getByLabel('Condição').fill('Tendinopatia do ombro');
  await protocolDialog.getByLabel('Região corporal').fill('Ombro');
  await protocolDialog.getByLabel('Objetivo terapêutico').fill('Modulação de dor');
  await protocolDialog.getByLabel('Área profissional').fill('Fisioterapia');
  await protocolDialog.getByLabel('Idade mínima').fill('18');
  await protocolDialog.getByRole('button', { name: 'Salvar protocolo' }).click();
  await expect(page.getByText(title, { exact: true })).toBeVisible();

  await page.getByRole('tab', { name: 'Evidências' }).click();
  await page.getByRole('button', { name: 'Nova evidência' }).click();
  const evidenceDialog = page.getByRole('dialog', { name: 'Nova evidência' });
  await evidenceDialog.getByLabel('Título').fill(evidenceTitle);
  await evidenceDialog.getByLabel('Autores').fill('Silva et al.');
  await evidenceDialog.getByLabel('Ano').fill('2026');
  await evidenceDialog.getByLabel('Tipo de publicação').fill('revisão sistemática');
  await evidenceDialog.getByLabel('Nível de evidência').fill('revisão');
  await evidenceDialog.getByLabel('Resumo').fill('Síntese científica cadastrada localmente.');
  await evidenceDialog.getByRole('button', { name: 'Salvar evidência' }).click();
  await expect(page.getByText(evidenceTitle, { exact: true })).toBeVisible();

  const protocolCard = page.locator('[data-protocol-card]').filter({ hasText: title });
  await protocolCard.getByRole('button', { name: 'Vincular evidência' }).click();
  const linkDialog = page.getByRole('dialog', { name: 'Vincular evidência' });
  await linkDialog.getByLabel('Evidência').selectOption({ label: evidenceTitle });
  await linkDialog.getByLabel('Nota do vínculo').fill('Associada à versão inicial.');
  await linkDialog.getByRole('button', { name: 'Confirmar vínculo' }).click();
  await expect(protocolCard).toContainText(evidenceTitle);
  await expect(protocolCard).toContainText(/v1/);

  await page.getByRole('tab', { name: 'Busca clínica' }).click();
  await page.getByLabel('Condição clínica').fill('Tendinopatia');
  await page.getByLabel('Região corporal').fill('Ombro');
  await page.getByLabel('Área profissional').fill('Fisioterapia');
  await page.getByLabel('Idade').fill('35');
  await page.getByRole('button', { name: 'Buscar protocolos' }).click();
  const results = page.locator('[data-clinical-search-results]');
  await expect(results).toContainText(title);
  await expect(results).not.toContainText(/score|ranking|melhor protocolo|recomendado automaticamente/i);
  await expect(page.getByText(/não recomenda protocolo ou dose automaticamente/i)).toBeVisible();

  await page.reload();
  await page.locator('[data-nav="protocols"]').click();
  await page.getByRole('tab', { name: 'Evidências' }).click();
  await expect(page.getByText(evidenceTitle, { exact: true })).toBeVisible();
});
