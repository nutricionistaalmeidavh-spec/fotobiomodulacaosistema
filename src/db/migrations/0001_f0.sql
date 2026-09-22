PRAGMA foreign_keys = ON;

CREATE TABLE professionals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  registration_type TEXT,
  registration_number TEXT,
  email TEXT,
  phone TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE patients (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  birth_date TEXT,
  document_number TEXT,
  email TEXT,
  phone TEXT,
  emergency_contact TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE conditions (
  id TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE assessments (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  professional_id TEXT NOT NULL REFERENCES professionals(id) ON DELETE RESTRICT,
  chief_complaint TEXT,
  history TEXT,
  medications TEXT,
  allergies TEXT,
  precautions TEXT,
  pain_score REAL CHECK (pain_score IS NULL OR (pain_score >= 0 AND pain_score <= 10)),
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE encounters (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  professional_id TEXT NOT NULL REFERENCES professionals(id) ON DELETE RESTRICT,
  assessment_id TEXT REFERENCES assessments(id) ON DELETE SET NULL,
  encounter_type TEXT NOT NULL DEFAULT 'clinical',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','finalized','cancelled')),
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finalized_at TEXT,
  notes TEXT
);

CREATE TABLE protocols (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  created_by TEXT NOT NULL REFERENCES professionals(id) ON DELETE RESTRICT,
  current_version_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE protocol_versions (
  id TEXT PRIMARY KEY,
  protocol_id TEXT NOT NULL REFERENCES protocols(id) ON DELETE RESTRICT,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','retired')),
  change_summary TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'system' CHECK (source_type IN ('system','professional','publication')),
  source_reference TEXT,
  clinical_rationale TEXT,
  parameters_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(protocol_id, version_number)
);

CREATE UNIQUE INDEX idx_protocol_versions_protocol_id_id
  ON protocol_versions(protocol_id, id);

CREATE TABLE protocol_indications (
  id TEXT PRIMARY KEY,
  protocol_version_id TEXT NOT NULL REFERENCES protocol_versions(id) ON DELETE RESTRICT,
  condition_id TEXT REFERENCES conditions(id) ON DELETE RESTRICT,
  symptom TEXT,
  body_region TEXT,
  therapeutic_goal TEXT,
  notes TEXT
);

CREATE TABLE protocol_contraindications (
  id TEXT PRIMARY KEY,
  protocol_version_id TEXT NOT NULL REFERENCES protocol_versions(id) ON DELETE RESTRICT,
  label TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'precaution' CHECK (severity IN ('precaution','relative','absolute')),
  rationale TEXT,
  source_reference TEXT
);

CREATE TABLE equipment (
  id TEXT PRIMARY KEY,
  owner_professional_id TEXT REFERENCES professionals(id) ON DELETE SET NULL,
  manufacturer TEXT NOT NULL,
  model TEXT NOT NULL,
  serial_number TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  specifications_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE applicators (
  id TEXT PRIMARY KEY,
  equipment_id TEXT NOT NULL REFERENCES equipment(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  wavelength_nm REAL CHECK (wavelength_nm IS NULL OR wavelength_nm > 0),
  max_power_mw REAL CHECK (max_power_mw IS NULL OR max_power_mw > 0),
  spot_area_cm2 REAL CHECK (spot_area_cm2 IS NULL OR spot_area_cm2 > 0),
  modes_json TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1))
);

CREATE TABLE treatment_sessions (
  id TEXT PRIMARY KEY,
  encounter_id TEXT NOT NULL REFERENCES encounters(id) ON DELETE RESTRICT,
  protocol_id TEXT REFERENCES protocols(id) ON DELETE RESTRICT,
  protocol_version_id TEXT REFERENCES protocol_versions(id) ON DELETE RESTRICT,
  equipment_id TEXT REFERENCES equipment(id) ON DELETE RESTRICT,
  applicator_id TEXT REFERENCES applicators(id) ON DELETE RESTRICT,
  performed_by TEXT NOT NULL REFERENCES professionals(id) ON DELETE RESTRICT,
  planned_parameters_json TEXT NOT NULL DEFAULT '{}',
  applied_parameters_json TEXT NOT NULL DEFAULT '{}',
  professional_adjustment_reason TEXT,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','completed','cancelled')),
  CHECK ((protocol_version_id IS NULL AND protocol_id IS NULL) OR (protocol_version_id IS NOT NULL AND protocol_id IS NOT NULL)),
  FOREIGN KEY (protocol_id, protocol_version_id) REFERENCES protocol_versions(protocol_id, id) ON DELETE RESTRICT
);

CREATE TABLE application_points (
  id TEXT PRIMARY KEY,
  treatment_session_id TEXT NOT NULL REFERENCES treatment_sessions(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL CHECK (sequence_number > 0),
  body_region TEXT,
  anatomical_label TEXT,
  coordinates_json TEXT,
  parameters_json TEXT NOT NULL DEFAULT '{}',
  applied_at TEXT,
  UNIQUE(treatment_session_id, sequence_number)
);

CREATE TABLE outcomes (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  encounter_id TEXT REFERENCES encounters(id) ON DELETE RESTRICT,
  treatment_session_id TEXT REFERENCES treatment_sessions(id) ON DELETE RESTRICT,
  metric_type TEXT NOT NULL,
  metric_value REAL,
  metric_unit TEXT,
  narrative TEXT,
  measured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE clinical_media (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  encounter_id TEXT REFERENCES encounters(id) ON DELETE RESTRICT,
  treatment_session_id TEXT REFERENCES treatment_sessions(id) ON DELETE RESTRICT,
  media_type TEXT NOT NULL CHECK (media_type IN ('image','video','other')),
  storage_path TEXT NOT NULL,
  sha256 TEXT,
  caption TEXT,
  captured_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE consents (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  professional_id TEXT NOT NULL REFERENCES professionals(id) ON DELETE RESTRICT,
  consent_type TEXT NOT NULL,
  version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('accepted','revoked','declined')),
  evidence_json TEXT NOT NULL DEFAULT '{}',
  accepted_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  patient_id TEXT REFERENCES patients(id) ON DELETE RESTRICT,
  encounter_id TEXT REFERENCES encounters(id) ON DELETE RESTRICT,
  document_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','finalized','void')),
  title TEXT NOT NULL,
  storage_path TEXT,
  content_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL REFERENCES professionals(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finalized_at TEXT
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('professional','system')),
  actor_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  prev_hash TEXT,
  event_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_assessments_patient ON assessments(patient_id, recorded_at);
CREATE INDEX idx_encounters_patient ON encounters(patient_id, started_at);
CREATE INDEX idx_protocol_versions_protocol ON protocol_versions(protocol_id, version_number);
CREATE INDEX idx_sessions_encounter ON treatment_sessions(encounter_id, started_at);
CREATE INDEX idx_outcomes_patient ON outcomes(patient_id, measured_at);
CREATE INDEX idx_media_patient ON clinical_media(patient_id, created_at);
CREATE INDEX idx_audit_entity ON audit_events(entity_type, entity_id, created_at);

CREATE TRIGGER protocol_versions_immutable_update
BEFORE UPDATE ON protocol_versions
BEGIN
  SELECT RAISE(ABORT, 'protocol versions are immutable; create a new version');
END;

CREATE TRIGGER protocol_versions_immutable_delete
BEFORE DELETE ON protocol_versions
BEGIN
  SELECT RAISE(ABORT, 'protocol versions are immutable; retire by creating a new state/version');
END;

CREATE TRIGGER audit_events_append_only_update
BEFORE UPDATE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit log is append-only');
END;

CREATE TRIGGER audit_events_append_only_delete
BEFORE DELETE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit log is append-only');
END;
