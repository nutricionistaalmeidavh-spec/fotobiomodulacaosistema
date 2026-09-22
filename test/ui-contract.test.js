import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const publicUrl = new URL('../src/app/public/', import.meta.url);
const html = fs.readFileSync(new URL('index.html', publicUrl), 'utf8');
const app = fs.readFileSync(new URL('app.js', publicUrl), 'utf8');

function readPublic(pathname) {
  return fs.readFileSync(new URL(pathname, publicUrl), 'utf8');
}

test('UI foundation is split into focused reusable browser modules', () => {
  for (const file of ['ui/navigation.js', 'ui/primitives.js', 'features/f0-views.js', 'features/planned-routes.js']) {
    assert.equal(fs.existsSync(new URL(file, publicUrl)), true, `${file} should exist`);
  }
  assert.match(app, /from ['"]\.\/ui\/navigation\.js['"]/);
  assert.match(app, /from ['"]\.\/features\/f0-views\.js['"]/);
  assert.match(app, /from ['"]\.\/features\/planned-routes\.js['"]/);
});

test('primary navigation registry exposes the planned product routes', () => {
  const navigation = readPublic('ui/navigation.js');
  for (const route of ['dashboard', 'patients', 'agenda', 'protocols', 'equipment', 'reports', 'settings']) {
    assert.match(navigation, new RegExp(`['"]${route}['"]`));
  }
  assert.match(html, /data-mobile-nav-toggle/);
});

test('planned route module exposes nonblank boundaries without fake persistence', () => {
  const planned = readPublic('features/planned-routes.js');
  for (const route of ['agenda', 'reports', 'settings']) assert.match(planned, new RegExp(route));
  assert.match(planned, /sem simular persistência/i);
});

test('F0 clinical safety surfaces remain represented after the UI refactor', () => {
  const f0Views = readPublic('features/f0-views.js');
  for (const label of ['Versionamento imutável', 'Planejado ≠ aplicado', 'Auditoria append-only']) {
    assert.match(f0Views, new RegExp(label));
  }
  assert.match(f0Views, /Informe o motivo profissional/);
  assert.doesNotMatch(f0Views, /data-edit-protocol-version/);
  assert.match(f0Views, /sessions/);
  assert.match(f0Views, /audit/);
});
