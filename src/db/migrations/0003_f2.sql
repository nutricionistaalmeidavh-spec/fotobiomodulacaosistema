ALTER TABLE protocol_indications ADD COLUMN clinical_phase TEXT;

CREATE INDEX idx_protocol_indications_version
  ON protocol_indications(protocol_version_id);

CREATE INDEX idx_protocol_indications_search
  ON protocol_indications(symptom, body_region, therapeutic_goal, clinical_phase);

CREATE TRIGGER protocol_indications_immutable_update
BEFORE UPDATE ON protocol_indications
BEGIN
  SELECT RAISE(ABORT, 'protocol indications are immutable; create a new protocol version');
END;

CREATE TRIGGER protocol_indications_immutable_delete
BEFORE DELETE ON protocol_indications
BEGIN
  SELECT RAISE(ABORT, 'protocol indications are immutable; create a new protocol version');
END;

CREATE TRIGGER protocol_contraindications_immutable_update
BEFORE UPDATE ON protocol_contraindications
BEGIN
  SELECT RAISE(ABORT, 'protocol contraindications are immutable; create a new protocol version');
END;

CREATE TRIGGER protocol_contraindications_immutable_delete
BEFORE DELETE ON protocol_contraindications
BEGIN
  SELECT RAISE(ABORT, 'protocol contraindications are immutable; create a new protocol version');
END;
