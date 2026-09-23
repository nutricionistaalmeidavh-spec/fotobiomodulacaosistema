import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const outDir = path.resolve('artifacts/ui-audit');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1024 }, deviceScaleFactor: 1 });
const baseURL = 'http://127.0.0.1:8788';

async function waitReady() {
  await page.locator('body').waitFor();
  await page.waitForFunction(() => document.body.dataset.appReady === 'true');
  await page.waitForTimeout(120);
}

async function shot(name) {
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });
}

async function openPrimary(route, name) {
  await page.goto(baseURL);
  await waitReady();
  await page.locator(`[data-nav="${route}"]`).click();
  await page.waitForTimeout(180);
  await shot(name);
}

async function openSecondary(route, name) {
  await page.goto(baseURL);
  await waitReady();
  await page.locator(`[data-secondary-nav="${route}"]`).click();
  await page.waitForTimeout(180);
  await shot(name);
}

await page.goto(baseURL);
await waitReady();
await shot('01-dashboard');

for (const [route, name] of [
  ['patients', '02-pacientes'],
  ['agenda', '03-agenda'],
  ['protocols', '04-protocolos'],
  ['equipment', '05-equipamentos'],
  ['reports', '06-relatorios'],
  ['settings', '07-configuracoes']
]) await openPrimary(route, name);

await openSecondary('sessions', '08-sessoes-f0');
await openSecondary('audit', '09-auditoria');

await page.goto(baseURL);
await waitReady();
await page.locator('[data-nav="patients"]').click();
await page.getByRole('button', { name: 'Carlos Menezes', exact: true }).click();
await page.waitForTimeout(180);
await shot('10-paciente-resumo');

for (const [tab, name] of [
  ['Anamnese', '11-paciente-anamnese'],
  ['Protocolos', '12-paciente-protocolos'],
  ['Sessões', '13-paciente-sessoes'],
  ['Evolução', '14-paciente-evolucao'],
  ['Fotos', '15-paciente-fotos'],
  ['Documentos', '16-paciente-documentos'],
  ['Consentimentos', '17-paciente-consentimentos']
]) {
  await page.getByRole('tab', { name: tab, exact: true }).click();
  await page.waitForTimeout(120);
  await shot(name);
}

await browser.close();
console.log(`Captured 17 screens to ${outDir}`);
