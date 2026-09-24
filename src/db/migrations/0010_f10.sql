CREATE TABLE clinics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  media_retention_days INTEGER CHECK (media_retention_days IS NULL OR media_retention_days > 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO clinics(id, name) VALUES ('default-clinic', 'Clínica local');

CREATE TABLE clinic_memberships (
  id TEXT PRIMARY KEY,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  account_id TEXT NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin','professional','reception')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(clinic_id, account_id)
);

INSERT OR IGNORE INTO clinic_memberships(id, clinic_id, account_id, role, active)
SELECT 'legacy-' || a.id, 'default-clinic', a.id,
       CASE WHEN a.role = 'admin' THEN 'admin' ELSE 'professional' END,
       a.active
FROM auth_accounts a;

CREATE INDEX idx_clinic_memberships_account ON clinic_memberships(account_id, active);
CREATE INDEX idx_clinic_memberships_clinic_role ON clinic_memberships(clinic_id, role, active);
