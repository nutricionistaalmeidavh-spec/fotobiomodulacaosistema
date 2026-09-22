import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../src/app/public/index.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../src/app/public/app.js', import.meta.url), 'utf8');

test('UI contract keeps all F0 navigation surfaces wired', () => {
  for (const route of ['dashboard', 'patients', 'protocols', 'equipment', 'sessions', 'audit']) {
    assert.match(html, new RegExp(`data-nav="${route}"`));
    assert.match(app, new RegExp(`${route}:`));
  }
});

test('UI contract exposes the F0 clinical safety invariants', () => {
  for (const label of ['Versionamento imutável', 'Planejado ≠ aplicado', 'Auditoria append-only']) {
    assert.match(app, new RegExp(label));
  }
  assert.match(app, /Informe o motivo profissional/);
  assert.doesNotMatch(app, /data-edit-protocol-version/);
});
