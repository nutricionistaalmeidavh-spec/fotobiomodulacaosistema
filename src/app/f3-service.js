import { randomUUID } from 'node:crypto';
import { createF2Service } from './f2-service.js';
import { adaptProtocolToApplicator } from '../domain/equipment-adaptation.js';
import { buildAuditEvent } from '../core/audit.js';
import { SEED_IDS } from './seed.js';

function parseJson(value, fallback = []) {
  try { return JSON.parse(value ?? ''); } catch { return fallback; }
}

function text(value, label, { required = false } = {}) {
  const normalized = String(value ?? '').trim();
  if (required && !normalized) throw new Error(`${label} is required`);
  return normalized || null;
}

function positive(value, label, { nullable = true } = {}) {
  if (value == null || value === '') {
    if (nullable) return null;
    throw new Error(`${label} is required`);
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${label} must be greater than zero`);
  return number;
}

function stringArray(value, label) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function numberArray(value, label) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value.map((item) => {
    const number = Number(item);
    if (!Number.isFinite(number) || number <= 0) throw new Error(`${label} must contain positive numbers`);
    return number;
  });
}

function mapApplicator(row) {
  return {
    id: row.id,
    equipmentId: row.equipment_id,
    name: row.name,
    wavelengthNm: row.wavelength_nm,
    minPowerMw: row.min_power_mw,
    maxPowerMw: row.max_power_mw,
    fixedPowerMw: row.fixed_power_mw,
    spotAreaCm2: row.spot_area_cm2,
    modes: parseJson(row.modes_json, []),
    frequenciesHz: parseJson(row.frequencies_json, []),
    limitations: row.limitations,
    active: Boolean(row.active)
  };
}

function mapEquipment(row) {
  return {
    id: row.id,
    ownerProfessionalId: row.owner_professional_id,
    manufacturer: row.manufacturer,
    model: row.model,
    serialNumber: row.serial_number,
    notes: row.notes,
    specifications: parseJson(row.specifications_json, {}),
    active: Boolean(row.active),
    createdAt: row.created_at
  };
}

function appendAudit(db, base, { action, entityType, entityId, payload = {}, actorId }) {
  const previousEvent = base.getAudit().events.at(-1) ?? null;
  const event = buildAuditEvent({
    id: randomUUID(), actorType: 'professional', actorId: actorId || SEED_IDS.professional,
    action, entityType, entityId, payload, previousEvent, createdAt: new Date().toISOString()
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

export function createF3Service(db) {
  const base = createF2Service(db);

  const service = {
    ...base,

    getStatus() {
      return { ...base.getStatus(), phase: 'F3' };
    },

    createEquipment(input = {}, actorId = SEED_IDS.professional) {
      const id = randomUUID();
      const manufacturer = text(input.manufacturer, 'Manufacturer', { required: true });
      const model = text(input.model, 'Model', { required: true });
      db.prepare(`
        INSERT INTO equipment(
          id, owner_professional_id, manufacturer, model, serial_number, active, specifications_json, notes
        ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)
      `).run(
        id, actorId, manufacturer, model, text(input.serialNumber, 'Serial number'),
        JSON.stringify(input.specifications && typeof input.specifications === 'object' ? input.specifications : {}),
        text(input.notes, 'Notes')
      );
      appendAudit(db, base, {
        action: 'equipment.created', entityType: 'equipment', entityId: id, actorId,
        payload: { manufacturer, model }
      });
      return service.listEquipmentDetailed().find((item) => item.id === id);
    },

    updateEquipment(id, input = {}, actorId = SEED_IDS.professional) {
      const current = db.prepare('SELECT * FROM equipment WHERE id = ?').get(id);
      if (!current) throw new Error('Equipment not found');
      const manufacturer = input.manufacturer === undefined ? current.manufacturer : text(input.manufacturer, 'Manufacturer', { required: true });
      const model = input.model === undefined ? current.model : text(input.model, 'Model', { required: true });
      const serialNumber = input.serialNumber === undefined ? current.serial_number : text(input.serialNumber, 'Serial number');
      const notes = input.notes === undefined ? current.notes : text(input.notes, 'Notes');
      const active = input.active === undefined ? current.active : (input.active ? 1 : 0);
      const specifications = input.specifications === undefined
        ? current.specifications_json
        : JSON.stringify(input.specifications && typeof input.specifications === 'object' ? input.specifications : {});
      db.prepare(`
        UPDATE equipment SET manufacturer = ?, model = ?, serial_number = ?, notes = ?, active = ?, specifications_json = ?
        WHERE id = ?
      `).run(manufacturer, model, serialNumber, notes, active, specifications, id);
      appendAudit(db, base, {
        action: 'equipment.updated', entityType: 'equipment', entityId: id, actorId,
        payload: { manufacturer, model, active: Boolean(active) }
      });
      return service.listEquipmentDetailed().find((item) => item.id === id);
    },

    createApplicator(equipmentId, input = {}, actorId = SEED_IDS.professional) {
      const equipment = db.prepare('SELECT id FROM equipment WHERE id = ?').get(equipmentId);
      if (!equipment) throw new Error('Equipment not found');
      const id = randomUUID();
      const name = text(input.name, 'Applicator name', { required: true });
      const wavelengthNm = positive(input.wavelengthNm, 'Wavelength', { nullable: false });
      const minPowerMw = positive(input.minPowerMw, 'Minimum power');
      const maxPowerMw = positive(input.maxPowerMw, 'Maximum power');
      const fixedPowerMw = positive(input.fixedPowerMw, 'Fixed power');
      const spotAreaCm2 = positive(input.spotAreaCm2, 'Spot area');
      const modes = stringArray(input.modes, 'Modes');
      const frequenciesHz = numberArray(input.frequenciesHz, 'Frequencies');
      if (fixedPowerMw && (minPowerMw || maxPowerMw)) throw new Error('Fixed power cannot be combined with a power range');
      if (!fixedPowerMw && minPowerMw && maxPowerMw && minPowerMw > maxPowerMw) throw new Error('Minimum power cannot exceed maximum power');
      db.prepare(`
        INSERT INTO applicators(
          id, equipment_id, name, wavelength_nm, max_power_mw, spot_area_cm2, modes_json, active,
          min_power_mw, fixed_power_mw, frequencies_json, limitations
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
      `).run(
        id, equipmentId, name, wavelengthNm, maxPowerMw, spotAreaCm2, JSON.stringify(modes),
        minPowerMw, fixedPowerMw, JSON.stringify(frequenciesHz), text(input.limitations, 'Limitations')
      );
      appendAudit(db, base, {
        action: 'applicator.created', entityType: 'applicator', entityId: id, actorId,
        payload: { equipmentId, name, wavelengthNm, fixedPowerMw, minPowerMw, maxPowerMw }
      });
      return mapApplicator(db.prepare('SELECT * FROM applicators WHERE id = ?').get(id));
    },

    listEquipmentDetailed() {
      return db.prepare('SELECT * FROM equipment ORDER BY active DESC, manufacturer, model').all().map((row) => ({
        ...mapEquipment(row),
        applicators: db.prepare('SELECT * FROM applicators WHERE equipment_id = ? ORDER BY active DESC, name')
          .all(row.id).map(mapApplicator)
      }));
    },

    adaptProtocolVersion(protocolVersionId, applicatorId, selectedPowerMw = null, actorId = SEED_IDS.professional) {
      const versionRow = db.prepare('SELECT * FROM protocol_versions WHERE id = ?').get(protocolVersionId);
      if (!versionRow) throw new Error('Protocol version not found');
      const applicatorRow = db.prepare('SELECT * FROM applicators WHERE id = ?').get(applicatorId);
      if (!applicatorRow) throw new Error('Applicator not found');
      const referenceParameters = parseJson(versionRow.parameters_json, {});
      const applicator = mapApplicator(applicatorRow);
      const result = adaptProtocolToApplicator({ referenceParameters, applicator, selectedPowerMw });
      appendAudit(db, base, {
        action: 'protocol.adapted_previewed', entityType: 'protocol_version', entityId: protocolVersionId, actorId,
        payload: { applicatorId, selectedPowerMw: selectedPowerMw ?? null, compatible: result.compatible, warnings: result.warnings }
      });
      return result;
    }
  };

  return service;
}
