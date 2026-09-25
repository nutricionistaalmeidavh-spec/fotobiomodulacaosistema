import { randomUUID } from 'node:crypto';
import { createF4MvpService } from './f4-mvp-service.js';
import { normalizeOutcome } from '../domain/outcomes.js';
import { buildAuditEvent } from '../core/audit.js';
import { SEED_IDS } from './seed.js';

function cleanNullable(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function mapOutcome(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    encounterId: row.encounter_id,
    treatmentSessionId: row.treatment_session_id,
    professionalId: row.professional_id,
    metricType: row.metric_type,
    metricValue: row.metric_value,
    metricUnit: row.metric_unit,
    narrative: row.narrative,
    baselineGroup: row.baseline_group,
    measuredAt: row.measured_at
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
      id, actor_type, actor_id, action, entity_type, entity_id,
      payload_json, prev_hash, event_hash, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    event.id, event.actorType, event.actorId, event.action, event.entityType, event.entityId,
    JSON.stringify(event.payload), event.prevHash, event.eventHash, event.createdAt
  );
  return event;
}

function assertPatient(db, patientId) {
  const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(patientId);
  if (!patient) throw new Error('Patient not found');
}

function assertClinicalLinks(db, patientId, encounterId, treatmentSessionId) {
  if (encounterId) {
    const encounter = db.prepare('SELECT patient_id FROM encounters WHERE id = ?').get(encounterId);
    if (!encounter) throw new Error('Encounter not found');
    if (encounter.patient_id !== patientId) throw new Error('Encounter does not belong to patient');
  }

  if (treatmentSessionId) {
    const session = db.prepare(`
      SELECT e.patient_id
      FROM treatment_sessions ts
      JOIN encounters e ON e.id = ts.encounter_id
      WHERE ts.id = ?
    `).get(treatmentSessionId);
    if (!session) throw new Error('Treatment session not found');
    if (session.patient_id !== patientId) throw new Error('Treatment session does not belong to patient');
  }
}

function timelineKey(item) {
  return `${item.type || 'event'}:${item.id || ''}`;
}

export function createF5Service(db, options = {}) {
  const base = createF4MvpService(db, options);

  const service = {
    ...base,

    getStatus() {
      return { ...base.getStatus(), phase: 'F5', milestone: 'LONGITUDINAL_OUTCOMES' };
    },

    recordOutcome({
      patientId,
      encounterId = null,
      treatmentSessionId = null,
      metricType,
      metricValue = null,
      metricUnit = null,
      narrative = null,
      baselineGroup = null,
      measuredAt = null
    } = {}, actorId = SEED_IDS.professional) {
      assertPatient(db, patientId);
      assertClinicalLinks(db, patientId, cleanNullable(encounterId), cleanNullable(treatmentSessionId));

      const normalized = normalizeOutcome({
        type: metricType,
        value: metricValue,
        unit: metricUnit,
        narrative
      });
      const id = randomUUID();
      const at = cleanNullable(measuredAt) || new Date().toISOString();
      const group = cleanNullable(baselineGroup);
      const encounter = cleanNullable(encounterId);
      const session = cleanNullable(treatmentSessionId);

      db.exec('BEGIN IMMEDIATE;');
      try {
        db.prepare(`
          INSERT INTO outcomes(
            id, patient_id, encounter_id, treatment_session_id,
            metric_type, metric_value, metric_unit, narrative, measured_at,
            professional_id, baseline_group
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id, patientId, encounter, session,
          normalized.type, normalized.value, normalized.unit, normalized.narrative, at,
          actorId, group
        );
        appendAudit(db, base, {
          action: 'outcome.recorded',
          entityType: 'outcome',
          entityId: id,
          actorId,
          payload: {
            patientId,
            encounterId: encounter,
            treatmentSessionId: session,
            metricType: normalized.type,
            metricValue: normalized.value,
            metricUnit: normalized.unit,
            baselineGroup: group
          }
        });
        db.exec('COMMIT;');
      } catch (error) {
        db.exec('ROLLBACK;');
        throw error;
      }

      return mapOutcome(db.prepare('SELECT * FROM outcomes WHERE id = ?').get(id));
    },

    listOutcomes(patientId, { metricType = null, baselineGroup = null, order = 'desc' } = {}) {
      assertPatient(db, patientId);
      const clauses = ['patient_id = ?'];
      const params = [patientId];
      const type = cleanNullable(metricType);
      const group = cleanNullable(baselineGroup);

      if (type) {
        clauses.push('metric_type = ?');
        params.push(type);
      }
      if (group) {
        clauses.push('baseline_group = ?');
        params.push(group);
      }

      const direction = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
      return db.prepare(`
        SELECT * FROM outcomes
        WHERE ${clauses.join(' AND ')}
        ORDER BY measured_at ${direction}, rowid ${direction}
      `).all(...params).map(mapOutcome);
    },

    getOutcomeSeries(patientId, metricType, { baselineGroup = null } = {}) {
      const type = cleanNullable(metricType);
      if (!type) throw new Error('Metric type is required');
      const points = service.listOutcomes(patientId, {
        metricType: type,
        baselineGroup,
        order: 'asc'
      });
      const numericPoints = points.filter((point) => Number.isFinite(point.metricValue));
      const firstValue = numericPoints.length ? numericPoints[0].metricValue : null;
      const latestValue = numericPoints.length ? numericPoints.at(-1).metricValue : null;
      return {
        patientId,
        metricType: type,
        baselineGroup: cleanNullable(baselineGroup),
        points,
        firstValue,
        latestValue,
        absoluteChange: firstValue == null || latestValue == null ? null : latestValue - firstValue
      };
    },

    getPatientWorkspace(patientId) {
      const workspace = base.getPatientWorkspace(patientId);
      const outcomes = service.listOutcomes(patientId);
      const outcomeTimeline = outcomes.map((item) => ({
        type: 'outcome',
        id: item.id,
        at: item.measuredAt,
        ...item
      }));
      const uniqueTimeline = new Map();
      for (const item of [...workspace.timeline.filter((item) => item.type !== 'outcome'), ...outcomeTimeline]) {
        uniqueTimeline.set(timelineKey(item), item);
      }

      return {
        ...workspace,
        outcomes,
        basicOutcomes: outcomes,
        documents: base.listDocuments(patientId),
        timeline: [...uniqueTimeline.values()]
          .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
      };
    },

    getPatientTimeline(patientId, { order = 'asc' } = {}) {
      const workspace = service.getPatientWorkspace(patientId);
      const direction = String(order).toLowerCase() === 'desc' ? 'desc' : 'asc';
      return [...workspace.timeline].sort((a, b) => direction === 'asc'
        ? String(a.at || '').localeCompare(String(b.at || ''))
        : String(b.at || '').localeCompare(String(a.at || '')));
    }
  };

  return service;
}
