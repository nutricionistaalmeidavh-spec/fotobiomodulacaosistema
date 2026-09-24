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

test.describe.serial('Regressão clínica base sob composição atual', () => {
  test('setup e login locais continuam disponíveis', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-auth-setup]')).toBeVisible();
    await page.locator('[name="setup-name"]').fill('Profissional E2E');
    await page.locator('[name="setup-email"]').fill(EMAIL);
    await page.locator('[name="setup-password"]').fill(PASSWORD);
    await page.locator('[data-setup-submit]').click();
    await expect(page.locator('body')).toHaveAttribute('data-app-ready', 'true');
    await expect(page.locator('[data-phase-badge]')).toHaveText(/F(?:8|9|10) concluída/);
    await page.locator('[data-logout]').click();
    await expect(page.locator('[data-auth-login]')).toBeVisible();
    await login(page);
  });

  test('paciente, anamnese, sessão e histórico F1 permanecem funcionais', async ({ page }) => {
    await login(page);
    await page.locator('[data-nav="patients"]').click();
    await page.locator('[name="patient-name"]').fill('Paciente E2E');
    await page.locator('[data-create-patient]').click();
    await page.locator('[name="encounter-chief-complaint"]').fill('Dor cervical E2E');
    await page.locator('[name="encounter-pain-score"]').fill('7');
    await page.locator('[data-start-encounter]').click();
    await expect(page.getByText('Dor cervical E2E', { exact: false }).first()).toBeVisible();

    await page.locator('[data-nav="sessions"]').click();
    const encounterValue = await page.locator('[name="session-encounter"] option').filter({ hasText: 'Paciente E2E' }).getAttribute('value');
    await page.locator('[name="session-encounter"]').selectOption(encounterValue);
    await page.locator('[name="planned-energy"]').fill('4');
    await page.locator('[name="applied-energy"]').fill('5');
    await page.locator('[name="adjustment-reason"]').fill('Ajuste E2E');
    await page.locator('[data-create-session]').click();

    await page.locator('[data-nav="patients"]').click();
    await page.locator('[data-patient-row]').filter({ hasText: 'Paciente E2E' }).getByRole('button', { name: 'Abrir' }).click();
    await expect(page.getByText(/Aplicado: 5 J/i)).toBeVisible();
  });

  test('módulos e invariantes F0 continuam presentes sem congelar quantidade de menus', async ({ page }) => {
    await login(page);
    for (const label of ['Dashboard', 'Pacientes', 'Protocolos', 'Equipamentos', 'Sessões', 'Auditoria']) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
    const counter = page.getByText(/\d+ tabelas/, { exact: true }).first();
    await expect(counter).toBeVisible();
    const count = Number((await counter.innerText()).match(/\d+/)?.[0] || 0);
    expect(count).toBeGreaterThanOrEqual(23);
    await expect(page.getByText('Versionamento imutável', { exact: true })).toBeVisible();
    await expect(page.getByText('Planejado ≠ aplicado', { exact: true })).toBeVisible();
    await expect(page.getByText('Auditoria append-only', { exact: true })).toBeVisible();
  });

  test('F2 mantém dosimetria e filtro clínico estruturado', async ({ page }) => {
    await login(page);
    await page.locator('[data-nav="protocols"]').click();
    await page.locator('[name="protocol-title"]').fill('Cervicalgia F2 E2E');
    await page.locator('[name="protocol-summary"]').fill('Versão estruturada F2');
    await page.locator('[name="protocol-condition"]').fill('Cervicalgia');
    await page.locator('[name="protocol-symptom"]').fill('Dor cervical');
    await page.locator('[name="protocol-body-region"]').fill('Cervical');
    await page.locator('[name="protocol-goal"]').fill('Analgesia');
    await page.locator('[name="protocol-clinical-phase"]').fill('aguda');
    await page.locator('[name="protocol-wavelength"]').fill('808');
    await page.locator('[name="protocol-power"]').fill('100');
    await page.locator('[name="protocol-time"]').fill('40');
    await page.locator('[name="protocol-area"]').fill('0.5');
    await page.locator('[name="protocol-mode"]').selectOption('continuous');
    await page.locator('[name="protocol-points"]').fill('4');
    await page.locator('[name="protocol-technique"]').fill('contact');
    await expect(page.locator('[data-dosimetry-energy]')).toHaveText('4 J');
    await expect(page.locator('[data-dosimetry-fluence]')).toHaveText('8 J/cm²');
    await page.locator('[data-create-protocol]').click();
    await page.locator('[name="filter-symptom"]').fill('dor cervical');
    await page.locator('[data-filter-protocols]').click();
    await expect(page.locator('[data-protocol-card]').filter({ hasText: 'Cervicalgia F2 E2E' })).toBeVisible();
  });

  test('F3 mantém equipamento e adaptação separada do protocolo de referência', async ({ page }) => {
    await login(page);
    await page.locator('[data-nav="equipment"]').click();
    await page.locator('[name="equipment-manufacturer"]').fill('ArtiSys Test');
    await page.locator('[name="equipment-model"]').fill('Laser F3');
    await page.locator('[data-create-equipment-f3]').click();
    const equipmentValue = await page.locator('[name="applicator-equipment"] option').filter({ hasText: 'Laser F3' }).getAttribute('value');
    await page.locator('[name="applicator-equipment"]').selectOption(equipmentValue);
    await page.locator('[name="applicator-name"]').fill('Ponteira 808 F3');
    await page.locator('[name="applicator-wavelength"]').fill('808');
    await page.locator('[name="applicator-fixed-power"]').fill('200');
    await page.locator('[name="applicator-area"]').fill('0.5');
    await page.locator('[name="applicator-mode"]').selectOption('continuous');
    await page.locator('[data-create-applicator-f3]').click();

    await page.locator('[data-nav="protocols"]').click();
    const versionValue = await page.locator('[name="adaptation-protocol-version"] option').filter({ hasText: 'Cervicalgia F2 E2E' }).getAttribute('value');
    const applicatorValue = await page.locator('[name="adaptation-applicator"] option').filter({ hasText: 'Ponteira 808 F3' }).getAttribute('value');
    await page.locator('[name="adaptation-protocol-version"]').selectOption(versionValue);
    await page.locator('[name="adaptation-applicator"]').selectOption(applicatorValue);
    await page.locator('[data-preview-adaptation]').click();
    await expect(page.locator('[data-adaptation-reference]')).toContainText('40 s');
    await expect(page.locator('[data-adaptation-derived]')).toContainText('20 s');
  });

  test('auditoria e mobile continuam íntegros', async ({ page }) => {
    await login(page);
    await page.locator('[data-nav="audit"]').click();
    await expect(page.getByText('Cadeia íntegra', { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.locator('[data-nav]').count()).toBeGreaterThanOrEqual(6);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
