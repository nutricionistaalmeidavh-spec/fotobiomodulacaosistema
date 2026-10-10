ALTER TABLE protocol_indications ADD COLUMN min_age_years INTEGER CHECK (min_age_years IS NULL OR min_age_years >= 0);
ALTER TABLE protocol_indications ADD COLUMN max_age_years INTEGER CHECK (max_age_years IS NULL OR max_age_years >= 0);
ALTER TABLE protocol_indications ADD COLUMN professional_area TEXT;

CREATE INDEX idx_protocol_indications_f8_filters
  ON protocol_indications(professional_area, min_age_years, max_age_years);
