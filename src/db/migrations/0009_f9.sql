CREATE TABLE appointments (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  professional_id TEXT REFERENCES professionals(id) ON DELETE SET NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  appointment_type TEXT NOT NULL DEFAULT 'other' CHECK (appointment_type IN ('session','return','evaluation','other')),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','confirmed','completed','missed','cancelled')),
  recurrence_series_id TEXT,
  notes TEXT,
  created_by TEXT NOT NULL REFERENCES professionals(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (julianday(ends_at) > julianday(starts_at))
);

CREATE INDEX idx_appointments_period ON appointments(starts_at, status);
CREATE INDEX idx_appointments_patient ON appointments(patient_id, starts_at);
CREATE INDEX idx_appointments_professional ON appointments(professional_id, starts_at);

CREATE TABLE treatment_packages (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  total_sessions INTEGER NOT NULL CHECK (total_sessions > 0),
  total_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (total_amount_cents >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  valid_until TEXT,
  created_by TEXT NOT NULL REFERENCES professionals(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_treatment_packages_patient ON treatment_packages(patient_id, status);

CREATE TABLE package_usages (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL REFERENCES treatment_packages(id) ON DELETE RESTRICT,
  treatment_session_id TEXT NOT NULL REFERENCES treatment_sessions(id) ON DELETE RESTRICT,
  used_by TEXT NOT NULL REFERENCES professionals(id) ON DELETE RESTRICT,
  used_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(package_id, treatment_session_id)
);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  package_id TEXT REFERENCES treatment_packages(id) ON DELETE RESTRICT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled')),
  due_at TEXT,
  paid_at TEXT,
  reference TEXT,
  notes TEXT,
  created_by TEXT NOT NULL REFERENCES professionals(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_patient ON payments(patient_id, status);
CREATE INDEX idx_payments_period ON payments(status, paid_at, due_at);
