import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/db/database.js';

test('F3 adds structured equipment and applicator capability fields', () => {
  const db = openDatabase(':memory:');
  const equipment = db.prepare("PRAGMA table_info('equipment')").all().map((row) => row.name);
  const applicators = db.prepare("PRAGMA table_info('applicators')").all().map((row) => row.name);

  assert.ok(equipment.includes('notes'));
  assert.ok(applicators.includes('min_power_mw'));
  assert.ok(applicators.includes('fixed_power_mw'));
  assert.ok(applicators.includes('frequencies_json'));
  assert.ok(applicators.includes('limitations'));
  db.close();
});
