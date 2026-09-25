import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { openDatabase } from '../src/db/database.js';

test('existing F0 database upgrades through F10 without losing patient rows', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pbm-f0-upgrade-'));
  const dbFile = path.join(dir, 'legacy.sqlite');
  const legacy = new DatabaseSync(dbFile);
  const f0Sql = fs.readFileSync(new URL('../src/db/migrations/0001_f0.sql', import.meta.url), 'utf8');

  legacy.exec(f0Sql);
  legacy.exec(`
    CREATE TABLE schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  legacy.prepare('INSERT INTO schema_migrations(version) VALUES (?)').run('0001_f0');
  legacy.prepare('INSERT INTO patients(id, full_name) VALUES (?, ?)').run('legacy-patient', 'Paciente legado');
  legacy.close();

  const db = openDatabase(dbFile);
  assert.equal(
    db.prepare('SELECT full_name FROM patients WHERE id = ?').get('legacy-patient').full_name,
    'Paciente legado'
  );
  assert.deepEqual(
    db.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map((row) => row.version),
    ['0001_f0', '0002_f1', '0003_f2', '0004_f3', '0005_f4', '0006_f5', '0007_f6', '0008_f8', '0009_f9', '0010_f10']
  );
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
