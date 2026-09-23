CREATE TABLE evidence_sources (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  authors TEXT,
  publication_year INTEGER,
  source_name TEXT,
  study_type TEXT NOT NULL,
  doi TEXT,
  url TEXT,
  abstract_text TEXT,
  notes TEXT,
  conditions_json TEXT NOT NULL DEFAULT '[]',
  body_regions_json TEXT NOT NULL DEFAULT '[]',
  wavelengths_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_by TEXT REFERENCES professionals(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (publication_year IS NULL OR (publication_year >= 1800 AND publication_year <= 3000))
);

CREATE UNIQUE INDEX idx_evidence_sources_doi
  ON evidence_sources(doi)
  WHERE doi IS NOT NULL;

CREATE INDEX idx_evidence_sources_study_type
  ON evidence_sources(study_type);

CREATE INDEX idx_evidence_sources_publication_year
  ON evidence_sources(publication_year);

CREATE TABLE protocol_evidence_links (
  id TEXT PRIMARY KEY,
  protocol_version_id TEXT NOT NULL REFERENCES protocol_versions(id) ON DELETE RESTRICT,
  evidence_id TEXT NOT NULL REFERENCES evidence_sources(id) ON DELETE RESTRICT,
  relation_type TEXT NOT NULL CHECK (relation_type IN ('supports', 'context', 'contradicts')),
  note TEXT,
  created_by TEXT REFERENCES professionals(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(protocol_version_id, evidence_id)
);

CREATE INDEX idx_protocol_evidence_links_version
  ON protocol_evidence_links(protocol_version_id);

CREATE INDEX idx_protocol_evidence_links_evidence
  ON protocol_evidence_links(evidence_id);
