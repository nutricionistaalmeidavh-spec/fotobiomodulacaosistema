import { randomUUID } from 'node:crypto';
import { createF5Service } from './f5-service.js';
import { buildAuditEvent } from '../core/audit.js';
import { SEED_IDS } from './seed.js';

const RELATION_TYPES = new Set(['supports', 'context', 'contradicts']);

function parseJson(value, fallback) {
  try { return JSON.parse(value ?? ''); } catch { return fallback; }
}

function cleanNullable(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function normalizeStringArray(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error('Evidence metadata must be an array');
  return [...new Set(value.map((item) => String(item ?? '').trim()).filter(Boolean))];
}

function normalizeWavelengths(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error('Evidence wavelengths must be an array');
  return [...new Set(value.map(Number).filter((item) => Number.isFinite(item) && item > 0))];
}

function normalizeYear(value) {
  if (value == null || value === '') return null;
  const year = Number(value);
  if (!Number.isInteger(year) || year < 1800 || year > 3000) throw new Error('Publication year is invalid');
  return year;
}

function mapVersion(row) {
  if (!row) return null;
  return {
    id: row.id,
    protocolId: row.protocol_id,
    versionNumber: row.version_number,
    status: row.status,
    changeSummary: row.change_summary,
    sourceType: row.source_type,
    sourceReference: row.source_reference,
    clinicalRationale: row.clinical_rationale,
    parameters: parseJson(row.parameters_json, {}),
    createdAt: row.created_at
  };
}

function mapEvidence(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    authors: row.authors,
    publicationYear: row.publication_year,
    sourceName: row.source_name,
    studyType: row.study_type,
    doi: row.doi,
    url: row.url,
    abstractText: row.abstract_text,
    notes: row.notes,
    conditions: parseJson(row.conditions_json, []),
    bodyRegions: parseJson(row.body_regions_json, []),
    wavelengthsNm: parseJson(row.wavelengths_json, []),
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at
  };
}

function mapLink(row) {
  if (!row) return null;
  return {
    id: row.id,
    protocolVersionId: row.protocol_version_id,
    evidenceId: row.evidence_id,
    relationType: row.relation_type,
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at,
    evidence: row.evidence_title ? {
      id: row.evidence_id,
      title: row.evidence_title,
      publicationYear: row.publication_year,
      studyType: row.study_type,
      doi: row.doi
    } : undefined
  };
}

