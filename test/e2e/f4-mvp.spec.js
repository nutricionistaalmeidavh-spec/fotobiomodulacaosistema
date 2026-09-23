import { test, expect } from '@playwright/test';

const EMAIL = 'e2e@localhost.test';
const PASSWORD = 'senha-e2e-segura';
const ONE_PIXEL_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=';

async function login(page) {
  await page.goto('/');
  await expect(page.locator('[data-auth-login]')).toBeVisible();
  await page.locator('[name="login-email"]').fill(EMAIL);
  await page.locator('[name="login-password"]').fill(PASSWORD);
  await page.locator('[data-login-submit]').click();
  await expect(page.locator('body')).toHaveAttribute('data-app-ready', 'true');
}

test('F4 fecha o MVP clínico e F5 registra evolução longitudinal sem inferir causalidade', async ({ page }) => {
  await login(page);

  await page.locator('[data-nav="patients"]').click();
  await page.locator('[name="patient-name"]').fill('Paciente MVP F4');
  await page.locator('[name="patient-notes"]').fill('Fluxo integral F4');
  await page.locator('[data-create-patient]').click();
  await expect(page.locator('[data-patient-workspace]')).toBeVisible();
  await expect(page.locator('[data-f4-clinical-tools]')).toBeVisible();

  await page.locator('[name="consent-version"]').fill('1.0');
  await page.locator('[data-accept-consent-f4]').click();
  await expect(page.locator('[data-f4-consent-history]')).toContainText('accepted');

  await page.locator('[name="encounter-chief-complaint"]').fill('Dor cervical MVP F4');
  await page.locator('[name="encounter-pain-score"]').fill('6');
  await page.locator('[name="encounter-notes"]').fill('Atendimento MVP F4');
  await page.locator('[data-start-encounter]').click();
  await expect(page.getByText('Dor cervical MVP F4', { exact: false }).first()).toBeVisible();

  await page.locator('[data-nav="protocols"]').click();
  const versionValue = await page.locator('[name="adaptation-protocol-version"] option').filter({ hasText: 'Cervicalgia F2 E2E' }).getAttribute('value');
  const applicatorValue = await page.locator('[name="adaptation-applicator"] option').filter({ hasText: 'Ponteira 808 F3' }).getAttribute('value');
  expect(versionValue).toBeTruthy();
  expect(applicatorValue).toBeTruthy();
  await page.locator('[name="adaptation-protocol-version"]').selectOption(versionValue);
  await page.locator('[name="adaptation-applicator"]').selectOption(applicatorValue);
  await page.locator('[data-preview-adaptation]').click();
  await expect(page.locator('[data-adaptation-reference]')).toContainText('40 s');
  await expect(page.locator('[data-adaptation-derived]')).toContainText('20 s');

  await page.locator('[data-nav="sessions"]').click();
  const encounterValue = await page.locator('[name="session-encounter"] option').filter({ hasText: 'Paciente MVP F4' }).getAttribute('value');
  expect(encounterValue).toBeTruthy();
  await page.locator('[name="session-encounter"]').selectOption(encounterValue);
  await page.locator('[name="session-protocol-version"]').selectOption(versionValue);
  await page.locator('[name="planned-energy"]').fill('4');
  await page.locator('[name="applied-energy"]').fill('4');
  await page.locator('[data-create-session]').click();

  await page.locator('[data-nav="patients"]').click();
  await page.locator('[data-patient-row]').filter({ hasText: 'Paciente MVP F4' }).getByRole('button', { name: 'Abrir' }).click();
  await expect(page.locator('[data-f4-clinical-tools]')).toBeVisible();
  await expect(page.locator('[data-patient-workspace]').getByText('Sessão PBM', { exact: false }).first()).toBeVisible();

  const sessionValue = await page.locator('[name="point-session"] option').first().getAttribute('value');
  expect(sessionValue).toBeTruthy();
  await page.locator('[name="point-session"]').selectOption(sessionValue);
  await page.locator('[name="point-sequence"]').fill('1');
  await page.locator('[name="point-body-region"]').fill('cervical direita');
  await page.locator('[name="point-anatomical-label"]').fill('C4');
  await page.locator('[name="point-energy"]').fill('4');
  await page.locator('[data-add-application-point-f4]').click();
  await expect(page.locator('[data-f4-application-points]')).toContainText('C4');

  await page.locator('[name="point-sequence"]').fill('2');
  await page.locator('[name="point-body-region"]').fill('cervical esquerda');
  await page.locator('[name="point-anatomical-label"]').fill('C5');
  await page.locator('[data-add-application-point-f4]').click();
  await expect(page.locator('[data-f4-application-points]')).toContainText('C5');

  await page.locator('[name="clinical-image"]').setInputFiles({
    name: 'mvp-f4.png',
    mimeType: 'image/png',
    buffer: Buffer.from(ONE_PIXEL_PNG_BASE64, 'base64')
  });
  await page.locator('[name="clinical-image-caption"]').fill('Imagem clínica MVP F4');
  await page.locator('[data-upload-media-f4]').click();
  await expect(page.locator('[data-f4-media-list]')).toContainText('mvp-f4.png');

  await page.locator('[name="basic-outcome-narrative"]').fill('Paciente relata melhora no acompanhamento MVP.');
  await page.locator('[data-record-basic-outcome-f4]').click();
  await expect(page.locator('[data-f4-outcomes]')).toContainText('Paciente relata melhora no acompanhamento MVP.');

  await page.locator('[data-generate-pdf-f4]').click();
  await expect(page.locator('[data-f4-documents]')).toContainText('encounter_pdf');

  await page.locator('[data-create-backup-f4]').click();
  await expect(page.locator('[data-f4-backup-status]')).toContainText('Backup verificado');

  await expect(page.locator('[data-f5-evolution]')).toBeVisible();
  await expect(page.locator('[data-phase-badge]')).toHaveText(/F(?:8|9|10) concluída/);

  await page.locator('[name="f5-outcome-type"]').selectOption('vas_pain');
  await page.locator('[name="f5-outcome-value"]').fill('8');
  await page.locator('[name="f5-outcome-group"]').fill('cervical-f5-e2e');
  await page.locator('[name="f5-outcome-narrative"]').fill('Dor registrada antes da nova sessão.');
  await page.locator('[data-record-outcome-f5]').click();
  await expect(page.locator('[data-f5-feedback]')).toContainText('Evolução registrada');

  await page.locator('[data-nav="sessions"]').click();
  await page.locator('[name="session-encounter"]').selectOption(encounterValue);
  await page.locator('[name="session-protocol-version"]').selectOption(versionValue);
  await page.locator('[name="planned-energy"]').fill('4');
  await page.locator('[name="applied-energy"]').fill('4');
  await page.locator('[data-create-session]').click();

  await page.locator('[data-nav="patients"]').click();
  await page.locator('[data-patient-row]').filter({ hasText: 'Paciente MVP F4' }).getByRole('button', { name: 'Abrir' }).click();
  await expect(page.locator('[data-f5-evolution]')).toBeVisible();

  await page.locator('[name="f5-outcome-type"]').selectOption('vas_pain');
  await page.locator('[name="f5-outcome-value"]').fill('5');
  await page.locator('[name="f5-outcome-group"]').fill('cervical-f5-e2e');
  await page.locator('[name="f5-outcome-narrative"]').fill('Dor registrada no acompanhamento posterior.');
  await page.locator('[data-record-outcome-f5]').click();
  await expect(page.locator('[data-f5-feedback]')).toContainText('Evolução registrada');

  await page.locator('[name="f5-outcome-type"]').selectOption('rom');
  await page.locator('[name="f5-outcome-value"]').fill('70');
  await page.locator('[name="f5-outcome-unit"]').fill('deg');
  await page.locator('[name="f5-outcome-group"]').fill('cervical-rom-f5');
  await page.locator('[name="f5-outcome-narrative"]').fill('Amplitude cervical registrada.');
  await page.locator('[data-record-outcome-f5]').click();
  await expect(page.locator('[data-f5-feedback]')).toContainText('Evolução registrada');

  await page.locator('[name="f5-series-type"]').selectOption('vas_pain');
  await page.locator('[name="f5-series-group"]').fill('cervical-f5-e2e');
  await page.locator('[data-load-series-f5]').click();

  const points = page.locator('[data-f5-series-point]');
  await expect(points).toHaveCount(2);
  await expect(points.nth(0)).toContainText('8');
  await expect(points.nth(1)).toContainText('5');
  await expect(page.locator('[data-f5-comparison]')).toContainText('8 → 5');
  await expect(page.locator('[data-f5-comparison]')).toContainText('Comparação descritiva');
  await expect(page.locator('[data-f5-chart] svg polyline')).toHaveCount(1);

  const evolutionText = await page.locator('[data-f5-evolution]').innerText();
  expect(evolutionText).not.toMatch(/causou|devido ao tratamento|tratamento resultou/i);

  const timeline = page.locator('[data-f5-timeline]');
  await expect(timeline).toContainText('Avaliação clínica');
  await expect(timeline).toContainText('Sessão PBM');
  await expect(timeline).toContainText('Desfecho clínico');
  await expect(timeline).toContainText('Imagem clínica');
  await expect(timeline).toContainText('70 deg');

  await page.locator('[data-nav="audit"]').click();
  for (const action of ['consent.accepted', 'application_point.created', 'clinical_media.created', 'outcome.recorded', 'document.finalized', 'backup.created']) {
    await expect(page.getByText(action, { exact: true }).first()).toBeVisible();
  }
});
