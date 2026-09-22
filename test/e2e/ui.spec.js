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

test.describe.serial('Fotobiomodulação F1 UI', () => {
  test('faz setup local no primeiro acesso, sem provedor externo', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-auth-setup]')).toBeVisible();
    await page.locator('[name="setup-name"]').fill('Profissional E2E');
    await page.locator('[name="setup-email"]').fill(EMAIL);
    await page.locator('[name="setup-password"]').fill(PASSWORD);
    await page.locator('[data-setup-submit]').click();
    await expect(page.locator('body')).toHaveAttribute('data-app-ready', 'true');
    await expect(page.locator('[data-auth-user]')).toContainText('Profissional E2E');
    await expect(page.getByText('F1 concluída', { exact: true }).first()).toBeVisible();
  });

  test('faz logout e login novamente com a conta local', async ({ page }) => {
    await login(page);
    await page.locator('[data-logout]').click();
    await expect(page.locator('[data-auth-login]')).toBeVisible();
    await page.locator('[name="login-email"]').fill(EMAIL);
    await page.locator('[name="login-password"]').fill('senha-errada');
    await page.locator('[data-login-submit]').click();
    await expect(page.getByText(/credenciais inválidas/i)).toBeVisible();
    await page.locator('[name="login-password"]').fill(PASSWORD);
    await page.locator('[data-login-submit]').click();
    await expect(page.locator('body')).toHaveAttribute('data-app-ready', 'true');
  });

  test('cria e edita paciente no workspace clínico', async ({ page }) => {
    await login(page);
    await page.locator('[data-nav="patients"]').click();
    await page.locator('[name="patient-name"]').fill('Paciente E2E');
    await page.locator('[name="patient-birth-date"]').fill('1992-04-11');
    await page.locator('[name="patient-email"]').fill('paciente-e2e@example.test');
    await page.locator('[name="patient-phone"]').fill('16999990000');
    await page.locator('[name="patient-notes"]').fill('Cadastro E2E');
    await page.locator('[data-create-patient]').click();
    await expect(page.locator('[data-patient-workspace]')).toBeVisible();
    await expect(page.getByText('Paciente E2E', { exact: true }).first()).toBeVisible();

    await page.locator('[name="workspace-patient-phone"]').fill('16888880000');
    await page.locator('[name="workspace-patient-notes"]').fill('Cadastro atualizado E2E');
    await page.locator('[data-update-patient]').click();
    await expect(page.getByText('Cadastro atualizado E2E', { exact: false })).toBeVisible();
  });

  test('registra anamnese e inicia atendimento para o paciente', async ({ page }) => {
    await login(page);
    await page.locator('[data-nav="patients"]').click();
    await page.locator('[data-patient-row]').filter({ hasText: 'Paciente E2E' }).getByRole('button', { name: 'Abrir' }).click();
    await page.locator('[name="encounter-chief-complaint"]').fill('Dor cervical E2E');
    await page.locator('[name="encounter-history"]').fill('Sintomas há três semanas');
    await page.locator('[name="encounter-medications"]').fill('Nenhuma medicação');
    await page.locator('[name="encounter-allergies"]').fill('Negadas');
    await page.locator('[name="encounter-precautions"]').fill('Fotossensibilidade negada');
    await page.locator('[name="encounter-pain-score"]').fill('7');
    await page.locator('[name="encounter-notes"]').fill('Atendimento E2E');
    await page.locator('[data-start-encounter]').click();
    await expect(page.getByText('Dor cervical E2E', { exact: false })).toBeVisible();
    await expect(page.getByText('Dor 7/10', { exact: false })).toBeVisible();
    await expect(page.getByText('Atendimento aberto', { exact: false })).toBeVisible();
  });

  test('vincula sessão PBM ao atendimento real e mostra no histórico do paciente', async ({ page }) => {
    await login(page);
    await page.locator('[data-nav="sessions"]').click();
    await page.locator('[name="session-encounter"]').selectOption({ label: /Paciente E2E/ });
    await page.locator('[name="planned-energy"]').fill('4');
    await page.locator('[name="applied-energy"]').fill('5');
    await page.locator('[name="adjustment-reason"]').fill('Resposta clínica observada E2E');
    await page.locator('[data-create-session]').click();
    await expect(page.getByText('Resposta clínica observada E2E', { exact: false })).toBeVisible();

    await page.locator('[data-nav="patients"]').click();
    await page.locator('[data-patient-row]').filter({ hasText: 'Paciente E2E' }).getByRole('button', { name: 'Abrir' }).click();
    await expect(page.getByText('Sessão PBM', { exact: false })).toBeVisible();
    await expect(page.getByText(/Aplicado: 5 J/i)).toBeVisible();
  });

  test('finaliza atendimento e preserva histórico após reload', async ({ page }) => {
    await login(page);
    await page.locator('[data-nav="patients"]').click();
    await page.locator('[data-patient-row]').filter({ hasText: 'Paciente E2E' }).getByRole('button', { name: 'Abrir' }).click();
    await page.locator('[data-finalize-encounter]').click();
    await expect(page.getByText('Atendimento finalizado', { exact: false })).toBeVisible();
    await page.reload();
    await page.locator('[data-nav="patients"]').click();
    await page.locator('[data-patient-row]').filter({ hasText: 'Paciente E2E' }).getByRole('button', { name: 'Abrir' }).click();
    await expect(page.getByText('Dor cervical E2E', { exact: false })).toBeVisible();
    await expect(page.getByText('Sessão PBM', { exact: false })).toBeVisible();
    await expect(page.getByText('Atendimento finalizado', { exact: false })).toBeVisible();
  });

  test('mantém as funcionalidades F0 na navegação e no dashboard', async ({ page }) => {
    await login(page);
    await expect(page.locator('[data-nav]')).toHaveText([
      'Dashboard', 'Pacientes', 'Protocolos', 'Equipamentos', 'Sessões', 'Auditoria'
    ]);
    await expect(page.getByText('21 tabelas', { exact: true })).toBeVisible();
    await expect(page.getByText('Versionamento imutável', { exact: true })).toBeVisible();
    await expect(page.getByText('Planejado ≠ aplicado', { exact: true })).toBeVisible();
    await expect(page.getByText('Auditoria append-only', { exact: true })).toBeVisible();
  });

  test('cria protocolo e acrescenta v2 sem oferecer edição de versões antigas', async ({ page }) => {
    await login(page);
    await page.locator('[data-nav="protocols"]').click();
    await page.locator('[name="protocol-title"]').fill('Dor cervical protocolo E2E');
    await page.locator('[name="protocol-summary"]').fill('Versão inicial E2E');
    await page.locator('[data-create-protocol]').click();
    await expect(page.getByText('Dor cervical protocolo E2E', { exact: true }).first()).toBeVisible();
    await page.locator('[name="version-summary"]').fill('Ajuste documental E2E');
    await page.locator('[data-create-version]').click();
    await expect(page.getByText('v2', { exact: false }).first()).toBeVisible();
    await expect(page.locator('[data-edit-protocol-version]')).toHaveCount(0);
  });

  test('mostra cadeia de auditoria íntegra após ações clínicas reais', async ({ page }) => {
    await login(page);
    await page.locator('[data-nav="audit"]').click();
    await expect(page.getByText('Cadeia íntegra', { exact: true })).toBeVisible();
    await expect(page.getByText('patient.created', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('encounter.created', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('treatment_session.created', { exact: true }).first()).toBeVisible();
  });

  test('mantém todos os módulos alcançáveis em viewport mobile sem overflow global', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await expect(page.locator('[data-nav]')).toHaveCount(6);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
