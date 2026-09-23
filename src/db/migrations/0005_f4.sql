ALTER TABLE clinical_media ADD COLUMN original_filename TEXT;
ALTER TABLE clinical_media ADD COLUMN mime_type TEXT;
ALTER TABLE clinical_media ADD COLUMN byte_size INTEGER CHECK (byte_size IS NULL OR byte_size >= 0);

ALTER TABLE documents ADD COLUMN sha256 TEXT;

CREATE TRIGGER consents_immutable_update
BEFORE UPDATE ON consents
BEGIN
  SELECT RAISE(ABORT, 'consents are immutable; append a new consent event');
END;

CREATE TRIGGER consents_immutable_delete
BEFORE DELETE ON consents
BEGIN
  SELECT RAISE(ABORT, 'consents are immutable; append a new consent event');
END;
