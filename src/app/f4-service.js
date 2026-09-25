import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createF3Service } from './f3-service.js';
import { storeClinicalImageFile } from '../core/clinical-storage.js';
import { generateEncounterPdf } from '../core/pdf.js';
import { createBackup, verifyBackup } from '../core/backup.js';
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

function mapDocument(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    encounterId: row.encounter_id,
    documentType: row.document_type,
    status: row.status,
    title: row.title,
    storagePath: row.storage_path,
    content: parseJson(row.content_json, {}),
    createdBy: row.created_by,
    createdAt: row.created_at,
    finalizedAt: row.finalized_at,
    sha256: row.sha256
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

    listDocuments(patientId) {
      assertPatient(db, patientId);
      return db.prepare('SELECT * FROM documents WHERE patient_id = ? ORDER BY created_at DESC, rowid DESC')
        .all(patientId).map(mapDocument);
    },

    finalizeEncounterPdf(encounterId, actorId = SEED_IDS.professional) {
      const encounter = db.prepare(`
        SELECT e.*, p.full_name AS patient_name, p.id AS patient_id_resolved
        FROM encounters e
        JOIN patients p ON p.id = e.patient_id
        WHERE e.id = ?
      `).get(encounterId);
      if (!encounter) throw new Error('Encounter not found');
      const assessment = encounter.assessment_id
        ? db.prepare('SELECT * FROM assessments WHERE id = ?').get(encounter.assessment_id)
        : null;
      const sessions = db.prepare(`
        SELECT ts.*, p.title AS protocol_title, pv.version_number,
               eq.manufacturer AS equipment_manufacturer, eq.model AS equipment_model,
               a.name AS applicator_name
        FROM treatment_sessions ts
        LEFT JOIN protocols p ON p.id = ts.protocol_id
        LEFT JOIN protocol_versions pv ON pv.id = ts.protocol_version_id
        LEFT JOIN equipment eq ON eq.id = ts.equipment_id
        LEFT JOIN applicators a ON a.id = ts.applicator_id
        WHERE ts.encounter_id = ?
        ORDER BY ts.started_at, ts.rowid
      `).all(encounterId).map((row) => ({
        ...row,
        protocolTitle: row.protocol_title,
        protocolVersionNumber: row.version_number,
        equipmentManufacturer: row.equipment_manufacturer,
        equipmentModel: row.equipment_model,
        applicatorName: row.applicator_name,
        plannedParameters: parseJson(row.planned_parameters_json, {}),
        appliedParameters: parseJson(row.applied_parameters_json, {}),
        professionalAdjustmentReason: row.professional_adjustment_reason
      }));
      const applicationPoints = db.prepare(`
        SELECT ap.*
        FROM application_points ap
        JOIN treatment_sessions ts ON ts.id = ap.treatment_session_id
        WHERE ts.encounter_id = ?
        ORDER BY ts.started_at, ap.sequence_number, ap.rowid
      `).all(encounterId).map((row) => ({
        ...row,
        sequenceNumber: row.sequence_number,
        bodyRegion: row.body_region,
        anatomicalLabel: row.anatomical_label,
        parameters: parseJson(row.parameters_json, {})
      }));
      const outcomes = db.prepare(`
        SELECT * FROM outcomes
        WHERE patient_id = ? AND (
          encounter_id = ? OR treatment_session_id IN (SELECT id FROM treatment_sessions WHERE encounter_id = ?)
        )
        ORDER BY measured_at, rowid
      `).all(encounter.patient_id, encounterId, encounterId).map(mapOutcome);

      const pdf = generateEncounterPdf({
        patient: { id: encounter.patient_id, fullName: encounter.patient_name },
        encounter: {
          id: encounter.id,
          startedAt: encounter.started_at,
          finalizedAt: encounter.finalized_at,
          status: encounter.status,
          notes: encounter.notes
        },
        assessment: assessment ? {
          chiefComplaint: assessment.chief_complaint,
          history: assessment.history,
          painScore: assessment.pain_score
        } : null,
        sessions,
        applicationPoints,
        outcomes
      });
      const id = randomUUID();
      const directory = path.join(roots.storageRoot, 'documents', encounter.patient_id);
      fs.mkdirSync(directory, { recursive: true });
      const storagePath = path.join(directory, `${id}.pdf`);
      fs.writeFileSync(storagePath, pdf, { flag: 'wx' });
      const sha256 = createHash('sha256').update(pdf).digest('hex');
      const now = new Date().toISOString();
      try {
        db.exec('BEGIN IMMEDIATE;');
        db.prepare(`
          INSERT INTO documents(
            id, patient_id, encounter_id, document_type, status, title, storage_path,
            content_json, created_by, created_at, finalized_at, sha256
          ) VALUES (?, ?, ?, 'encounter_pdf', 'finalized', ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id, encounter.patient_id, encounterId, `Registro do atendimento ${encounterId}`, storagePath,
          JSON.stringify({ patientId: encounter.patient_id, encounterId, format: 'pdf' }),
          actorId, now, now, sha256
        );
        appendAudit(db, base, {
          action: 'document.finalized', entityType: 'document', entityId: id, actorId,
          payload: { patientId: encounter.patient_id, encounterId, sha256 }
        });
        db.exec('COMMIT;');
      } catch (error) {
        try { db.exec('ROLLBACK;'); } catch {}
        fs.rmSync(storagePath, { force: true });
        throw error;
      }
      return mapDocument(db.prepare('SELECT * FROM documents WHERE id = ?').get(id));
    },

    createLocalBackup(actorId = SEED_IDS.professional) {
      const backup = createBackup({ db, assetRoot: roots.storageRoot, destinationRoot: roots.backupRoot });
      const verification = verifyBackup(backup.backupPath);
      if (!verification.valid) {
        fs.rmSync(backup.backupPath, { recursive: true, force: true });
        throw new Error(`Backup verification failed: ${verification.errors.join('; ')}`);
      }
      appendAudit(db, base, {
        action: 'backup.created', entityType: 'backup', entityId: path.basename(backup.backupPath), actorId,
        payload: { backupPath: backup.backupPath, fileCount: backup.manifest.files.length }
      });
      return { ...backup, verification };
    },

    getPatientWorkspace(patientId) {
      const workspace = base.getPatientWorkspace(patientId);
      const consents = service.listConsents(patientId);
      const media = service.listClinicalMedia(patientId);
      const basicOutcomes = service.listBasicOutcomes(patientId);
      const documents = service.listDocuments(patientId);
      const extraTimeline = [
        ...consents.map((item) => ({ type: 'consent', id: item.id, at: item.createdAt, ...item })),
        ...media.map((item) => ({ type: 'clinical_media', id: item.id, at: item.capturedAt || item.createdAt, ...item })),
        ...documents.map((item) => ({ type: 'document', id: item.id, at: item.finalizedAt || item.createdAt, ...item }))
      ];
      return {
        ...workspace,
        consents,
        media,
        basicOutcomes,
        documents,
        timeline: [...workspace.timeline, ...extraTimeline]
          .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
      };
    }
  };

  return service;
}
