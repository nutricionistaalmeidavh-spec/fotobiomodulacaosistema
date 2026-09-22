ALTER TABLE patients ADD COLUMN active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1));
ALTER TABLE patients ADD COLUMN archived_at TEXT;

CREATE INDEX IF NOT EXISTS idx_patients_active_name ON patients(active, full_name);

CREATE TABLE auth_accounts (
  id TEXT PRIMARY KEY,
  professional_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_algorithm TEXT NOT NULL DEFAULT 'scrypt-v1',
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin','professional')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (professional_id) REFERENCES professionals(id) ON DELETE RESTRICT
);

CREATE TABLE auth_sessions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT,
  revoked_at TEXT,
  FOREIGN KEY (account_id) REFERENCES auth_accounts(id) ON DELETE CASCADE
);

CREATE INDEX idx_auth_sessions_token_hash ON auth_sessions(token_hash);
CREATE INDEX idx_auth_sessions_account ON auth_sessions(account_id, revoked_at, expires_at);
