import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const publicUrl = new URL('../src/app/public/', import.meta.url);
const frontendRoot = fileURLToPath(publicUrl);
const html = fs.readFileSync(new URL('index.html', publicUrl), 'utf8');
const app = fs.readFileSync(new URL('app.js', publicUrl), 'utf8');

function readPublic(pathname) {
  return fs.readFileSync(new URL(pathname, publicUrl), 'utf8');
}

function jsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? jsFiles(full) : entry.name.endsWith('.js') ? [full] : [];
  });
}

test('UI foundation is split into focused reusable browser modules', () => {
  for (const file of [
    'ui/navigation.js', 'ui/primitives.js', 'features/f0-views.js', 'features/evolution.js',
    'features/photos.js', 'features/agenda.js', 'features/reports.js', 'features/audit.js', 'features/planned-routes.js'
  ]) {
    assert.equal(fs.existsSync(new URL(file, publicUrl)), true, `${file} should exist`);
  }
  assert.match(app, /from ['"]\.\/ui\/navigation\.js['"]/);
  assert.match(app, /from ['"]\.\/features\/f0-views\.js['"]/);
  assert.match(app, /from ['"]\.\/features\/audit\.js['"]/);
  assert.match(app, /from ['"]\.\/features\/reports\.js['"]/);
  assert.match(app, /from ['"]\.\/features\/agenda\.js['"]/);
});

test('primary navigation registry exposes the planned product routes', () => {
  const navigation = readPublic('ui/navigation.js');
  for (const route of ['dashboard', 'patients', 'agenda', 'protocols', 'equipment', 'reports', 'settings']) {
    assert.match(navigation, new RegExp(`['"]${route}['"]`));
  }
  assert.match(html, /data-mobile-nav-toggle/);
});

test('settings remains the only explicit planned primary boundary', () => {
  const planned = readPublic('features/planned-routes.js');
  assert.match(planned, /settings/);
  assert.doesNotMatch(planned, /agenda:/);
  assert.doesNotMatch(planned, /reports:/);
  assert.match(planned, /sem simular persistência/i);
});

test('F0 clinical safety surfaces remain represented after modular extraction', () => {
  const f0Views = readPublic('features/f0-views.js');
  const treatmentWorkflow = readPublic('features/treatment-workflow.js');
  const audit = readPublic('features/audit.js');
  assert.match(f0Views, /Versionamento imutável/);
  assert.match(treatmentWorkflow, /Parâmetros planejados e aplicados permanecem separados/i);
  assert.match(treatmentWorkflow, /Planejado/);
  assert.match(treatmentWorkflow, /Aplicado/);
  assert.match(f0Views, /Informe o motivo profissional/);
  assert.doesNotMatch(f0Views, /data-edit-protocol-version/);
  assert.match(f0Views, /renderTreatmentWorkflow/);
  assert.match(audit, /Auditoria append-only/);
  assert.match(audit, /Persistido · backend F0/);
});

test('frontend API endpoints stay inside focused data adapters', () => {
  const adapterRoot = path.join(frontendRoot, 'data', 'adapters');
  const offenders = jsFiles(frontendRoot)
    .filter((file) => !file.startsWith(`${adapterRoot}${path.sep}`))
    .filter((file) => /\/api\//.test(fs.readFileSync(file, 'utf8')));
  assert.deepEqual(offenders, []);

  for (const file of [
    'data/adapters/f0-api-adapter.js',
    'data/adapters/auth-api-adapter.js',
    'data/adapters/clinical-api-adapter.js',
    'data/adapters/operations-api-adapter.js',
    'data/adapters/admin-api-adapter.js'
  ]) {
    assert.match(readPublic(file), /\/api\//, `${file} should own transport endpoints`);
  }
});

test('backend-ready feature modules depend on the gateway rather than transport details', () => {
  for (const file of ['features/evolution.js', 'features/photos.js', 'features/agenda.js', 'features/reports.js', 'features/audit.js']) {
    const source = readPublic(file);
    assert.match(source, /gateway/, `${file} should consume the gateway`);
    assert.doesNotMatch(source, /\/api\//, `${file} must not contain transport endpoints`);
  }
});

test('retired mock provider cannot return as a second data boundary', () => {
  assert.equal(fs.existsSync(new URL('data/mock-provider.js', publicUrl)), false);
  assert.match(readPublic('data/clinical-data-gateway.js'), /createClinicalDataGateway/);
});