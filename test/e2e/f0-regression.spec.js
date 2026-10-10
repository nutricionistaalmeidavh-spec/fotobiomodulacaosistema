import { test, expect } from '@playwright/test';

test.describe('F0 invariants retained by F10 runtime', () => {
  test('protocol version history remains immutable and exact', async ({ page }) => {
    const title = 'Versões E2E ' + Date.now();
    const response = await page.request.post('/api/protocols', { data: { title, changeSummary: 'Original' } });
    expect(response.status()).toBe(201);
    const created = (await response.json()).protocol;
    const version = created.versions[0];
    const next = await page.request.post('/api/protocols/' + created.id + '/versions', {
      data: { changeSummary: 'Revisão documentada', parameters: version.parameters || {} }
    });
    expect(next.status()).toBe(201);
    await page.goto('/');
    await page.locator('[data-nav="protocols"]').click();
    await expect(page.locator('[data-protocol-card]').filter({ hasText: title })).toContainText(/v2/i);
    const payload = await (await page.request.get('/api/protocols')).json();
    const stored = payload.protocols.find(p => p.id === created.id);
    expect(stored.versions.map(v => v.versionNumber)).toEqual([1, 2]);
    expect(stored.versions[0].id).toBe(version.id);
  });

  test('planned versus applied divergence cannot be saved without a professional reason', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-secondary-nav="sessions"]').click();
    await page.getByRole('button', { name: 'Planejamento', exact: true }).click();
    await page.getByLabel('Energia planejada (J)').fill('4');
    await page.getByRole('button', { name: 'Aplicação', exact: true }).click();
    await page.getByLabel('Energia aplicada (J)').fill('5');
    await page.getByRole('button', { name: 'Registro', exact: true }).click();
    await page.getByRole('button', { name: 'Registrar sessão' }).click();
    await expect(page.getByRole('status')).toContainText(/motivo profissional/i);
  });

  test('audit remains verifiable and records clinical protocol creation', async ({ page }) => {
    const title = 'Auditoria E2E ' + Date.now();
    const created = await page.request.post('/api/protocols', { data: { title, changeSummary: 'Auditada' } });
    expect(created.status()).toBe(201);
    await page.goto('/');
    await page.locator('[data-secondary-nav="audit"]').click();
    await expect(page.getByText('Cadeia íntegra', { exact: true })).toBeVisible();
    await expect(page.locator('[data-audit-event]').filter({ hasText: 'protocol.created' }).first()).toBeVisible();
  });
});