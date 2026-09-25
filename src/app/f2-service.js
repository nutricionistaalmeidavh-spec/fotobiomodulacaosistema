import { randomUUID } from 'node:crypto';
import { createF0Service } from './f0-service.js';
import { normalizePbmParameters } from '../domain/protocols.js';
import { buildAuditEvent } from '../core/audit.js';
import { SEED_IDS } from './seed.js';

function parseJson(value, fallback = {}) {
  try { return JSON.parse(value ?? ''); } catch { return fallback; }
}

function cleanNullable(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function optionalAge(value, label) {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 130) throw new Error(`${label} must be an integer between 0 and 130`);
  return number;
}

function normalizeProtocolParameters(parameters) {
  if (parameters == null) return {};
  if (typeof parameters !== 'object' || Array.isArray(parameters)) throw new Error('Protocol parameters must be an object');
  if (!Object.keys(parameters).length) return {};
  return normalizePbmParameters(parameters);
}

function normalizeIndications(indications = []) {
  if (!Array.isArray(indications)) throw new Error('Protocol indications must be an array');
  return indications.map((item) => {
    const minAgeYears = optionalAge(item?.minAgeYears, 'Minimum age');
    const maxAgeYears = optionalAge(item?.maxAgeYears, 'Maximum age');
    if (minAgeYears != null && maxAgeYears != null && minAgeYears > maxAgeYears) {
      throw new Error('Minimum age cannot exceed maximum age');
    }
    return {
      condition: cleanNullable(item?.condition),
      symptom: cleanNullable(item?.symptom),
      bodyRegion: cleanNullable(item?.bodyRegion),
      therapeuticGoal: cleanNullable(item?.therapeuticGoal),
      clinicalPhase: cleanNullable(item?.clinicalPhase),
      notes: cleanNullable(item?.notes),
      minAgeYears,
      maxAgeYears,
      professionalArea: cleanNullable(item?.professionalArea)
    };
  }).filter((item) => Object.values(item).some((value) => value !== null && value !== ''));
}

