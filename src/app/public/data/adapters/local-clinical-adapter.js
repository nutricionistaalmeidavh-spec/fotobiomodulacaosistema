import { cloneUiData, DATA_SOURCE } from '../contracts.js';

const AGENDA_STATUSES = new Set(['scheduled', 'completed', 'cancelled']);
const EVOLUTION_CATEGORIES = new Set(['assessment', 'session', 'follow-up', 'note']);

function required(value, message) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(message);
  return result;
}

function parseAgendaDate(value) {
  const raw = required(value, 'Informe data e hora da agenda.');
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw new TypeError('Data/hora da agenda é inválida.');
  return raw;
}

function normalizeDate(value, message = 'Data inválida.') {
  const raw = required(value, message);
  const parsed = new Date(`${raw.length === 10 ? `${raw}T00:00:00` : raw}`);
  if (Number.isNaN(parsed.getTime())) throw new TypeError(message);
  return raw.slice(0, 10);
}

function emptyClinicalIntake() {
  return {
    anamnesis: { complaint: '', goal: '', medications: '', precautions: '' },
    consent: { status: 'pending', updatedAt: null },
    safetyChecklist: {
      identityConfirmed: false,
      objectiveReviewed: false,
      precautionsReviewed: false,
      siteReviewed: false,
      equipmentReviewed: false,
      professionalConfirmed: false
    }
  };
}

function sourceCopy(value) {
  if (Array.isArray(value)) return value.map((item) => ({ ...cloneUiData(item), source: DATA_SOURCE.LOCAL }));
  return value == null ? value : { ...cloneUiData(value), source: DATA_SOURCE.LOCAL };
}

