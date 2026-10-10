-- Append-only professional review of the clinical safety checklist.
-- This migration is a release-hardening addition, not a new clinical roadmap phase.
CREATE TABLE clinical_safety_reviews (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  actor_id TEXT NOT NULL REFERENCES professionals(id) ON DELETE RESTRICT,
  checklist_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_clinical_safety_patient_created
  ON clinical_safety_reviews(patient_id, created_at DESC);
