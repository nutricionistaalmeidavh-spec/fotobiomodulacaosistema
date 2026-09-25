import { randomUUID } from 'node:crypto';
import { createF8Service } from './f8-service.js';
import { buildAuditEvent } from '../core/audit.js';
import { SEED_IDS } from './seed.js';

const APPOINTMENT_TYPES = new Set(['session', 'return', 'evaluation', 'other']);
const APPOINTMENT_STATUSES = new Set(['scheduled', 'confirmed', 'completed', 'missed', 'cancelled']);

function requiredText(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${label} is required`);
  return text;
}

function optionalText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function isoDate(value, label) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw new Error(`${label} must be a valid date`);
  return date.toISOString();
}

function integer(value, label, { min = 0 } = {}) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min) throw new Error(`${label} must be an integer${min ? ` >= ${min}` : ''}`);
  return number;
}

function mapAppointment(row) {
  return row ? {
    id: row.id,
    patientId: row.patient_id,
    professionalId: row.professional_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    appointmentType: row.appointment_type,
    status: row.status,
    recurrenceSeriesId: row.recurrence_series_id,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  } : null;
}

function mapPackage(row) {
  return row ? {
    id: row.id,
    patientId: row.patient_id,
    name: row.name,
    totalSessions: row.total_sessions,
    totalAmountCents: row.total_amount_cents,
    status: row.status,
    validUntil: row.valid_until,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    usedSessions: Number(row.used_sessions || 0),
    remainingSessions: Math.max(0, row.total_sessions - Number(row.used_sessions || 0))
  } : null;
}

function mapPayment(row) {
  return row ? {
    id: row.id,
    patientId: row.patient_id,
    packageId: row.package_id,
    amountCents: row.amount_cents,
    paymentMethod: row.payment_method,
    status: row.status,
    dueAt: row.due_at,
    paidAt: row.paid_at,
    reference: row.reference,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  } : null;
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
  db.prepare(`INSERT INTO audit_events(
    id, actor_type, actor_id, action, entity_type, entity_id, payload_json, prev_hash, event_hash, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(event.id, event.actorType, event.actorId, event.action, event.entityType, event.entityId,
      JSON.stringify(event.payload), event.prevHash, event.eventHash, event.createdAt);
  return event;
}

function packageRow(db, id) {
  return db.prepare(`
    SELECT p.*, COUNT(u.id) AS used_sessions
    FROM treatment_packages p
    LEFT JOIN package_usages u ON u.package_id = p.id
    WHERE p.id = ?
    GROUP BY p.id
  `).get(id);
}

export function createF9Service(db) {
  const base = createF8Service(db);

  const service = {
    ...base,

    getStatus() {
      return { ...base.getStatus(), phase: 'F9' };
    },

    createAppointments(input, actorId = SEED_IDS.professional) {
      const patientId = requiredText(input?.patientId, 'Patient');
      if (!db.prepare('SELECT id FROM patients WHERE id = ?').get(patientId)) throw new Error('Patient not found');
      const professionalId = optionalText(input?.professionalId);
      if (professionalId && !db.prepare('SELECT id FROM professionals WHERE id = ?').get(professionalId)) throw new Error('Professional not found');
      const startsAt = isoDate(input?.startsAt, 'Start');
      const endsAt = isoDate(input?.endsAt, 'End');
      if (new Date(endsAt) <= new Date(startsAt)) throw new Error('Appointment end must be after start');
      const appointmentType = String(input?.appointmentType || 'other').trim();
      if (!APPOINTMENT_TYPES.has(appointmentType)) throw new Error('Unsupported appointment type');
      const recurrence = input?.recurrence || null;
      const count = recurrence ? integer(recurrence.count, 'Recurrence count', { min: 1 }) : 1;
      const intervalDays = recurrence && count > 1 ? integer(recurrence.intervalDays, 'Recurrence interval days', { min: 1 }) : 0;
      if (count > 104) throw new Error('Recurrence count is too large');
      const recurrenceSeriesId = count > 1 ? randomUUID() : null;
      const durationMs = new Date(endsAt).getTime() - new Date(startsAt).getTime();
      const created = [];

      db.exec('BEGIN IMMEDIATE;');
      try {
        for (let index = 0; index < count; index += 1) {
          const start = new Date(new Date(startsAt).getTime() + index * intervalDays * 86400000);
          const end = new Date(start.getTime() + durationMs);
          const id = randomUUID();
          db.prepare(`INSERT INTO appointments(
            id, patient_id, professional_id, starts_at, ends_at, appointment_type, status,
            recurrence_series_id, notes, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, 'scheduled', ?, ?, ?)`)
            .run(id, patientId, professionalId, start.toISOString(), end.toISOString(), appointmentType,
              recurrenceSeriesId, optionalText(input?.notes), actorId);
          const row = mapAppointment(db.prepare('SELECT * FROM appointments WHERE id = ?').get(id));
          created.push(row);
          appendAudit(db, base, {
            action: 'appointment.created', entityType: 'appointment', entityId: id, actorId,
            payload: { after: row }
          });
        }
        db.exec('COMMIT;');
      } catch (error) {
        db.exec('ROLLBACK;');
        throw error;
      }
      return created;
    },

    listAppointments(filters = {}) {
      const clauses = [];
      const params = [];
      if (filters.patientId) { clauses.push('patient_id = ?'); params.push(filters.patientId); }
      if (filters.professionalId) { clauses.push('professional_id = ?'); params.push(filters.professionalId); }
      if (filters.status) { clauses.push('status = ?'); params.push(filters.status); }
      if (filters.from) { clauses.push('starts_at >= ?'); params.push(isoDate(filters.from, 'From')); }
      if (filters.to) { clauses.push('starts_at <= ?'); params.push(isoDate(filters.to, 'To')); }
      return db.prepare(`SELECT * FROM appointments ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''} ORDER BY starts_at, id`)
        .all(...params).map(mapAppointment);
    },

    updateAppointment(id, patch, actorId = SEED_IDS.professional) {
      const before = mapAppointment(db.prepare('SELECT * FROM appointments WHERE id = ?').get(id));
      if (!before) throw new Error('Appointment not found');
      const next = {
        startsAt: patch?.startsAt === undefined ? before.startsAt : isoDate(patch.startsAt, 'Start'),
        endsAt: patch?.endsAt === undefined ? before.endsAt : isoDate(patch.endsAt, 'End'),
        appointmentType: patch?.appointmentType === undefined ? before.appointmentType : String(patch.appointmentType).trim(),
        status: patch?.status === undefined ? before.status : String(patch.status).trim(),
        professionalId: patch?.professionalId === undefined ? before.professionalId : optionalText(patch.professionalId),
        notes: patch?.notes === undefined ? before.notes : optionalText(patch.notes)
      };
      if (new Date(next.endsAt) <= new Date(next.startsAt)) throw new Error('Appointment end must be after start');
      if (!APPOINTMENT_TYPES.has(next.appointmentType)) throw new Error('Unsupported appointment type');
      if (!APPOINTMENT_STATUSES.has(next.status)) throw new Error('Unsupported appointment status');
      if (next.professionalId && !db.prepare('SELECT id FROM professionals WHERE id = ?').get(next.professionalId)) throw new Error('Professional not found');
      db.prepare(`UPDATE appointments SET professional_id = ?, starts_at = ?, ends_at = ?, appointment_type = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .run(next.professionalId, next.startsAt, next.endsAt, next.appointmentType, next.status, next.notes, id);
      const after = mapAppointment(db.prepare('SELECT * FROM appointments WHERE id = ?').get(id));
      appendAudit(db, base, { action: 'appointment.updated', entityType: 'appointment', entityId: id, actorId, payload: { before, after } });
      return after;
    },

    createTreatmentPackage(input, actorId = SEED_IDS.professional) {
      const patientId = requiredText(input?.patientId, 'Patient');
      if (!db.prepare('SELECT id FROM patients WHERE id = ?').get(patientId)) throw new Error('Patient not found');
      const totalSessions = integer(input?.totalSessions, 'Total sessions', { min: 1 });
      const totalAmountCents = integer(input?.totalAmountCents ?? 0, 'Total amount cents', { min: 0 });
      const id = randomUUID();
      db.prepare(`INSERT INTO treatment_packages(id, patient_id, name, total_sessions, total_amount_cents, valid_until, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(id, patientId, requiredText(input?.name, 'Package name'), totalSessions, totalAmountCents,
          input?.validUntil ? isoDate(input.validUntil, 'Valid until') : null, actorId);
      const pack = mapPackage(packageRow(db, id));
      appendAudit(db, base, { action: 'package.created', entityType: 'treatment_package', entityId: id, actorId, payload: { after: pack } });
      return pack;
    },

    listTreatmentPackages(filters = {}) {
      const clauses = [];
      const params = [];
      if (filters.patientId) { clauses.push('p.patient_id = ?'); params.push(filters.patientId); }
      if (filters.status) { clauses.push('p.status = ?'); params.push(filters.status); }
      return db.prepare(`
        SELECT p.*, COUNT(u.id) AS used_sessions
        FROM treatment_packages p
        LEFT JOIN package_usages u ON u.package_id = p.id
        ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
        GROUP BY p.id ORDER BY p.created_at DESC, p.id
      `).all(...params).map(mapPackage);
    },

    consumeTreatmentPackage(packageId, treatmentSessionId, actorId = SEED_IDS.professional) {
      const before = mapPackage(packageRow(db, packageId));
      if (!before) throw new Error('Treatment package not found');
      if (before.status !== 'active') throw new Error('Treatment package is not active');
      if (before.remainingSessions <= 0) throw new Error('Treatment package has no remaining sessions');
      const session = db.prepare(`
        SELECT s.id, e.patient_id
        FROM treatment_sessions s
        JOIN encounters e ON e.id = s.encounter_id
        WHERE s.id = ?
      `).get(treatmentSessionId);
      if (!session) throw new Error('Treatment session not found');
      if (session.patient_id !== before.patientId) throw new Error('Treatment session belongs to a different patient');
      if (db.prepare('SELECT id FROM package_usages WHERE package_id = ? AND treatment_session_id = ?').get(packageId, treatmentSessionId)) {
        throw new Error('Sessão já consumida neste pacote');
      }
      const id = randomUUID();
      db.prepare('INSERT INTO package_usages(id, package_id, treatment_session_id, used_by) VALUES (?, ?, ?, ?)')
        .run(id, packageId, treatmentSessionId, actorId);
      const afterUsage = mapPackage(packageRow(db, packageId));
      if (afterUsage.usedSessions >= afterUsage.totalSessions) {
        db.prepare("UPDATE treatment_packages SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(packageId);
      }
      const after = mapPackage(packageRow(db, packageId));
      const usage = { id, packageId, treatmentSessionId, usedBy: actorId };
      appendAudit(db, base, { action: 'package.session_consumed', entityType: 'package_usage', entityId: id, actorId, payload: { before, after, usage } });
      return usage;
    },

    createPayment(input, actorId = SEED_IDS.professional) {
      const patientId = requiredText(input?.patientId, 'Patient');
      if (!db.prepare('SELECT id FROM patients WHERE id = ?').get(patientId)) throw new Error('Patient not found');
      const amountCents = integer(input?.amountCents, 'Amount in centavos', { min: 1 });
      const packageId = optionalText(input?.packageId);
      if (packageId) {
        const pack = mapPackage(packageRow(db, packageId));
        if (!pack) throw new Error('Treatment package not found');
        if (pack.patientId !== patientId) throw new Error('Payment package belongs to a different patient');
      }
      const id = randomUUID();
      db.prepare(`INSERT INTO payments(
        id, patient_id, package_id, amount_cents, payment_method, status, due_at, reference, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`)
        .run(id, patientId, packageId, amountCents, requiredText(input?.paymentMethod, 'Payment method'),
          input?.dueAt ? isoDate(input.dueAt, 'Due date') : null, optionalText(input?.reference), optionalText(input?.notes), actorId);
      const payment = mapPayment(db.prepare('SELECT * FROM payments WHERE id = ?').get(id));
      appendAudit(db, base, { action: 'payment.created', entityType: 'payment', entityId: id, actorId, payload: { after: payment } });
      return payment;
    },

    listPayments(filters = {}) {
      const clauses = [];
      const params = [];
      if (filters.patientId) { clauses.push('patient_id = ?'); params.push(filters.patientId); }
      if (filters.status) { clauses.push('status = ?'); params.push(filters.status); }
      return db.prepare(`SELECT * FROM payments ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''} ORDER BY created_at DESC, id`)
        .all(...params).map(mapPayment);
    },

    markPaymentPaid(id, paidAt = new Date().toISOString(), actorId = SEED_IDS.professional) {
      const before = mapPayment(db.prepare('SELECT * FROM payments WHERE id = ?').get(id));
      if (!before) throw new Error('Payment not found');
      if (before.status === 'cancelled') throw new Error('Cancelled payment cannot be paid');
      if (before.status === 'paid') throw new Error('Payment is already paid');
      const normalizedPaidAt = isoDate(paidAt || new Date().toISOString(), 'Paid at');
      db.prepare("UPDATE payments SET status = 'paid', paid_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(normalizedPaidAt, id);
      const after = mapPayment(db.prepare('SELECT * FROM payments WHERE id = ?').get(id));
      appendAudit(db, base, { action: 'payment.paid', entityType: 'payment', entityId: id, actorId, payload: { before, after } });
      return after;
    },

    getOperationsReport(filters = {}) {
      const from = filters.from ? isoDate(filters.from, 'From') : '0001-01-01T00:00:00.000Z';
      const to = filters.to ? isoDate(filters.to, 'To') : '9999-12-31T23:59:59.999Z';
      if (new Date(to) < new Date(from)) throw new Error('Report end must be on or after start');

      const appointmentRows = db.prepare(`SELECT status, COUNT(*) AS total FROM appointments WHERE starts_at BETWEEN ? AND ? GROUP BY status`).all(from, to);
      const appointmentByStatus = Object.fromEntries(appointmentRows.map((row) => [row.status, Number(row.total)]));
      const patientCount = Number(db.prepare(`SELECT COUNT(DISTINCT patient_id) AS total FROM appointments WHERE starts_at BETWEEN ? AND ? AND status != 'cancelled'`).get(from, to).total);
      const sessionCount = Number(db.prepare(`SELECT COUNT(*) AS total FROM treatment_sessions WHERE started_at BETWEEN ? AND ? AND status != 'cancelled'`).get(from, to).total);
      const protocolCount = Number(db.prepare(`SELECT COUNT(DISTINCT protocol_version_id) AS total FROM treatment_sessions WHERE started_at BETWEEN ? AND ? AND protocol_version_id IS NOT NULL AND status != 'cancelled'`).get(from, to).total);
      const outcomeCount = Number(db.prepare(`SELECT COUNT(*) AS total FROM outcomes WHERE measured_at BETWEEN ? AND ?`).get(from, to).total);
      const finance = db.prepare(`
        SELECT
          COALESCE(SUM(CASE WHEN status = 'paid' AND paid_at BETWEEN ? AND ? THEN amount_cents ELSE 0 END), 0) AS received_cents,
          COALESCE(SUM(CASE WHEN status = 'pending' AND COALESCE(due_at, created_at) BETWEEN ? AND ? THEN amount_cents ELSE 0 END), 0) AS pending_cents
        FROM payments
      `).get(from, to, from, to);
      const byProfessional = db.prepare(`
        SELECT performed_by AS professional_id, COUNT(*) AS sessions
        FROM treatment_sessions WHERE started_at BETWEEN ? AND ? AND status != 'cancelled'
        GROUP BY performed_by ORDER BY sessions DESC, performed_by
      `).all(from, to).map((row) => ({ professionalId: row.professional_id, sessions: Number(row.sessions) }));
      const byEquipment = db.prepare(`
        SELECT equipment_id, COUNT(*) AS sessions
        FROM treatment_sessions WHERE started_at BETWEEN ? AND ? AND status != 'cancelled' AND equipment_id IS NOT NULL
        GROUP BY equipment_id ORDER BY sessions DESC, equipment_id
      `).all(from, to).map((row) => ({ equipmentId: row.equipment_id, sessions: Number(row.sessions) }));

      return {
        period: { from, to },
        patientsAttended: patientCount,
        appointments: { total: Object.values(appointmentByStatus).reduce((sum, value) => sum + value, 0), byStatus: appointmentByStatus },
        pbmSessions: sessionCount,
        protocolsUsed: protocolCount,
        outcomesRecorded: outcomeCount,
        finance: { receivedCents: Number(finance.received_cents), pendingCents: Number(finance.pending_cents) },
        sessionsByProfessional: byProfessional,
        sessionsByEquipment: byEquipment
      };
    }
  };

  return service;
}