export function createLocalClinicalAdapter(seed = { dashboard: {}, patients: [], agenda: [] }) {
  const state = cloneUiData(seed);
  state.dashboard ||= {};
  state.agenda ||= [];
  state.patients ||= [];
  state.patients.forEach((patient) => {
    patient.clinicalIntake ||= emptyClinicalIntake();
    patient.evolution ||= [];
    patient.photos ||= [];
  });

  let patientSequence = state.patients.length + 1;
  let evolutionSequence = state.patients.reduce((sum, patient) => sum + patient.evolution.length, 0) + 1;
  let photoSequence = state.patients.reduce((sum, patient) => sum + patient.photos.length, 0) + 1;
  let agendaSequence = state.agenda.length + 1;

  function patientOrThrow(id) {
    const patient = state.patients.find((item) => item.id === id);
    if (!patient) throw new TypeError('Paciente local não encontrado.');
    patient.clinicalIntake ||= emptyClinicalIntake();
    patient.evolution ||= [];
    patient.photos ||= [];
    return patient;
  }

  function patientSnapshot(patient) {
    return {
      ...cloneUiData(patient),
      source: DATA_SOURCE.LOCAL,
      clinicalIntake: { ...cloneUiData(patient.clinicalIntake), source: DATA_SOURCE.LOCAL }
    };
  }

  return {
    async getDashboard() {
      const dashboard = cloneUiData(state.dashboard);
      dashboard.activePatients = state.patients.filter((patient) => patient.status === 'active').length;
      return { ...dashboard, source: DATA_SOURCE.LOCAL };
    },

    async listPatients() {
      return state.patients.map(patientSnapshot);
    },

    async getPatient(id) {
      const patient = state.patients.find((item) => item.id === id);
      return patient ? patientSnapshot(patient) : null;
    },

    async createPatient(input = {}) {
      const fullName = required(input.fullName, 'Nome do paciente é obrigatório.');
      const patient = {
        id: `local-patient-${String(patientSequence++).padStart(3, '0')}`,
        fullName,
        status: input.status === 'inactive' ? 'inactive' : 'active',
        phone: String(input.phone ?? '').trim(),
        email: String(input.email ?? '').trim(),
        notes: String(input.notes ?? '').trim(),
        birthDate: String(input.birthDate ?? '').trim(),
        lastSession: null,
        nextSession: null,
        currentProtocol: null,
        alerts: [],
        pendingItems: [],
        clinicalIntake: emptyClinicalIntake(),
        timeline: [],
        evolution: [],
        photos: []
      };
      state.patients.push(patient);
      return patientSnapshot(patient);
    },

    async getClinicalIntake(id) {
      const intake = patientOrThrow(id).clinicalIntake;
      return { ...cloneUiData(intake), source: DATA_SOURCE.LOCAL };
    },

    async updateAnamnesis(id, patch = {}) {
      const patient = patientOrThrow(id);
      const current = patient.clinicalIntake.anamnesis;
      patient.clinicalIntake.anamnesis = {
        complaint: String(patch.complaint ?? current.complaint ?? ''),
        goal: String(patch.goal ?? current.goal ?? ''),
        medications: String(patch.medications ?? current.medications ?? ''),
        precautions: String(patch.precautions ?? current.precautions ?? '')
      };
      return { ...cloneUiData(patient.clinicalIntake), source: DATA_SOURCE.LOCAL };
    },

    async updateConsent(id, patch = {}) {
      const patient = patientOrThrow(id);
      patient.clinicalIntake.consent = { ...patient.clinicalIntake.consent, ...cloneUiData(patch) };
      return { ...cloneUiData(patient.clinicalIntake), source: DATA_SOURCE.LOCAL };
    },

    async updateSafetyChecklist(id, patch = {}) {
      const patient = patientOrThrow(id);
      const current = patient.clinicalIntake.safetyChecklist;
      const next = { ...current };
      for (const key of Object.keys(current)) {
        if (Object.hasOwn(patch, key)) next[key] = Boolean(patch[key]);
      }
      patient.clinicalIntake.safetyChecklist = next;
      return { ...cloneUiData(patient.clinicalIntake), source: DATA_SOURCE.LOCAL };
    },

    async listEvolution(id, filters = {}) {
      const patient = patientOrThrow(id);
      let records = patient.evolution.slice();
      if (filters.category && filters.category !== 'all') records = records.filter((item) => item.category === filters.category);
      if (filters.from) records = records.filter((item) => String(item.date) >= String(filters.from));
      if (filters.to) records = records.filter((item) => String(item.date) <= String(filters.to));
      records.sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)));
      return sourceCopy(records);
    },

    async addEvolution(id, input = {}) {
      const patient = patientOrThrow(id);
      const title = required(input.title, 'Informe o título da evolução.');
      const date = normalizeDate(input.date, 'Data da evolução é inválida.');
      const category = input.category || 'note';
      if (!EVOLUTION_CATEGORIES.has(category)) throw new TypeError('Categoria da evolução é inválida.');
      const record = {
        id: `local-evolution-${String(evolutionSequence++).padStart(3, '0')}`,
        patientId: id,
        date,
        category,
        title,
        notes: String(input.notes ?? '').trim(),
        sessionId: input.sessionId || null,
        protocolVersionId: input.protocolVersionId || null
      };
      patient.evolution.push(record);
      return sourceCopy(record);
    },

    async listPhotos(id) {
      return sourceCopy(patientOrThrow(id).photos);
    },

    async addPhotoMetadata(id, input = {}) {
      const patient = patientOrThrow(id);
      const capturedDate = normalizeDate(input.capturedDate, 'Data da foto é inválida.');
      const region = required(input.region, 'Informe a região fotografada.');
      const record = {
        id: `local-photo-${String(photoSequence++).padStart(3, '0')}`,
        patientId: id,
        capturedDate,
        region,
        observation: String(input.observation ?? '').trim(),
        sessionId: input.sessionId || null,
        fileId: input.fileId || null,
        storageUrl: input.storageUrl || null,
        previewDataUrl: String(input.previewDataUrl ?? '')
      };
      patient.photos.push(record);
      return sourceCopy(record);
    },

    async removePhotoMetadata(id, photoId) {
      const patient = patientOrThrow(id);
      const index = patient.photos.findIndex((item) => item.id === photoId);
      if (index < 0) return false;
      patient.photos.splice(index, 1);
      return true;
    },

    async listAgenda(filters = {}) {
      let items = state.agenda.slice();
      if (filters.status && filters.status !== 'all') items = items.filter((item) => item.status === filters.status);
      if (filters.from) items = items.filter((item) => String(item.startsAt).slice(0, 10) >= String(filters.from));
      if (filters.to) items = items.filter((item) => String(item.startsAt).slice(0, 10) <= String(filters.to));
      items.sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
      return sourceCopy(items);
    },

    async createAgendaItem(input = {}) {
      const patientId = required(input.patientId, 'Selecione o paciente da agenda.');
      patientOrThrow(patientId);
      const startsAt = parseAgendaDate(input.startsAt);
      const status = input.status || 'scheduled';
      if (!AGENDA_STATUSES.has(status)) throw new TypeError('Status da agenda é inválido.');
      const record = {
        id: `local-agenda-${String(agendaSequence++).padStart(3, '0')}`,
        patientId,
        startsAt,
        status,
        note: String(input.note ?? '').trim()
      };
      state.agenda.push(record);
      return sourceCopy(record);
    },

    async updateAgendaItem(itemId, patch = {}) {
      const item = state.agenda.find((entry) => entry.id === itemId);
      if (!item) throw new TypeError('Item da agenda não encontrado.');
      const next = { ...item };
      if (Object.hasOwn(patch, 'status')) {
        if (!AGENDA_STATUSES.has(patch.status)) throw new TypeError('Status da agenda é inválido.');
        next.status = patch.status;
      }
      if (Object.hasOwn(patch, 'startsAt')) next.startsAt = parseAgendaDate(patch.startsAt);
      if (Object.hasOwn(patch, 'patientId')) {
        const patientId = required(patch.patientId, 'Selecione o paciente da agenda.');
        patientOrThrow(patientId);
        next.patientId = patientId;
      }
      if (Object.hasOwn(patch, 'note')) next.note = String(patch.note ?? '').trim();
      Object.assign(item, next);
      return sourceCopy(item);
    }
  };
}
