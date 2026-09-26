import { test, expect } from '@playwright/test';

test('F3/F7 UI persists equipment adaptation, selected session equipment and body-map point', async ({ page }) => {
  const suffix = Date.now();
  const patientName = `Paciente Sessão ${suffix}`;
  const protocolTitle = `Protocolo Sessão ${suffix}`;
  const manufacturer = `Fabricante ${suffix}`;
  const model = `Laser ${suffix}`;
  const applicatorName = `Ponteira variável ${suffix}`;

  const patientResponse = await page.request.post('/api/patients', { data: { fullName: patientName } });
  expect(patientResponse.ok()).toBeTruthy();
  const patient = (await patientResponse.json()).patient;
  const encounterResponse = await page.request.post(`/api/patients/${patient.id}/encounters`, {
    data: { assessment: { chiefComplaint: 'Dor no ombro direito' } }
  });
  expect(encounterResponse.ok()).toBeTruthy();
  const encounter = (await encounterResponse.json()).encounter;

  const protocolResponse = await page.request.post('/api/protocols', {
    data: {
      title: protocolTitle,
      changeSummary: 'Versão de referência T8',
      parameters: {
        wavelengthNm: 808,
        powerMw: 100,
        timeS: 40,
        areaCm2: 0.5,
        mode: 'continuous',
        points: 1,
        technique: 'contact'
      }
    }
  });
  expect(protocolResponse.ok()).toBeTruthy();
  const protocol = (await protocolResponse.json()).protocol;
  const protocolVersion = protocol.versions[0];

  await page.goto('/');
  await page.locator('[data-nav="equipment"]').click();
  await expect(page.getByRole('heading', { name: 'Equipamentos e aplicadores', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Novo equipamento' }).click();
  const equipmentDialog = page.getByRole('dialog', { name: 'Novo equipamento' });
  await equipmentDialog.getByLabel('Fabricante').fill(manufacturer);
  await equipmentDialog.getByLabel('Modelo').fill(model);
  await equipmentDialog.getByLabel('Número de série').fill(`SER-${suffix}`);
  await equipmentDialog.getByRole('button', { name: 'Salvar equipamento' }).click();

  const equipmentCard = page.locator('[data-equipment-card]').filter({ hasText: `${manufacturer} ${model}` });
  await expect(equipmentCard).toBeVisible();
  await equipmentCard.getByRole('button', { name: 'Adicionar aplicador' }).click();
  const applicatorDialog = page.getByRole('dialog', { name: 'Novo aplicador' });
  await applicatorDialog.getByLabel('Nome do aplicador').fill(applicatorName);
  await applicatorDialog.getByLabel('Comprimento de onda (nm)').fill('808');
  await applicatorDialog.getByLabel('Potência mínima (mW)').fill('100');
  await applicatorDialog.getByLabel('Potência máxima (mW)').fill('300');
  await applicatorDialog.getByLabel('Área do spot (cm²)').fill('0.5');
  await applicatorDialog.getByLabel('Modo').selectOption('continuous');
  await applicatorDialog.getByRole('button', { name: 'Salvar aplicador' }).click();
  await expect(equipmentCard).toContainText(applicatorName);

  await page.locator('[data-secondary-nav="sessions"]').click();
  await expect(page.getByRole('heading', { name: 'Atendimento guiado e rastreável', exact: true })).toBeVisible();
  await page.getByLabel('Atendimento aberto').selectOption(encounter.id);
  await page.getByLabel('Versão do protocolo').selectOption(protocolVersion.id);
  await page.getByRole('combobox', { name: 'Equipamento', exact: true }).selectOption({ label: `${manufacturer} ${model}` });
  await page.getByRole('combobox', { name: 'Aplicador', exact: true }).selectOption({ label: applicatorName });

  await page.getByRole('button', { name: 'Pré-visualizar adaptação' }).click();
  await expect(page.locator('[data-adaptation-preview]')).toContainText(/Selecione explicitamente a potência/i);

  await page.getByLabel('Potência selecionada (mW)').fill('200');
  await page.getByRole('button', { name: 'Pré-visualizar adaptação' }).click();
  const preview = page.locator('[data-adaptation-preview]');
  await expect(preview).toContainText('Referência imutável');
  await expect(preview).toContainText('Derivado do equipamento');
  await expect(preview.locator('[data-reference-power]')).toHaveText(/100/);
  await expect(preview.locator('[data-derived-power]')).toHaveText(/200/);
  await expect(preview.locator('[data-derived-time]')).toHaveText(/20/);

  await page.getByLabel('Energia planejada (J)').fill('4');
  await page.getByRole('button', { name: 'Aplicação', exact: true }).click();
  await page.getByLabel('Energia aplicada (J)').fill('3.5');
  await page.getByLabel('Região corporal').selectOption('shoulder');
  await page.getByLabel('Vista').selectOption('anterior');
  await page.getByLabel('Lado').selectOption('right');
  await page.getByLabel('Coordenada X').fill('0.55');
  await page.getByLabel('Coordenada Y').fill('0.45');
  await page.getByLabel('Rótulo anatômico').fill('Ombro direito anterior');

  await page.getByRole('button', { name: 'Registro', exact: true }).click();
  await page.getByLabel('Motivo profissional do ajuste').fill('Ajuste registrado durante aplicação');
  await page.getByRole('button', { name: 'Registrar sessão' }).click();
  await expect(page.getByText(/Sessão registrada/)).toBeVisible();

  const sessionsPayload = await (await page.request.get('/api/sessions')).json();
  const createdSession = sessionsPayload.sessions.find((item) => item.encounterId === encounter.id && item.protocolVersionId === protocolVersion.id);
  expect(createdSession).toBeTruthy();
  expect(createdSession.equipmentId).not.toBe('equipment-demo');
  expect(createdSession.applicatorId).not.toBe('applicator-demo');
  expect(createdSession.plannedParameters.energyJ).toBe(4);
  expect(createdSession.appliedParameters.energyJ).toBe(3.5);
  expect(createdSession.professionalAdjustmentReason).toBe('Ajuste registrado durante aplicação');

  const pointsPayload = await (await page.request.get(`/api/patients/${patient.id}/body-map-points`)).json();
  const point = pointsPayload.points.find((item) => item.treatmentSessionId === createdSession.id);
  expect(point).toBeTruthy();
  expect(point.regionId).toBe('shoulder');
  expect(point.anatomicalLabel).toBe('Ombro direito anterior');

  await page.reload();
  await page.locator('[data-secondary-nav="sessions"]').click();
  await page.getByRole('button', { name: 'Evolução', exact: true }).click();
  await expect(page.locator('[data-treatment-history]')).toContainText(protocolTitle);
  await expect(page.locator('[data-treatment-history]')).toContainText('Ombro direito anterior');
});
