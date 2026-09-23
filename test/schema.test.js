import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, listTables } from '../src/db/database.js';

const requiredTables = [
  'professionals','patients','conditions','assessments','encounters','protocols',
  'protocol_versions','protocol_indications','protocol_contraindications','equipment',
  'applicators','treatment_sessions','application_points','outcomes','clinical_media',
  'consents','documents','audit_events','auth_accounts','auth_sessions'
];

test('F1 schema creates every core clinical and local auth table', () => {
  const db = openDatabase(':memory:');
  const tables = listTables(db);
  for (const name of requiredTables) assert.ok(tables.includes(name), `missing table: ${name}`);
});

test('patients support non-destructive archival fields', () => {
  const db = openDatabase(':memory:');
  const columns = db.prepare("PRAGMA table_info('patients')").all().map((row) => row.name);
  assert.ok(columns.includes('active'));
  assert.ok(columns.includes('archived_at'));
});

test('F5 outcomes link the responsible professional and longitudinal grouping metadata', () => {
  const db = openDatabase(':memory:');
  const columns = db.prepare("PRAGMA table_info('outcomes')").all().map((row) => row.name);
  assert.ok(columns.includes('professional_id'));
  assert.ok(columns.includes('baseline_group'));
  const indexes = db.prepare("PRAGMA index_list('outcomes')").all().map((row) => row.name);
  assert.ok(indexes.includes('idx_outcomes_patient_type_time'));
});

test('F6 schema adds scientific evidence sources and exact protocol-version links', () => {
  const db = openDatabase(':memory:');
  const tables = listTables(db);
  assert.ok(tables.includes('evidence_sources'));
  assert.ok(tables.includes('protocol_evidence_links'));
  const evidenceColumns = db.prepare("PRAGMA table_info('evidence_sources')").all().map((row) => row.name);
  for (const column of ['title','publication_year','study_type','conditions_json','body_regions_json','wavelengths_json']) {
    assert.ok(evidenceColumns.includes(column), `missing evidence column: ${column}`);
  }
});

test('F8 protocol indications support age and professional-area constraints', () => {
  const db = openDatabase(':memory:');
  const columns = db.prepare("PRAGMA table_info('protocol_indications')").all().map((row) => row.name);
  for (const column of ['min_age_years', 'max_age_years', 'professional_area']) {
    assert.ok(columns.includes(column), `missing F8 indication column: ${column}`);
  }
});

test('protocol versions are immutable after creation', () => {
  const db = openDatabase(':memory:');
  db.prepare("INSERT INTO professionals(id,name) VALUES('p1','Profissional')").run();
  db.prepare("INSERT INTO protocols(id,title,status,created_by) VALUES('proto1','Dor','draft','p1')").run();
  db.prepare("INSERT INTO protocol_versions(id,protocol_id,version_number,status,change_summary) VALUES('pv1','proto1',1,'draft','initial')").run();
  assert.throws(() => db.prepare("UPDATE protocol_versions SET change_summary='changed' WHERE id='pv1'").run(), /immutable/i);
});

test('audit events are append-only', () => {
  const db = openDatabase(':memory:');
  db.prepare("INSERT INTO audit_events(id,actor_type,action,entity_type,entity_id,payload_json) VALUES('a1','system','create','patient','x','{}')").run();
  assert.throws(() => db.prepare("DELETE FROM audit_events WHERE id='a1'").run(), /append-only/i);
  assert.throws(() => db.prepare("UPDATE audit_events SET action='update' WHERE id='a1'").run(), /append-only/i);
});

test('persistent database reopens with canonical migrations applied once and in order', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'pbm-migrations-'));
  const file = join(dir, 'clinical.sqlite');
  try {
    const first = openDatabase(file);
    first.close();
    const second = openDatabase(file);
    const migrations = second.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map((row) => row.version);
    const requiredPrefix = ['0001_f0', '0002_f1', '0003_f2', '0004_f3', '0005_f4', '0006_f5', '0007_f6', '0008_f8'];
    assert.deepEqual(migrations.slice(0, requiredPrefix.length), requiredPrefix);
    assert.equal(new Set(migrations).size, migrations.length);
    second.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('treatment session cannot link a protocol to a version that belongs to another protocol', () => {
  const db = openDatabase(':memory:');
  db.prepare("INSERT INTO professionals(id,name) VALUES('pro','Profissional')").run();
  db.prepare("INSERT INTO patients(id,full_name) VALUES('pat','Paciente')").run();
  db.prepare("INSERT INTO encounters(id,patient_id,professional_id) VALUES('enc','pat','pro')").run();
  db.prepare("INSERT INTO protocols(id,title,status,created_by) VALUES('p1','P1','draft','pro')").run();
  db.prepare("INSERT INTO protocols(id,title,status,created_by) VALUES('p2','P2','draft','pro')").run();
  db.prepare("INSERT INTO protocol_versions(id,protocol_id,version_number,status,change_summary) VALUES('v2','p2',1,'draft','initial')").run();
  assert.throws(() => db.prepare(`
    INSERT INTO treatment_sessions(id,encounter_id,protocol_id,protocol_version_id,performed_by)
    VALUES('s1','enc','p1','v2','pro')
  `).run(), /foreign key constraint failed/i);
});
