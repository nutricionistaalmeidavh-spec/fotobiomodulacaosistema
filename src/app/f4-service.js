import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createF3Service } from './f3-service.js';
import { storeClinicalImageFile } from '../core/clinical-storage.js';
import { buildAuditEvent } from '../core/audit.js';
import { SEED_IDS } from './seed.js';

function parseJson(value, fallback = {}) {
  try { return JSON.parse(value ?? ''); } catch { return fallback; }
}

function cleanNullable(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function requireText(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${label} is required`);
  return text;
}

function mapConsent(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    professionalId: row.professional_id,
    consentType: row.consent_type,
    version: row.version,
    status: row.status,
    evidence: parseJson(row.evidence_json, {}),
    acceptedAt: row.accepted_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at
  };
}

function mapMedia(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    encounterId: row.encounter_id,
    treatmentSessionId: row.treatment_session_id,
    mediaType: row.media_type,
    storagePath: row.storage_path,
    sha256: row.sha256,
    caption: row.caption,
    capturedAt: row.captured_at,
    createdAt: row.created_at,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    byteSize: row.byte_size
  };
}

function mapOutcome(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    encounterId: row.encounter_id,
    treatmentSessionId: row.treatment_session_id,
    metricType: row.metric_type,
    metricValue: row.metric_value,
    metricUnit: row.metric_unit,
    narrative: row.narrative,
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
      id, actor_type, actor_id, action, entity_type, entity_id, payload_json, prev_hash, event_hash, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    event.id, event.actorType, event.actorId, event.action, event.entityType, event.entityId,
    JSON.stringify(event.payload), event.prevHash, event.eventHash, event.createdAt
  );
  return event;
}

function assertPatient(db, patientId) {
  const patient = db.prepare('SELECT id, active FROM patients WHERE id = ?').get(patientId);
  if (!patient) throw new Error('Patient not found');
  return patient;
}

export function createF4Service(db, {
  storageRoot = path.resolve('data/clinical-assets'),
  backupRoot = path.resolve('data/backups')
} = {}) {
  const base = createF3Service(db);
  const roots = Object.freeze({ storageRoot: path.resolve(storageRoot), backupRoot: path.resolve(backupRoot) });

  const service = {
    ...base,

    getStatus() {
      return { ...base.getStatus(), phase: 'F4' };
    },

    getStorageRoots() {
      return roots;
    },

    acceptConsent({ patientId, consentType, version, evidence = {} } = {}, actorId = SEED_IDS.professional) {
      assertPatient(db, patientId);
      const type = requireText(consentType, 'Consent type');
      const consentVersion = requireText(version, 'Consent version');
      if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) throw new Error('Consent evidence must be an object');
      const id = randomUUID();
      const now = new Date().toISOString();
      db.exec('BEGIN IMMEDIATE;');
      try {
        db.prepare(`
          INSERT INTO consents(
            id, patient_id, professional_id, consent_type, version, status, evidence_json, accepted_at, revoked_at, created_at
          ) VALUES (?, ?, ?, ?, ?, 'accepted', ?, ?, NULL, ?)
        `).run(id, patientId, actorId, type, consentVersion, JSON.stringify(evidence), now, now);
        appendAudit(db, base, {
          action: 'consent.accepted', entityType: 'consent', entityId: id, actorId,
          payload: { patientId, consentType: type, version: consentVersion }
        });
        db.exec('COMMIT;');
      } catch (error) {
        db.exec('ROLLBACK;');
        throw error;
      }
      return mapConsent(db.prepare('SELECT * FROM consents WHERE id = ?').get(id));
    },

    revokeConsent(consentId, reason, actorId = SEED_IDS.professional) {
      const current = db.prepare('SELECT * FROM consents WHERE id = ?').get(consentId);
      if (!current) throw new Error('Consent not found');
      if (current.status !== 'accepted') throw new Error('Only accepted consent can be revoked');
      const cleanReason = requireText(reason, 'Revocation reason');
      const id = randomUUID();
      const now = new Date().toISOString();
      const evidence = { relatedConsentId: current.id, reason: cleanReason };
      db.exec('BEGIN IMMEDIATE;');
      try {
        db.prepare(`
          INSERT INTO consents(
            id, patient_id, professional_id, consent_type, version, status, evidence_json, accepted_at, revoked_at, created_at
          ) VALUES (?, ?, ?, ?, ?, 'revoked', ?, NULL, ?, ?)
        `).run(id, current.patient_id, actorId, current.consent_type, current.version, JSON.stringify(evidence), now, now);
        appendAudit(db, base, {
          action: 'consent.revoked', entityType: 'consent', entityId: id, actorId,
          payload: { patientId: current.patient_id, relatedConsentId: current.id, reason: cleanReason }
        });
        db.exec('COMMIT;');
      } catch (error) {
        db.exec('ROLLBACK;');
        throw error;
      }
      return mapConsent(db.prepare('SELECT * FROM consents WHERE id = ?').get(id));
    },

    listConsents(patientId) {
      assertPatient(db, patientId);
      return db.prepare('SELECT * FROM consents WHERE patient_id = ? ORDER BY rowid').all(patientId).map(mapConsent);
    },

    storeClinicalImage({
      patientId,
      encounterId = null,
      treatmentSessionId = null,
      originalFilename,
      mimeType,
      dataBase64,
      caption = null,
      capturedAt = null
    } = {}, actorId = SEED_IDS.professional) {
      assertPatient(db, patientId);
      const stored = storeClinicalImageFile({
        storageRoot: roots.storageRoot,
        patientId,
        originalFilename,
        mimeType,
        dataBase64
      });
      const id = randomUUID();
      const now = new Date().toISOString();
      try {
        db.exec('BEGIN IMMEDIATE;');
        db.prepare(`
          INSERT INTO clinical_media(
            id, patient_id, encounter_id, treatment_session_id, media_type, storage_path, sha256,
            caption, captured_at, created_at, original_filename, mime_type, byte_size
          ) VALUES (?, ?, ?, ?, 'image', ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id, patientId, cleanNullable(encounterId), cleanNullable(treatmentSessionId), stored.storagePath, stored.sha256,
          cleanNullable(caption), cleanNullable(capturedAt), now, stored.originalFilename, stored.mimeType, stored.byteSize
        );
        appendAudit(db, base, {
          action: 'clinical_media.created', entityType: 'clinical_media', entityId: id, actorId,
          payload: { patientId, mimeType: stored.mimeType, byteSize: stored.byteSize, sha256: stored.sha256 }
        });
        db.exec('COMMIT;');
      } catch (error) {
        try { db.exec('ROLLBACK;'); } catch {}
        fs.rmSync(stored.storagePath, { force: true });
        throw error;
      }
      return mapMedia(db.prepare('SELECT * FROM clinical_media WHERE id = ?').get(id));
    },

    listClinicalMedia(patientId) {
      assertPatient(db, patientId);
      return db.prepare('SELECT * FROM clinical_media WHERE patient_id = ? ORDER BY created_at DESC, rowid DESC')
        .all(patientId).map(mapMedia);
    },

    recordBasicOutcome({
      patientId,
      encounterId = null,
      treatmentSessionId = null,
      metricType = 'clinical_note',
      metricValue = null,
      metricUnit = null,
      narrative,
      measuredAt = null
    } = {}, actorId = SEED_IDS.professional) {
      assertPatient(db, patientId);
      const type = requireText(metricType, 'Metric type');
      const note = requireText(narrative, 'Outcome narrative');
      const value = metricValue == null || metricValue === '' ? null : Number(metricValue);
      if (value != null && !Number.isFinite(value)) throw new Error('Metric value must be numeric');
      const id = randomUUID();
      const at = cleanNullable(measuredAt) || new Date().toISOString();
      db.exec('BEGIN IMMEDIATE;');
      try {
        db.prepare(`
          INSERT INTO outcomes(
            id, patient_id, encounter_id, treatment_session_id, metric_type, metric_value, metric_unit, narrative, measured_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id, patientId, cleanNullable(encounterId), cleanNullable(treatmentSessionId), type, value,
          cleanNullable(metricUnit), note, at
        );
        appendAudit(db, base, {
          action: 'outcome.recorded', entityType: 'outcome', entityId: id, actorId,
          payload: { patientId, metricType: type, metricValue: value, metricUnit: cleanNullable(metricUnit) }
        });
        db.exec('COMMIT;');
      } catch (error) {
        db.exec('ROLLBACK;');
        throw error;
      }
      return mapOutcome(db.prepare('SELECT * FROM outcomes WHERE id = ?').get(id));
    },

    listBasicOutcomes(patientId) {
      assertPatient(db, patientId);
      return db.prepare('SELECT * FROM outcomes WHERE patient_id = ? ORDER BY measured_at DESC, rowid DESC')
        .all(patientId).map(mapOutcome);
    },

    getPatientWorkspace(patientId) {
      const workspace = base.getPatientWorkspace(patientId);
      const consents = service.listConsents(patientId);
      const media = service.listClinicalMedia(patientId);
      const basicOutcomes = service.listBasicOutcomes(patientId);
      const extraTimeline = [
        ...consents.map((item) => ({ type: 'consent', id: item.id, at: item.createdAt, ...item })),
        ...media.map((item) => ({ type: 'clinical_media', id: item.id, at: item.capturedAt || item.createdAt, ...item }))
      ];
      return {
        ...workspace,
        consents,
        media,
        basicOutcomes,
        timeline: [...workspace.timeline, ...extraTimeline]
          .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
      };
    }
  };

  return service;
}
