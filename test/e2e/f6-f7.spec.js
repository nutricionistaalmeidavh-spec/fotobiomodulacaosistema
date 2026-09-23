import { test, expect } from '@playwright/test';

const EMAIL = 'e2e@localhost.test';
const PASSWORD = 'senha-e2e-segura';

async function login(page) {
  await page.goto('/');
  await expect(page.locator('[data-auth-login]')).toBeVisible();
  await page.locator('[name="login-email"]').fill(EMAIL);
  await page.locator('[name="login-password"]').fill(PASSWORD);
  await page.locator('[data-login-submit]').click();
  await expect(page.locator('body')).toHaveAttribute('data-app-ready', 'true');
}

test('F6 vincula evidência científica e F7 registra ponto anatômico sem recomendação automática', async ({ page }) => {
  await login(page);

  await page.locator('[data-nav="protocols"]').click();
  await expect(page.locator('[data-f6-evidence]')).toBeVisible();

  await page.locator('[name="f6-title"]').fill('Evidência F6 E2E');
  await page.locator('[name="f6-authors"]').fill('Equipe E2E');
  await page.locator('[name="f6-year"]').fill('2025');
  await page.locator('[name="f6-study-type"]').selectOption('systematic_review');
  await page.locator('[name="f6-doi"]').fill('10.1000/f6.e2e');
  await page.locator('[name="f6-conditions"]').fill('cervicalgia');
  await page.locator('[name="f6-regions"]').fill('cervical');
  await page.locator('[name="f6-wavelengths"]').fill('808');
  await page.locator('[data-create-evidence-f6]').click();
  await expect(page.locator('[data-f6-feedback]')).toContainText('Referência científica registrada');

  await page.locator('[name="f6-search"]').fill('cervical');
  await page.locator('[data-search-evidence-f6]').click();
  await expect(page.locator('[data-f6-evidence-item]').filter({ hasText: 'Evidência F6 E2E' })).toBeVisible();

  const versionId = await page.locator('[name="f6-link-version"] option').filter({ hasText: 'Cervicalgia F2 E2E' }).first().getAttribute('value');
  const evidenceId = await page.locator('[name="f6-link-evidence"] option').filter({ hasText: 'Evidência F6 E2E' }).getAttribute('value');
  expect(versionId).toBeTruthy();
  expect(evidenceId).toBeTruthy();
  await page.locator('[name="f6-link-version"]').selectOption(versionId);
  await page.locator('[name="f6-link-evidence"]').selectOption(evidenceId);
  await page.locator('[name="f6-link-relation"]').selectOption('supports');
  await page.locator('[name="f6-link-note"]').fill('Vínculo documental E2E');
  await page.locator('[data-link-evidence-f6]').click();
  await expect(page.locator('[data-f6-link-feedback]')).toContainText('Evidência vinculada à versão exata do protocolo');
  await expect(page.locator('[data-f6-linked-item]').filter({ hasText: 'Evidência F6 E2E' })).toBeVisible();

  const evidenceText = await page.locator('[data-f6-evidence]').innerText();
  expect(evidenceText).toMatch(/não modifica parâmetros|não recomenda dose/i);

  await page.locator('[data-nav="patients"]').click();
  await page.locator('[data-patient-row]').filter({ hasText: 'Paciente MVP F4' }).getByRole('button', { name: 'Abrir' }).click();
  const bodyMap = page.locator('[data-f7-body-map]:visible').last();
  await expect(bodyMap).toBeVisible();
  await expect(bodyMap.locator('[name="f7-session"] option')).not.toHaveCount(0);

  await bodyMap.locator('[name="f7-view"]').selectOption('posterior');
  await bodyMap.locator('[name="f7-laterality"]').selectOption('midline');
  await bodyMap.locator('[data-body-region-id="cervical"]').click();
  await expect(bodyMap.locator('[data-f7-marker]')).toBeVisible();
  await bodyMap.locator('[name="f7-label"]').fill('C4-C5 E2E');
  await bodyMap.locator('[data-record-body-map-f7]').click();
  await expect(bodyMap.locator('[data-f7-feedback]')).toContainText('Ponto anatômico registrado na sessão');
  await expect(bodyMap.locator('[data-f7-point-item]').filter({ hasText: 'C4-C5 E2E' })).toBeVisible();

  const mapText = await bodyMap.innerText();
  expect(mapText).toMatch(/não sugere dose, protocolo ou conduta/i);

  await page.reload();
  await page.locator('[data-nav="patients"]').click();
  await page.locator('[data-patient-row]').filter({ hasText: 'Paciente MVP F4' }).getByRole('button', { name: 'Abrir' }).click();
  const reloadedBodyMap = page.locator('[data-f7-body-map]:visible').last();
  await expect(reloadedBodyMap.locator('[data-f7-point-item]').filter({ hasText: 'C4-C5 E2E' })).toBeVisible();

  await page.locator('[data-nav="audit"]').click();
  for (const action of ['evidence.created', 'protocol_evidence.linked', 'body_map_point.recorded']) {
    await expect(page.getByText(action, { exact: true }).first()).toBeVisible();
  }
});
