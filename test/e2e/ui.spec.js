import { test, expect } from '@playwright/test';

test.describe('Fotobiomodulação F0 UI', () => {
  test('expõe todas as áreas concluídas da fundação na navegação e no dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toHaveAttribute('data-app-ready', 'true');
    await expect(page.locator('[data-nav]')).toHaveText([
      'Dashboard', 'Pacientes', 'Protocolos', 'Equipamentos', 'Sessões', 'Auditoria'
    ]);
    await expect(page.getByText('F0 concluída', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('19 tabelas', { exact: true })).toBeVisible();
    await expect(page.getByText('Versionamento imutável', { exact: true })).toBeVisible();
    await expect(page.getByText('Planejado ≠ aplicado', { exact: true })).toBeVisible();
    await expect(page.getByText('Auditoria append-only', { exact: true })).toBeVisible();
  });

  test('cria protocolo e acrescenta v2 sem oferecer edição de versões antigas', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-nav="protocols"]').click();
    await page.locator('[name="protocol-title"]').fill('Dor cervical E2E');
    await page.locator('[name="protocol-summary"]').fill('Versão inicial E2E');
    await page.locator('[data-create-protocol]').click();
    await expect(page.getByText('Dor cervical E2E', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('v1', { exact: false }).first()).toBeVisible();
    await page.locator('[name="version-summary"]').fill('Ajuste documental E2E');
    await page.locator('[data-create-version]').click();
    await expect(page.getByText('Ajuste documental E2E', { exact: false })).toBeVisible();
    await expect(page.getByText('v2', { exact: false }).first()).toBeVisible();
    await expect(page.locator('[data-edit-protocol-version]')).toHaveCount(0);
  });

  test('bloqueia parâmetros aplicados diferentes sem justificativa e registra com justificativa', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-nav="sessions"]').click();
    await page.locator('[name="planned-energy"]').fill('4');
    await page.locator('[name="applied-energy"]').fill('5');
    await page.locator('[name="adjustment-reason"]').fill('');
    await page.locator('[data-create-session]').click();
    await expect(page.getByText(/Informe o motivo profissional/i)).toBeVisible();
    await page.locator('[name="adjustment-reason"]').fill('Resposta clínica observada E2E');
    await page.locator('[data-create-session]').click();
    await expect(page.getByText('Resposta clínica observada E2E', { exact: false })).toBeVisible();
    await expect(page.getByText(/Aplicado: 5 J/i)).toBeVisible();
  });

  test('mostra cadeia de auditoria íntegra após ações na UI', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-nav="protocols"]').click();
    await page.locator('[name="protocol-title"]').fill('Protocolo auditável E2E');
    await page.locator('[name="protocol-summary"]').fill('Criação auditável E2E');
    await page.locator('[data-create-protocol]').click();
    await expect(page.getByText('Protocolo auditável E2E', { exact: true }).first()).toBeVisible();
    await page.locator('[data-nav="audit"]').click();
    await expect(page.getByText('Cadeia íntegra', { exact: true })).toBeVisible();
    await expect(page.getByText('protocol.created', { exact: true }).first()).toBeVisible();
  });

  test('mantém todos os módulos alcançáveis em viewport mobile sem estourar a página', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.locator('body')).toHaveAttribute('data-app-ready', 'true');
    await expect(page.locator('[data-nav]')).toHaveCount(6);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
