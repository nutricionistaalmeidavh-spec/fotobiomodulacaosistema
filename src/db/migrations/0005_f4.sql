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

CREATE TRIGGER application_points_immutable_update
BEFORE UPDATE ON application_points
BEGIN
  SELECT RAISE(ABORT, 'application points are immutable; append a new record');
END;

CREATE TRIGGER application_points_immutable_delete
BEFORE DELETE ON application_points
BEGIN
  SELECT RAISE(ABORT, 'application points are immutable; append a new record');
END;

CREATE TRIGGER documents_finalized_immutable_update
BEFORE UPDATE ON documents
WHEN OLD.status = 'finalized'
BEGIN
  SELECT RAISE(ABORT, 'finalized documents are immutable');
END;

CREATE TRIGGER documents_immutable_delete
BEFORE DELETE ON documents
BEGIN
  SELECT RAISE(ABORT, 'documents are immutable; create a replacement document');
END;
