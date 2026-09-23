import { randomUUID } from 'node:crypto';
import { createF6Service } from './f6-service.js';
import { buildAuditEvent } from '../core/audit.js';
import { SEED_IDS } from './seed.js';
import { BODY_MAP_CATALOG, normalizeBodyMapPoint } from '../domain/body-map.js';

function cleanNullable(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function parseJson(value, fallback = {}) {
  try { return JSON.parse(value ?? ''); } catch { return fallback; }
}

function mapApplicationPoint(row) {
  if (!row) return null;
  return {
    id: row.id,
    treatmentSessionId: row.treatment_session_id,
    sequenceNumber: row.sequence_number,
    bodyRegion: row.body_region,
    anatomicalLabel: row.anatomical_label,
    coordinates: parseJson(row.coordinates_json, null),
    parameters: parseJson(row.parameters_json, {}),
    appliedAt: row.applied_at
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

export function createF7Service(db) {
  const base = createF6Service(db);

  const service = {
    ...base,

    getStatus() {
      return { ...base.getStatus(), phase: 'F7' };
    },

    getBodyMapCatalog() {
      return BODY_MAP_CATALOG.map((item) => ({
        id: item.id,
        label: item.label,
        views: [...item.views],
        centers: Object.fromEntries(Object.entries(item.centers).map(([view, coordinates]) => [view, [...coordinates]]))
      }));
    },

    recordBodyMapPoint(sessionId, input = {}, actorId = SEED_IDS.professional) {
      const session = db.prepare(`
        SELECT ts.id, ts.encounter_id, e.patient_id
        FROM treatment_sessions ts
        JOIN encounters e ON e.id = ts.encounter_id
        WHERE ts.id = ?
      `).get(sessionId);
      if (!session) throw new Error('Treatment session not found');

      const sequenceNumber = Number(input.sequenceNumber);
      if (!Number.isInteger(sequenceNumber) || sequenceNumber <= 0) {
        throw new Error('Sequence number must be a positive integer');
      }
      const normalized = normalizeBodyMapPoint(input);
      const parameters = input.parameters ?? {};
      if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
        throw new Error('Application point parameters must be an object');
      }
      const coordinates = {
        schemaVersion: 1,
        regionId: normalized.regionId,
        view: normalized.view,
        laterality: normalized.laterality,
        x: normalized.x,
        y: normalized.y
      };
      const id = randomUUID();
      const appliedAt = new Date().toISOString();

      db.exec('BEGIN IMMEDIATE;');
      try {
        db.prepare(`
          INSERT INTO application_points(
            id, treatment_session_id, sequence_number, body_region, anatomical_label,
            coordinates_json, parameters_json, applied_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id, sessionId, sequenceNumber, normalized.regionLabel, cleanNullable(normalized.anatomicalLabel),
          JSON.stringify(coordinates), JSON.stringify(parameters), appliedAt
        );
        appendAudit(db, base, {
          action: 'body_map_point.recorded',
          entityType: 'application_point',
          entityId: id,
          actorId,
          payload: {
            patientId: session.patient_id,
            encounterId: session.encounter_id,
            treatmentSessionId: sessionId,
            sequenceNumber,
            bodyRegion: normalized.regionLabel,
            anatomicalLabel: normalized.anatomicalLabel,
            coordinates
          }
        });
        db.exec('COMMIT;');
      } catch (error) {
        db.exec('ROLLBACK;');
        throw error;
      }
      return mapApplicationPoint(db.prepare('SELECT * FROM application_points WHERE id = ?').get(id));
    },

    listBodyMapPoints(patientId) {
      return base.listApplicationPoints(patientId)
        .filter((item) => item.coordinates?.schemaVersion === 1 && item.coordinates?.regionId);
    },

    getPatientWorkspace(patientId) {
      const workspace = base.getPatientWorkspace(patientId);
      return {
        ...workspace,
        bodyMapPoints: service.listBodyMapPoints(patientId)
      };
    }
  };

  return service;
}