function appendAudit(db, base, { action, entityType, entityId, payload = {}, actorId }) {
  const previousEvent = base.getAudit().events.at(-1) ?? null;
  const event = buildAuditEvent({
    id: randomUUID(),
    actorType: 'professional',
    actorId: actorId || SEED_IDS.professional,
    action,
    entityType,
    entityId,
    payload,
    previousEvent,
    createdAt: new Date().toISOString()
  });
  db.prepare(`
    INSERT INTO audit_events(
      id, actor_type, actor_id, action, entity_type, entity_id, payload_json, prev_hash, event_hash, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    event.id, event.actorType, event.actorId, event.action, event.entityType, event.entityId,
    JSON.stringify(event.payload), event.prevHash, event.eventHash, event.createdAt
  );
  return event;
}

function containsText(value, expected) {
  return String(value ?? '').toLocaleLowerCase('pt-BR').includes(expected);
}

function arrayContainsText(values, expected) {
  return values.some((value) => containsText(value, expected));
}

export function createF6Service(db) {
  const base = createF5Service(db);

  return {
    ...base,

    getStatus() {
      return { ...base.getStatus(), phase: 'F6' };
    },

    getAuditState() {
      return base.getAudit();
    },

    getProtocolVersion(protocolVersionId) {
      return mapVersion(db.prepare('SELECT * FROM protocol_versions WHERE id = ?').get(protocolVersionId));
    },

    createEvidence(input = {}, actorId = SEED_IDS.professional) {
      const title = String(input.title ?? '').trim();
      const studyType = String(input.studyType ?? '').trim();
      if (!title) throw new Error('Evidence title is required');
      if (!studyType) throw new Error('Evidence study type is required');

      const id = randomUUID();
      const conditions = normalizeStringArray(input.conditions);
      const bodyRegions = normalizeStringArray(input.bodyRegions);
      const wavelengthsNm = normalizeWavelengths(input.wavelengthsNm);
      const publicationYear = normalizeYear(input.publicationYear);
      const doi = cleanNullable(input.doi);

      db.exec('BEGIN IMMEDIATE;');
      try {
        db.prepare(`
          INSERT INTO evidence_sources(
            id, title, authors, publication_year, source_name, study_type, doi, url,
            abstract_text, notes, conditions_json, body_regions_json, wavelengths_json,
            status, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
        `).run(
          id, title, cleanNullable(input.authors), publicationYear, cleanNullable(input.sourceName), studyType,
          doi, cleanNullable(input.url), cleanNullable(input.abstractText), cleanNullable(input.notes),
          JSON.stringify(conditions), JSON.stringify(bodyRegions), JSON.stringify(wavelengthsNm), actorId
        );
        appendAudit(db, base, {
          action: 'evidence.created', entityType: 'evidence_source', entityId: id, actorId,
          payload: { title, publicationYear, studyType, doi, conditions, bodyRegions, wavelengthsNm }
        });
        db.exec('COMMIT;');
      } catch (error) {
        db.exec('ROLLBACK;');
        throw error;
      }
      return mapEvidence(db.prepare('SELECT * FROM evidence_sources WHERE id = ?').get(id));
    },

    listEvidence(filters = {}) {
      const query = String(filters.query ?? '').trim().toLocaleLowerCase('pt-BR');
      const studyType = String(filters.studyType ?? '').trim().toLocaleLowerCase('pt-BR');
      const condition = String(filters.condition ?? '').trim().toLocaleLowerCase('pt-BR');
      const bodyRegion = String(filters.bodyRegion ?? '').trim().toLocaleLowerCase('pt-BR');
      const wavelength = filters.wavelengthNm == null || filters.wavelengthNm === '' ? null : Number(filters.wavelengthNm);
      const rows = db.prepare("SELECT * FROM evidence_sources WHERE status = 'active' ORDER BY publication_year DESC, created_at DESC, title")
        .all().map(mapEvidence);

      return rows.filter((item) => {
        if (studyType && item.studyType.toLocaleLowerCase('pt-BR') !== studyType) return false;
        if (condition && !arrayContainsText(item.conditions, condition)) return false;
        if (bodyRegion && !arrayContainsText(item.bodyRegions, bodyRegion)) return false;
        if (wavelength != null && (!Number.isFinite(wavelength) || !item.wavelengthsNm.some((value) => Number(value) === wavelength))) return false;
        if (!query) return true;
        return [item.title, item.authors, item.sourceName, item.doi, item.abstractText, item.notes]
          .some((value) => containsText(value, query))
          || arrayContainsText(item.conditions, query)
          || arrayContainsText(item.bodyRegions, query)
          || item.wavelengthsNm.some((value) => String(value).includes(query));
      });
    },

    linkEvidenceToProtocolVersion(protocolVersionId, evidenceId, input = {}, actorId = SEED_IDS.professional) {
      const version = db.prepare('SELECT id, protocol_id FROM protocol_versions WHERE id = ?').get(protocolVersionId);
      if (!version) throw new Error('Protocol version not found');
      const evidence = db.prepare("SELECT id, title FROM evidence_sources WHERE id = ? AND status = 'active'").get(evidenceId);
      if (!evidence) throw new Error('Evidence not found');
      const relationType = String(input.relationType ?? 'context').trim();
      if (!RELATION_TYPES.has(relationType)) throw new Error('Evidence relation type is invalid');
      const id = randomUUID();

      db.exec('BEGIN IMMEDIATE;');
      try {
        db.prepare(`
          INSERT INTO protocol_evidence_links(
            id, protocol_version_id, evidence_id, relation_type, note, created_by
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, protocolVersionId, evidenceId, relationType, cleanNullable(input.note), actorId);
        appendAudit(db, base, {
          action: 'protocol_evidence.linked', entityType: 'protocol_evidence_link', entityId: id, actorId,
          payload: { protocolVersionId, protocolId: version.protocol_id, evidenceId, relationType }
        });
        db.exec('COMMIT;');
      } catch (error) {
        db.exec('ROLLBACK;');
        throw error;
      }
      return mapLink(db.prepare('SELECT * FROM protocol_evidence_links WHERE id = ?').get(id));
    },

    listProtocolEvidence(protocolVersionId) {
      if (!db.prepare('SELECT 1 FROM protocol_versions WHERE id = ?').get(protocolVersionId)) {
        throw new Error('Protocol version not found');
      }
      return db.prepare(`
        SELECT pel.*, es.title AS evidence_title, es.publication_year, es.study_type, es.doi
        FROM protocol_evidence_links pel
        JOIN evidence_sources es ON es.id = pel.evidence_id
        WHERE pel.protocol_version_id = ?
        ORDER BY pel.created_at, pel.rowid
      `).all(protocolVersionId).map(mapLink);
    }
  };
}
