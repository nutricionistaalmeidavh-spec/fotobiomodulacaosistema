import { randomUUID } from 'node:crypto';
import { listTables } from '../db/database.js';
import { buildTreatmentSession } from '../domain/treatment-sessions.js';
import { buildAuditEvent, verifyAuditChain } from '../core/audit.js';
import { ensureSeedData, SEED_IDS } from './seed.js';

function parseJson(value, fallback) {
  try { return JSON.parse(value ?? ''); } catch { return fallback; }
}

function mapPatient(row) {
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.full_name,
    birthDate: row.birth_date,
    documentNumber: row.document_number,
    email: row.email,
    phone: row.phone,
    emergencyContact: row.emergency_contact,
    notes: row.notes,
    active: Boolean(row.active),
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapAssessment(row) {
  if (!row) return null;
  return {
    id: row.id, patientId: row.patient_id, professionalId: row.professional_id,
    chiefComplaint: row.chief_complaint, history: row.history, medications: row.medications,
    allergies: row.allergies, precautions: row.precautions, painScore: row.pain_score,
    recordedAt: row.recorded_at
  };
}

function mapEncounter(row) {
  if (!row) return null;
  return {
    id: row.id, patientId: row.patient_id, professionalId: row.professional_id,
    assessmentId: row.assessment_id, encounterType: row.encounter_type, status: row.status,
    startedAt: row.started_at, finalizedAt: row.finalized_at, notes: row.notes
  };
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

function mapAudit(row) {
  return {
    id: row.id,
    actorType: row.actor_type,
    actorId: row.actor_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    payload: parseJson(row.payload_json, {}),
    prevHash: row.prev_hash,
    eventHash: row.event_hash,
    createdAt: row.created_at
  };
}

function mapSession(row) {
  return {
    id: row.id, encounterId: row.encounter_id, protocolId: row.protocol_id,
    protocolTitle: row.protocol_title, protocolVersionId: row.protocol_version_id,
    protocolVersionNumber: row.version_number, equipmentId: row.equipment_id, applicatorId: row.applicator_id,
    performedBy: row.performed_by, plannedParameters: parseJson(row.planned_parameters_json, {}),
    appliedParameters: parseJson(row.applied_parameters_json, {}),
    professionalAdjustmentReason: row.professional_adjustment_reason, status: row.status,
    startedAt: row.started_at, completedAt: row.completed_at,
    patientId: row.patient_id ?? null, patientName: row.patient_name ?? null
  };
}

function appendAudit(db, { action, entityType, entityId, payload = {}, actorId = SEED_IDS.professional }) {
  const previousRow = db.prepare('SELECT * FROM audit_events ORDER BY rowid DESC LIMIT 1').get();
  const previousEvent = previousRow ? mapAudit(previousRow) : null;
  const event = buildAuditEvent({
    id: randomUUID(), actorType: 'professional', actorId, action, entityType, entityId, payload,
    previousEvent, createdAt: new Date().toISOString()
  });
  db.prepare(`
    INSERT INTO audit_events(
      id, actor_type, actor_id, action, entity_type, entity_id, payload_json, prev_hash, event_hash, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(event.id, event.actorType, event.actorId, event.action, event.entityType, event.entityId,
    JSON.stringify(event.payload), event.prevHash, event.eventHash, event.createdAt);
  return event;
}

function cleanNullable(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

export function createF0Service(db) {
  return {
    ensureSeedData() { return ensureSeedData(db); },

    getStatus() {
      const tables = listTables(db);
      const migrations = db.prepare('SELECT version, applied_at FROM schema_migrations ORDER BY version').all();
      const audit = this.getAudit();
      const patientCount = db.prepare('SELECT COUNT(*) AS count FROM patients WHERE active = 1').get().count;
      const openEncounterCount = db.prepare("SELECT COUNT(*) AS count FROM encounters WHERE status = 'open'").get().count;
      return { phase: 'F1', tableCount: tables.length, tables, migrations, auditValid: audit.valid, patientCount, openEncounterCount };
    },

    listPatients({ includeArchived = false } = {}) {
      const rows = db.prepare(`
        SELECT * FROM patients
        ${includeArchived ? '' : 'WHERE active = 1'}
        ORDER BY full_name
      `).all();
      return rows.map(mapPatient);
    },

    createPatient(data, actorId = SEED_IDS.professional) {
      const fullName = String(data?.fullName ?? '').trim();
      if (!fullName) throw new Error('Patient full name is required');
      const id = randomUUID();
      const now = new Date().toISOString();
      db.exec('BEGIN IMMEDIATE;');
      try {
        db.prepare(`
          INSERT INTO patients(
            id, full_name, birth_date, document_number, email, phone, emergency_contact, notes, active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        `).run(id, fullName, cleanNullable(data.birthDate), cleanNullable(data.documentNumber), cleanNullable(data.email),
          cleanNullable(data.phone), cleanNullable(data.emergencyContact), cleanNullable(data.notes), now, now);
        appendAudit(db, { action: 'patient.created', entityType: 'patient', entityId: id, actorId,
          payload: { fullName, birthDate: cleanNullable(data.birthDate) } });
        db.exec('COMMIT;');
      } catch (error) { db.exec('ROLLBACK;'); throw error; }
      return this.listPatients({ includeArchived: true }).find((item) => item.id === id);
    },

    updatePatient(patientId, data, actorId = SEED_IDS.professional) {
      const current = db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId);
      if (!current) throw new Error('Patient not found');
      const fullName = String(data?.fullName ?? current.full_name ?? '').trim();
      if (!fullName) throw new Error('Patient full name is required');
      const values = {
        birthDate: data?.birthDate !== undefined ? cleanNullable(data.birthDate) : current.birth_date,
        documentNumber: data?.documentNumber !== undefined ? cleanNullable(data.documentNumber) : current.document_number,
        email: data?.email !== undefined ? cleanNullable(data.email) : current.email,
        phone: data?.phone !== undefined ? cleanNullable(data.phone) : current.phone,
        emergencyContact: data?.emergencyContact !== undefined ? cleanNullable(data.emergencyContact) : current.emergency_contact,
        notes: data?.notes !== undefined ? cleanNullable(data.notes) : current.notes
      };
      const now = new Date().toISOString();
      db.exec('BEGIN IMMEDIATE;');
      try {
        db.prepare(`
          UPDATE patients SET full_name = ?, birth_date = ?, document_number = ?, email = ?, phone = ?,
            emergency_contact = ?, notes = ?, updated_at = ? WHERE id = ?
        `).run(fullName, values.birthDate, values.documentNumber, values.email, values.phone,
          values.emergencyContact, values.notes, now, patientId);
        appendAudit(db, { action: 'patient.updated', entityType: 'patient', entityId: patientId, actorId,
          payload: { fullName } });
        db.exec('COMMIT;');
      } catch (error) { db.exec('ROLLBACK;'); throw error; }
      return this.listPatients({ includeArchived: true }).find((item) => item.id === patientId);
    },

    archivePatient(patientId, actorId = SEED_IDS.professional) {
      const current = db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId);
      if (!current) throw new Error('Patient not found');
      const now = new Date().toISOString();
      db.exec('BEGIN IMMEDIATE;');
      try {
        db.prepare('UPDATE patients SET active = 0, archived_at = ?, updated_at = ? WHERE id = ?')
          .run(now, now, patientId);
        appendAudit(db, { action: 'patient.archived', entityType: 'patient', entityId: patientId, actorId,
          payload: { fullName: current.full_name } });
        db.exec('COMMIT;');
      } catch (error) { db.exec('ROLLBACK;'); throw error; }
      return this.listPatients({ includeArchived: true }).find((item) => item.id === patientId);
    },

    startEncounter(patientId, { notes = '', encounterType = 'clinical', assessment = {} } = {}, actorId = SEED_IDS.professional) {
      const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId);
      if (!patient) throw new Error('Patient not found');
      if (!patient.active) throw new Error('Archived patient cannot start a new encounter');
      const encounterId = randomUUID();
      const assessmentId = randomUUID();
      const now = new Date().toISOString();
      const painScore = assessment.painScore === '' || assessment.painScore == null ? null : Number(assessment.painScore);
      if (painScore != null && (!Number.isInteger(painScore) || painScore < 0 || painScore > 10)) {
        throw new Error('Pain score must be between 0 and 10');
      }
      db.exec('BEGIN IMMEDIATE;');
      try {
        db.prepare(`
          INSERT INTO assessments(
            id, patient_id, professional_id, chief_complaint, history, medications, allergies, precautions, pain_score, recorded_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(assessmentId, patientId, actorId, cleanNullable(assessment.chiefComplaint), cleanNullable(assessment.history),
          cleanNullable(assessment.medications), cleanNullable(assessment.allergies), cleanNullable(assessment.precautions), painScore, now);
        db.prepare(`
          INSERT INTO encounters(
            id, patient_id, professional_id, assessment_id, encounter_type, status, started_at, notes
          ) VALUES (?, ?, ?, ?, ?, 'open', ?, ?)
        `).run(encounterId, patientId, actorId, assessmentId, encounterType, now, cleanNullable(notes));
        appendAudit(db, { action: 'assessment.created', entityType: 'assessment', entityId: assessmentId, actorId,
          payload: { patientId, chiefComplaint: cleanNullable(assessment.chiefComplaint), painScore } });
        appendAudit(db, { action: 'encounter.created', entityType: 'encounter', entityId: encounterId, actorId,
          payload: { patientId, assessmentId, encounterType } });
        db.exec('COMMIT;');
      } catch (error) { db.exec('ROLLBACK;'); throw error; }
      return mapEncounter(db.prepare('SELECT * FROM encounters WHERE id = ?').get(encounterId));
    },

    finalizeEncounter(encounterId, actorId = SEED_IDS.professional) {
      const encounter = db.prepare('SELECT * FROM encounters WHERE id = ?').get(encounterId);
      if (!encounter) throw new Error('Encounter not found');
      if (encounter.status !== 'open') throw new Error('Only open encounters can be finalized');
      const now = new Date().toISOString();
      db.exec('BEGIN IMMEDIATE;');
      try {
        db.prepare("UPDATE encounters SET status = 'finalized', finalized_at = ? WHERE id = ?").run(now, encounterId);
        appendAudit(db, { action: 'encounter.finalized', entityType: 'encounter', entityId: encounterId, actorId,
          payload: { patientId: encounter.patient_id } });
        db.exec('COMMIT;');
      } catch (error) { db.exec('ROLLBACK;'); throw error; }
      return mapEncounter(db.prepare('SELECT * FROM encounters WHERE id = ?').get(encounterId));
    },

    listOpenEncounters() {
      return db.prepare(`
        SELECT e.*, p.full_name AS patient_name
        FROM encounters e JOIN patients p ON p.id = e.patient_id
        WHERE e.status = 'open' AND p.active = 1
        ORDER BY e.started_at DESC
      `).all().map((row) => ({ ...mapEncounter(row), patientName: row.patient_name }));
    },

    getPatientWorkspace(patientId) {
      const patient = mapPatient(db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId));
      if (!patient) throw new Error('Patient not found');
      const assessments = db.prepare('SELECT * FROM assessments WHERE patient_id = ? ORDER BY recorded_at DESC, rowid DESC')
        .all(patientId).map(mapAssessment);
      const encounters = db.prepare('SELECT * FROM encounters WHERE patient_id = ? ORDER BY started_at DESC, rowid DESC')
        .all(patientId).map(mapEncounter);
      const sessions = db.prepare(`
        SELECT ts.*, p.title AS protocol_title, pv.version_number, e.patient_id, patient.full_name AS patient_name
        FROM treatment_sessions ts
        JOIN encounters e ON e.id = ts.encounter_id
        JOIN patients patient ON patient.id = e.patient_id
        LEFT JOIN protocols p ON p.id = ts.protocol_id
        LEFT JOIN protocol_versions pv ON pv.id = ts.protocol_version_id
        WHERE e.patient_id = ?
        ORDER BY ts.started_at DESC, ts.rowid DESC
      `).all(patientId).map(mapSession);
      const outcomes = db.prepare('SELECT * FROM outcomes WHERE patient_id = ? ORDER BY recorded_at DESC, rowid DESC')
        .all(patientId).map((row) => ({
          id: row.id, patientId: row.patient_id, encounterId: row.encounter_id, metricType: row.metric_type,
          value: row.value, unit: row.unit, notes: row.notes, recordedAt: row.recorded_at
        }));
      const timeline = [
        ...assessments.map((item) => ({ type: 'assessment', id: item.id, at: item.recordedAt, ...item })),
        ...encounters.map((item) => ({ type: 'encounter', id: item.id, at: item.startedAt, ...item })),
        ...sessions.map((item) => ({ type: 'treatment_session', id: item.id, at: item.startedAt, ...item })),
        ...outcomes.map((item) => ({ type: 'outcome', id: item.id, at: item.recordedAt, ...item }))
      ].sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
      return { patient, assessments, encounters, sessions, outcomes, timeline };
    },

    listEquipment() {
      const rows = db.prepare(`
        SELECT e.id, e.manufacturer, e.model, e.serial_number, e.specifications_json,
               a.id AS applicator_id, a.name AS applicator_name, a.wavelength_nm, a.max_power_mw, a.spot_area_cm2, a.modes_json
        FROM equipment e
        LEFT JOIN applicators a ON a.equipment_id = e.id AND a.active = 1
        WHERE e.active = 1
        ORDER BY e.manufacturer, e.model, a.name
      `).all();
      return rows.map((row) => ({
        id: row.id, manufacturer: row.manufacturer, model: row.model, serialNumber: row.serial_number,
        specifications: parseJson(row.specifications_json, {}),
        applicator: row.applicator_id ? {
          id: row.applicator_id, name: row.applicator_name, wavelengthNm: row.wavelength_nm,
          maxPowerMw: row.max_power_mw, spotAreaCm2: row.spot_area_cm2, modes: parseJson(row.modes_json, [])
        } : null
      }));
    },

    listProtocols() {
      const rows = db.prepare(`
        SELECT p.id, p.title, p.status, p.current_version_id, p.created_at,
               pv.version_number AS current_version_number
        FROM protocols p
        LEFT JOIN protocol_versions pv ON pv.id = p.current_version_id
        ORDER BY p.created_at DESC, p.title
      `).all();
      return rows.map((row) => ({
        id: row.id, title: row.title, status: row.status,
        currentVersionId: row.current_version_id, currentVersionNumber: row.current_version_number,
        createdAt: row.created_at
      }));
    },

    listProtocolVersions(protocolId) {
      return db.prepare('SELECT * FROM protocol_versions WHERE protocol_id = ? ORDER BY version_number')
        .all(protocolId).map(mapVersion);
    },

    createProtocol({ title, changeSummary, sourceType = 'professional', parameters = {} }, actorId = SEED_IDS.professional) {
      const cleanTitle = String(title ?? '').trim();
      const cleanSummary = String(changeSummary ?? '').trim();
      if (!cleanTitle) throw new Error('Protocol title is required');
      if (!cleanSummary) throw new Error('Change summary is required');
      const protocolId = randomUUID();
      const versionId = randomUUID();
      db.exec('BEGIN IMMEDIATE;');
      try {
        db.prepare("INSERT INTO protocols(id, title, status, created_by, current_version_id) VALUES (?, ?, 'draft', ?, NULL)")
          .run(protocolId, cleanTitle, actorId);
        db.prepare(`
          INSERT INTO protocol_versions(id, protocol_id, version_number, status, change_summary, source_type, parameters_json)
          VALUES (?, ?, 1, 'draft', ?, ?, ?)
        `).run(versionId, protocolId, cleanSummary, sourceType, JSON.stringify(parameters));
        db.prepare('UPDATE protocols SET current_version_id = ? WHERE id = ?').run(versionId, protocolId);
        appendAudit(db, { action: 'protocol.created', entityType: 'protocol', entityId: protocolId, actorId,
          payload: { title: cleanTitle, versionId } });
        db.exec('COMMIT;');
      } catch (error) { db.exec('ROLLBACK;'); throw error; }
      return this.listProtocols().find((item) => item.id === protocolId);
    },

    createProtocolVersion(protocolId, { changeSummary, sourceType = 'professional', parameters }, actorId = SEED_IDS.professional) {
      const protocol = db.prepare('SELECT * FROM protocols WHERE id = ?').get(protocolId);
      if (!protocol) throw new Error('Protocol not found');
      const cleanSummary = String(changeSummary ?? '').trim();
      if (!cleanSummary) throw new Error('Change summary is required');
      const previous = db.prepare('SELECT * FROM protocol_versions WHERE protocol_id = ? ORDER BY version_number DESC LIMIT 1')
        .get(protocolId);
      if (!previous) throw new Error('Previous protocol version is required');
      const versionId = randomUUID();
      const nextNumber = previous.version_number + 1;
      const nextParameters = parameters ?? parseJson(previous.parameters_json, {});
      db.exec('BEGIN IMMEDIATE;');
      try {
        db.prepare(`
          INSERT INTO protocol_versions(id, protocol_id, version_number, status, change_summary, source_type, parameters_json)
          VALUES (?, ?, ?, 'draft', ?, ?, ?)
        `).run(versionId, protocolId, nextNumber, cleanSummary, sourceType, JSON.stringify(nextParameters));
        db.prepare('UPDATE protocols SET current_version_id = ? WHERE id = ?').run(versionId, protocolId);
        appendAudit(db, { action: 'protocol.version_created', entityType: 'protocol_version', entityId: versionId, actorId,
          payload: { protocolId, versionNumber: nextNumber, changeSummary: cleanSummary } });
        db.exec('COMMIT;');
      } catch (error) { db.exec('ROLLBACK;'); throw error; }
      return this.listProtocolVersions(protocolId).at(-1);
    },

    listSessions() {
      return db.prepare(`
        SELECT ts.*, p.title AS protocol_title, pv.version_number, e.patient_id, patient.full_name AS patient_name
        FROM treatment_sessions ts
        LEFT JOIN protocols p ON p.id = ts.protocol_id
        LEFT JOIN protocol_versions pv ON pv.id = ts.protocol_version_id
        LEFT JOIN encounters e ON e.id = ts.encounter_id
        LEFT JOIN patients patient ON patient.id = e.patient_id
        ORDER BY ts.started_at DESC, ts.rowid DESC
      `).all().map(mapSession);
    },

    createTreatmentSession({ encounterId = SEED_IDS.encounter, protocolVersionId, plannedEnergyJ, appliedEnergyJ,
      professionalAdjustmentReason = '' }, actorId = SEED_IDS.professional) {
      const version = db.prepare('SELECT id, protocol_id FROM protocol_versions WHERE id = ?').get(protocolVersionId);
      if (!version) throw new Error('Protocol version not found');
      const encounter = db.prepare('SELECT * FROM encounters WHERE id = ?').get(encounterId);
      if (!encounter) throw new Error('Encounter not found');
      if (encounter.status !== 'open') throw new Error('Treatment sessions require an open encounter');
      const planned = Number(plannedEnergyJ);
      const applied = Number(appliedEnergyJ);
      if (!Number.isFinite(planned) || planned <= 0) throw new Error('Planned energy must be greater than zero');
      if (!Number.isFinite(applied) || applied <= 0) throw new Error('Applied energy must be greater than zero');
      const session = buildTreatmentSession({
        id: randomUUID(), encounterId, performedBy: actorId,
        protocolVersionId, equipmentId: SEED_IDS.equipment, applicatorId: SEED_IDS.applicator,
        plannedParameters: { energyJ: planned }, appliedParameters: { energyJ: applied },
        professionalAdjustmentReason, status: 'completed'
      });
      const now = new Date().toISOString();
      db.exec('BEGIN IMMEDIATE;');
      try {
        db.prepare(`
          INSERT INTO treatment_sessions(
            id, encounter_id, protocol_id, protocol_version_id, equipment_id, applicator_id, performed_by,
            planned_parameters_json, applied_parameters_json, professional_adjustment_reason,
            started_at, completed_at, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(session.id, session.encounterId, version.protocol_id, session.protocolVersionId,
          session.equipmentId, session.applicatorId, session.performedBy,
          JSON.stringify(session.plannedParameters), JSON.stringify(session.appliedParameters),
          session.professionalAdjustmentReason, now, now, session.status);
        appendAudit(db, { action: 'treatment_session.created', entityType: 'treatment_session', entityId: session.id, actorId,
          payload: { encounterId, protocolId: version.protocol_id, protocolVersionId,
            plannedParameters: session.plannedParameters, appliedParameters: session.appliedParameters,
            professionalAdjustmentReason: session.professionalAdjustmentReason } });
        db.exec('COMMIT;');
      } catch (error) { db.exec('ROLLBACK;'); throw error; }
      return this.listSessions().find((item) => item.id === session.id);
    },

    getAudit() {
      const events = db.prepare('SELECT * FROM audit_events ORDER BY rowid').all().map(mapAudit);
      return { valid: verifyAuditChain(events), events };
    }
  };
}
