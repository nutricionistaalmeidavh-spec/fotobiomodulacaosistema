import { randomUUID } from 'node:crypto';
import { listTables } from '../db/database.js';
import { buildTreatmentSession } from '../domain/treatment-sessions.js';
import { buildAuditEvent, verifyAuditChain } from '../core/audit.js';
import { ensureSeedData, SEED_IDS } from './seed.js';

function parseJson(value, fallback) {
  try { return JSON.parse(value ?? ''); } catch { return fallback; }
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

export function createF0Service(db) {
  return {
    ensureSeedData() { return ensureSeedData(db); },

    getStatus() {
      const tables = listTables(db);
      const migrations = db.prepare('SELECT version, applied_at FROM schema_migrations ORDER BY version').all();
      const audit = this.getAudit();
      return { phase: 'F0', tableCount: tables.length, tables, migrations, auditValid: audit.valid };
    },

    listPatients() {
      return db.prepare(`
        SELECT id, full_name AS fullName, birth_date AS birthDate, email, phone, notes, created_at AS createdAt
        FROM patients ORDER BY full_name
      `).all();
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
        id: row.id,
        manufacturer: row.manufacturer,
        model: row.model,
        serialNumber: row.serial_number,
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
      return db.prepare(`SELECT * FROM protocol_versions WHERE protocol_id = ? ORDER BY version_number`)
        .all(protocolId).map(mapVersion);
    },

    createProtocol({ title, changeSummary, sourceType = 'professional', parameters = {} }) {
      const cleanTitle = String(title ?? '').trim();
      const cleanSummary = String(changeSummary ?? '').trim();
      if (!cleanTitle) throw new Error('Protocol title is required');
      if (!cleanSummary) throw new Error('Change summary is required');
      const protocolId = randomUUID();
      const versionId = randomUUID();
      db.exec('BEGIN IMMEDIATE;');
      try {
        db.prepare(`INSERT INTO protocols(id, title, status, created_by, current_version_id) VALUES (?, ?, 'draft', ?, NULL)`)
          .run(protocolId, cleanTitle, SEED_IDS.professional);
        db.prepare(`
          INSERT INTO protocol_versions(id, protocol_id, version_number, status, change_summary, source_type, parameters_json)
          VALUES (?, ?, 1, 'draft', ?, ?, ?)
        `).run(versionId, protocolId, cleanSummary, sourceType, JSON.stringify(parameters));
        db.prepare('UPDATE protocols SET current_version_id = ? WHERE id = ?').run(versionId, protocolId);
        appendAudit(db, { action: 'protocol.created', entityType: 'protocol', entityId: protocolId,
          payload: { title: cleanTitle, versionId } });
        db.exec('COMMIT;');
      } catch (error) { db.exec('ROLLBACK;'); throw error; }
      return this.listProtocols().find((item) => item.id === protocolId);
    },

    createProtocolVersion(protocolId, { changeSummary, sourceType = 'professional', parameters }) {
      const protocol = db.prepare('SELECT * FROM protocols WHERE id = ?').get(protocolId);
      if (!protocol) throw new Error('Protocol not found');
      const cleanSummary = String(changeSummary ?? '').trim();
      if (!cleanSummary) throw new Error('Change summary is required');
      const previous = db.prepare(`SELECT * FROM protocol_versions WHERE protocol_id = ? ORDER BY version_number DESC LIMIT 1`)
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
        appendAudit(db, { action: 'protocol.version_created', entityType: 'protocol_version', entityId: versionId,
          payload: { protocolId, versionNumber: nextNumber, changeSummary: cleanSummary } });
        db.exec('COMMIT;');
      } catch (error) { db.exec('ROLLBACK;'); throw error; }
      return this.listProtocolVersions(protocolId).at(-1);
    },

    listSessions() {
      const rows = db.prepare(`
        SELECT ts.*, p.title AS protocol_title, pv.version_number
        FROM treatment_sessions ts
        LEFT JOIN protocols p ON p.id = ts.protocol_id
        LEFT JOIN protocol_versions pv ON pv.id = ts.protocol_version_id
        ORDER BY ts.started_at DESC, ts.rowid DESC
      `).all();
      return rows.map((row) => ({
        id: row.id, encounterId: row.encounter_id, protocolId: row.protocol_id,
        protocolTitle: row.protocol_title, protocolVersionId: row.protocol_version_id,
        protocolVersionNumber: row.version_number, equipmentId: row.equipment_id, applicatorId: row.applicator_id,
        performedBy: row.performed_by, plannedParameters: parseJson(row.planned_parameters_json, {}),
        appliedParameters: parseJson(row.applied_parameters_json, {}),
        professionalAdjustmentReason: row.professional_adjustment_reason, status: row.status,
        startedAt: row.started_at, completedAt: row.completed_at
      }));
    },

    createTreatmentSession({ protocolVersionId, plannedEnergyJ, appliedEnergyJ, professionalAdjustmentReason = '' }) {
      const version = db.prepare('SELECT id, protocol_id FROM protocol_versions WHERE id = ?').get(protocolVersionId);
      if (!version) throw new Error('Protocol version not found');
      const planned = Number(plannedEnergyJ);
      const applied = Number(appliedEnergyJ);
      if (!Number.isFinite(planned) || planned <= 0) throw new Error('Planned energy must be greater than zero');
      if (!Number.isFinite(applied) || applied <= 0) throw new Error('Applied energy must be greater than zero');
      const session = buildTreatmentSession({
        id: randomUUID(), encounterId: SEED_IDS.encounter, performedBy: SEED_IDS.professional,
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
        appendAudit(db, { action: 'treatment_session.created', entityType: 'treatment_session', entityId: session.id,
          payload: { protocolId: version.protocol_id, protocolVersionId,
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
