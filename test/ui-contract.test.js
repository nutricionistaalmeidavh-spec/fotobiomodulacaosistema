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
  for (const file of ['ui/navigation.js', 'ui/primitives.js', 'features/f0-views.js', 'features/audit.js', 'features/planned-routes.js']) {
    assert.equal(fs.existsSync(new URL(file, publicUrl)), true, `${file} should exist`);
  }
  assert.match(app, /from ['"]\.\/ui\/navigation\.js['"]/);
  assert.match(app, /from ['"]\.\/features\/f0-views\.js['"]/);
  assert.match(app, /from ['"]\.\/features\/audit\.js['"]/);
});

test('primary navigation registry exposes the planned product routes', () => {
  const navigation = readPublic('ui/navigation.js');
  for (const route of ['dashboard', 'patients', 'agenda', 'protocols', 'equipment', 'reports', 'settings']) {
    assert.match(navigation, new RegExp(`['"]${route}['"]`));
  }
  assert.match(html, /data-mobile-nav-toggle/);
});

test('settings remains an explicit planned boundary without fake persistence', () => {
  const planned = readPublic('features/planned-routes.js');
  assert.match(planned, /settings/);
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

test('only F0ApiAdapter contains frontend API endpoints', () => {
  const allowed = path.join(frontendRoot, 'data', 'adapters', 'f0-api-adapter.js');
  const offenders = jsFiles(frontendRoot)
    .filter((file) => file !== allowed)
    .filter((file) => /\/api\//.test(fs.readFileSync(file, 'utf8')));
  assert.deepEqual(offenders, []);
});
