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

test('F9 opera agenda pacotes pagamentos e relatórios sem criar sessão clínica automaticamente', async ({ page }) => {
  await login(page);
  await expect(page.locator('[data-phase-badge]')).toHaveText(/F(?:9|10) concluída/);

  await page.locator('[data-nav="agenda"]').click();
  await expect(page.locator('[data-f9-agenda]')).toBeVisible();
  await page.locator('[name="f9-appointment-patient"]').selectOption({ label: 'Paciente MVP F4' });
  await page.locator('[name="f9-appointment-start"]').fill('2026-10-10T10:00');
  await page.locator('[name="f9-appointment-end"]').fill('2026-10-10T11:00');
  await page.locator('[name="f9-appointment-type"]').selectOption('return');
  await page.locator('[name="f9-appointment-notes"]').fill('Retorno operacional F9');
  await page.locator('[data-create-appointment-f9]').click();
  await expect(page.locator('[data-f9-appointment]').filter({ hasText: 'Paciente MVP F4' }).first()).toContainText('return');

  await page.locator('[data-nav="finance"]').click();
  await expect(page.locator('[data-f9-finance]')).toBeVisible();
  await page.locator('[name="f9-package-patient"]').selectOption({ label: 'Paciente MVP F4' });
  await page.locator('[name="f9-package-name"]').fill('Pacote E2E F9');
  await page.locator('[name="f9-package-sessions"]').fill('4');
  await page.locator('[name="f9-package-value"]').fill('400.00');
  await page.locator('[data-create-package-f9]').click();

  await page.locator('[name="f9-payment-patient"]').selectOption({ label: 'Paciente MVP F4' });
  await page.locator('[name="f9-payment-package"]').selectOption({ label: 'Pacote E2E F9' });
  await page.locator('[name="f9-payment-value"]').fill('100.00');
  await page.locator('[name="f9-payment-method"]').fill('pix');
  await page.locator('[data-create-payment-f9]').click();
  const payment = page.locator('[data-f9-payment]').filter({ hasText: '100,00' }).first();
  await expect(payment).toBeVisible();
  await payment.locator('[data-pay-f9]').click();
  await expect(page.locator('[data-f9-payment]').filter({ hasText: '100,00' }).first()).toContainText('paid');

  await page.locator('[data-nav="reports"]').click();
  await expect(page.locator('[data-f9-reports]')).toBeVisible();
  await page.locator('[data-load-report-f9]').click();
  await expect(page.locator('[data-f9-report-output]')).toContainText('100,00');
  await expect(page.locator('[data-f9-reports]')).toContainText(/descritivo/i);
});
