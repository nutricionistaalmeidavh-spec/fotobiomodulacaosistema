ALTER TABLE equipment ADD COLUMN notes TEXT;
ALTER TABLE applicators ADD COLUMN min_power_mw REAL CHECK (min_power_mw IS NULL OR min_power_mw > 0);
ALTER TABLE applicators ADD COLUMN fixed_power_mw REAL CHECK (fixed_power_mw IS NULL OR fixed_power_mw > 0);
ALTER TABLE applicators ADD COLUMN frequencies_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE applicators ADD COLUMN limitations TEXT;

CREATE INDEX idx_equipment_owner_active ON equipment(owner_professional_id, active);
CREATE INDEX idx_applicators_equipment_active ON applicators(equipment_id, active);
