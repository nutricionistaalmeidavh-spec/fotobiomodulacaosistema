import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

test('production app does not instantiate the local clinical adapter as runtime source of truth', () => {
  const appSource = read('src/app/public/app.js');
  assert.doesNotMatch(appSource, /createLocalClinicalAdapter\s*\(/);
  assert.match(appSource, /createClinicalDataGateway\s*\(/);
});

test('feature modules remain transport-agnostic and never call API endpoints directly', () => {
  const featureDir = path.join(root, 'src/app/public/features');
  const offenders = fs.readdirSync(featureDir)
    .filter((name) => name.endsWith('.js'))
    .filter((name) => /fetch\s*\(|\/api\//.test(fs.readFileSync(path.join(featureDir, name), 'utf8')));
  assert.deepEqual(offenders, []);
});

test('integrated runtime exposes focused API adapters behind one gateway', () => {
  for (const relative of [
    'src/app/public/data/http-client.js',
    'src/app/public/data/adapters/auth-api-adapter.js',
    'src/app/public/data/adapters/clinical-api-adapter.js',
    'src/app/public/data/adapters/operations-api-adapter.js',
    'src/app/public/data/adapters/admin-api-adapter.js'
  ]) {
    assert.equal(fs.existsSync(path.join(root, relative)), true, `${relative} must exist`);
  }
});
