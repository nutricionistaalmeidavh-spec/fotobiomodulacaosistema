import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createF4Service } from './f4-service.js';
import { verifyBackup } from '../core/backup.js';
import { buildAuditEvent } from '../core/audit.js';
import { SEED_IDS } from './seed.js';

function parseJson(value, fallback = {}) {
  try { return JSON.parse(value ?? ''); } catch { return fallback; }
}

function cleanNullable(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function mapApplicationPoint(row) {
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

export function createF4MvpService(db, options = {}) {
  const base = createF4Service(db, options);
  const roots = base.getStorageRoots();

  const service = {
    ...base,

    getStatus() {
      return { ...base.getStatus(), phase: 'F4', milestone: 'MVP' };
    },

    recordApplicationPoint(sessionId, {
      sequenceNumber,
      bodyRegion = null,
      anatomicalLabel = null,
      parameters = {}
    } = {}, actorId = SEED_IDS.professional) {
      const session = db.prepare(`
        SELECT ts.id, ts.encounter_id, e.patient_id
        FROM treatment_sessions ts
        JOIN encounters e ON e.id = ts.encounter_id
        WHERE ts.id = ?
      `).get(sessionId);
      if (!session) throw new Error('Treatment session not found');
      const sequence = Number(sequenceNumber);
      if (!Number.isInteger(sequence) || sequence <= 0) throw new Error('Sequence number must be a positive integer');
      if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) throw new Error('Application point parameters must be an object');
      const id = randomUUID();
      const appliedAt = new Date().toISOString();
      db.exec('BEGIN IMMEDIATE;');
      try {
        db.prepare(`
          INSERT INTO application_points(
            id, treatment_session_id, sequence_number, body_region, anatomical_label,
            coordinates_json, parameters_json, applied_at
          ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
        `).run(
          id, sessionId, sequence, cleanNullable(bodyRegion), cleanNullable(anatomicalLabel),
          JSON.stringify(parameters), appliedAt
        );
        appendAudit(db, base, {
          action: 'application_point.created',
          entityType: 'application_point',
          entityId: id,
          actorId,
          payload: {
            patientId: session.patient_id,
            encounterId: session.encounter_id,
            treatmentSessionId: sessionId,
            sequenceNumber: sequence,
            bodyRegion: cleanNullable(bodyRegion),
            anatomicalLabel: cleanNullable(anatomicalLabel),
            parameters
          }
        });
        db.exec('COMMIT;');
      } catch (error) {
        db.exec('ROLLBACK;');
        throw error;
      }
      return mapApplicationPoint(db.prepare('SELECT * FROM application_points WHERE id = ?').get(id));
    },

    listApplicationPoints(patientId) {
      const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(patientId);
      if (!patient) throw new Error('Patient not found');
      return db.prepare(`
        SELECT ap.*
        FROM application_points ap
        JOIN treatment_sessions ts ON ts.id = ap.treatment_session_id
        JOIN encounters e ON e.id = ts.encounter_id
        WHERE e.patient_id = ?
        ORDER BY ap.applied_at DESC, ts.started_at DESC, ap.sequence_number, ap.rowid
      `).all(patientId).map(mapApplicationPoint);
    },

    verifyLocalBackup(backupPath) {
      const root = path.resolve(roots.backupRoot);
      const target = path.resolve(String(backupPath ?? '').trim());
      if (!backupPath || target === root || !target.startsWith(`${root}${path.sep}`)) {
        throw new Error('Backup path must be inside the configured backup root');
      }
      return verifyBackup(target);
    },

    getPatientWorkspace(patientId) {
      const workspace = base.getPatientWorkspace(patientId);
      const applicationPoints = service.listApplicationPoints(patientId);
      return {
        ...workspace,
        applicationPoints,
        timeline: [
          ...workspace.timeline,
          ...applicationPoints.map((item) => ({
            type: 'application_point',
            id: item.id,
            at: item.appliedAt,
            ...item
          }))
        ].sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
      };
    }
  };

  return service;
}
