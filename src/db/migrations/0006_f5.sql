ALTER TABLE outcomes ADD COLUMN professional_id TEXT REFERENCES professionals(id) ON DELETE RESTRICT;
ALTER TABLE outcomes ADD COLUMN baseline_group TEXT;

CREATE INDEX idx_outcomes_patient_type_time
ON outcomes(patient_id, metric_type, measured_at);