function mapVersion(row) {
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

function mapIndication(row) {
  return {
    id: row.id,
    protocolVersionId: row.protocol_version_id,
    condition: row.condition_name ?? null,
    symptom: row.symptom,
    bodyRegion: row.body_region,
    therapeuticGoal: row.therapeutic_goal,
    clinicalPhase: row.clinical_phase,
    notes: row.notes,
    minAgeYears: row.min_age_years ?? null,
    maxAgeYears: row.max_age_years ?? null,
    professionalArea: row.professional_area ?? null
  };
}

function listIndications(db, protocolVersionId) {
  return db.prepare(`
    SELECT pi.*, c.canonical_name AS condition_name
    FROM protocol_indications pi
    LEFT JOIN conditions c ON c.id = pi.condition_id
    WHERE pi.protocol_version_id = ?
    ORDER BY pi.rowid
  `).all(protocolVersionId).map(mapIndication);
}

function findOrCreateCondition(db, conditionName) {
  const name = cleanNullable(conditionName);
  if (!name) return null;
  const existing = db.prepare('SELECT id FROM conditions WHERE lower(canonical_name) = lower(?) LIMIT 1').get(name);
  if (existing) return existing.id;
  const id = randomUUID();
  db.prepare('INSERT INTO conditions(id, canonical_name, category, description, active) VALUES (?, ?, NULL, NULL, 1)')
    .run(id, name);
  return id;
}

function insertIndications(db, protocolVersionId, indications) {
  const statement = db.prepare(`
    INSERT INTO protocol_indications(
      id, protocol_version_id, condition_id, symptom, body_region, therapeutic_goal, notes, clinical_phase,
      min_age_years, max_age_years, professional_area
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const indication of indications) {
    statement.run(
      randomUUID(), protocolVersionId, findOrCreateCondition(db, indication.condition),
      indication.symptom, indication.bodyRegion, indication.therapeuticGoal, indication.notes, indication.clinicalPhase,
      indication.minAgeYears, indication.maxAgeYears, indication.professionalArea
    );
  }
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

function stripIndicationIdentity(indications) {
  return indications.map(({ id, protocolVersionId, ...content }) => content);
}

function includesText(value, expected) {
  if (!expected) return true;
  return String(value ?? '').toLocaleLowerCase('pt-BR').includes(expected);
}

export function createF2Service(db) {
  const base = createF0Service(db);

  const service = {
    ...base,

    getStatus() {
      return { ...base.getStatus(), phase: 'F2' };
    },

    listProtocolVersions(protocolId) {
      return db.prepare('SELECT * FROM protocol_versions WHERE protocol_id = ? ORDER BY version_number')
        .all(protocolId)
        .map((row) => ({ ...mapVersion(row), indications: listIndications(db, row.id) }));
    },

    searchProtocols(filters = {}) {
      const normalized = Object.fromEntries(
        Object.entries(filters).map(([key, value]) => [key, String(value ?? '').trim().toLocaleLowerCase('pt-BR')])
      );
      const protocols = base.listProtocols();
      return protocols.filter((protocol) => {
        const currentVersion = service.listProtocolVersions(protocol.id)
          .find((version) => version.id === protocol.currentVersionId);
        const indications = currentVersion?.indications ?? [];
        const specificFilters = [
          ['condition', 'condition'],
          ['symptom', 'symptom'],
          ['bodyRegion', 'bodyRegion'],
          ['therapeuticGoal', 'therapeuticGoal'],
          ['clinicalPhase', 'clinicalPhase']
        ].filter(([filterKey]) => normalized[filterKey]);
        const specificMatch = !specificFilters.length || indications.some((indication) =>
          specificFilters.every(([filterKey, field]) => includesText(indication[field], normalized[filterKey]))
        );
        if (!specificMatch) return false;
        if (!normalized.query) return true;
        const searchable = [
          protocol.title,
          ...indications.flatMap((item) => [item.condition, item.symptom, item.bodyRegion, item.therapeuticGoal, item.clinicalPhase])
        ];
        return searchable.some((value) => includesText(value, normalized.query));
      }).map((protocol) => {
        const currentVersion = service.listProtocolVersions(protocol.id)
          .find((version) => version.id === protocol.currentVersionId) ?? null;
        return { ...protocol, currentVersion, indications: currentVersion?.indications ?? [] };
      });
    },

    createProtocol({
      title,
      changeSummary,
      sourceType = 'professional',
      sourceReference = null,
      clinicalRationale = null,
      parameters = {},
      indications = []
    }, actorId = SEED_IDS.professional) {
      const cleanTitle = String(title ?? '').trim();
      const cleanSummary = String(changeSummary ?? '').trim();
      if (!cleanTitle) throw new Error('Protocol title is required');
      if (!cleanSummary) throw new Error('Change summary is required');
      const normalizedParameters = normalizeProtocolParameters(parameters);
      const normalizedIndications = normalizeIndications(indications);
      const protocolId = randomUUID();
      const versionId = randomUUID();

      db.exec('BEGIN IMMEDIATE;');
      try {
        db.prepare("INSERT INTO protocols(id, title, status, created_by, current_version_id) VALUES (?, ?, 'draft', ?, NULL)")
          .run(protocolId, cleanTitle, actorId);
        db.prepare(`
          INSERT INTO protocol_versions(
            id, protocol_id, version_number, status, change_summary, source_type,
            source_reference, clinical_rationale, parameters_json
          ) VALUES (?, ?, 1, 'draft', ?, ?, ?, ?, ?)
        `).run(
          versionId, protocolId, cleanSummary, sourceType,
          cleanNullable(sourceReference), cleanNullable(clinicalRationale), JSON.stringify(normalizedParameters)
        );
        insertIndications(db, versionId, normalizedIndications);
        db.prepare('UPDATE protocols SET current_version_id = ? WHERE id = ?').run(versionId, protocolId);
        appendAudit(db, base, {
          action: 'protocol.created', entityType: 'protocol', entityId: protocolId, actorId,
          payload: { title: cleanTitle, versionId, indicationCount: normalizedIndications.length }
        });
        db.exec('COMMIT;');
      } catch (error) {
        db.exec('ROLLBACK;');
        throw error;
      }
      return base.listProtocols().find((item) => item.id === protocolId);
    },

    createProtocolVersion(protocolId, {
      changeSummary,
      sourceType = 'professional',
      sourceReference = null,
      clinicalRationale = null,
      parameters,
      indications
    }, actorId = SEED_IDS.professional) {
      const protocol = db.prepare('SELECT * FROM protocols WHERE id = ?').get(protocolId);
      if (!protocol) throw new Error('Protocol not found');
      const cleanSummary = String(changeSummary ?? '').trim();
      if (!cleanSummary) throw new Error('Change summary is required');
      const previous = db.prepare('SELECT * FROM protocol_versions WHERE protocol_id = ? ORDER BY version_number DESC LIMIT 1')
        .get(protocolId);
      if (!previous) throw new Error('Previous protocol version is required');

      const nextParameters = parameters === undefined
        ? parseJson(previous.parameters_json, {})
        : normalizeProtocolParameters(parameters);
      const previousIndications = stripIndicationIdentity(listIndications(db, previous.id));
      const nextIndications = indications === undefined ? previousIndications : normalizeIndications(indications);
      const versionId = randomUUID();
      const nextNumber = previous.version_number + 1;

      db.exec('BEGIN IMMEDIATE;');
      try {
        db.prepare(`
          INSERT INTO protocol_versions(
            id, protocol_id, version_number, status, change_summary, source_type,
            source_reference, clinical_rationale, parameters_json
          ) VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?)
        `).run(
          versionId, protocolId, nextNumber, cleanSummary, sourceType,
          cleanNullable(sourceReference), cleanNullable(clinicalRationale), JSON.stringify(nextParameters)
        );
        insertIndications(db, versionId, nextIndications);
        db.prepare('UPDATE protocols SET current_version_id = ? WHERE id = ?').run(versionId, protocolId);
        appendAudit(db, base, {
          action: 'protocol.version_created', entityType: 'protocol_version', entityId: versionId, actorId,
          payload: { protocolId, versionNumber: nextNumber, changeSummary: cleanSummary, indicationCount: nextIndications.length }
        });
        db.exec('COMMIT;');
      } catch (error) {
        db.exec('ROLLBACK;');
        throw error;
      }
      return service.listProtocolVersions(protocolId).at(-1);
    }
  };

  return service;
}
