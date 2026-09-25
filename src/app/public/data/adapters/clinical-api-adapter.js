import { DATA_SOURCE } from '../contracts.js';
import { apiRequest, withQuery } from '../http-client.js';

function persisted(value) {
  if (Array.isArray(value)) return value.map((item) => ({ ...item, source: DATA_SOURCE.PERSISTED }));
  return value == null ? value : { ...value, source: DATA_SOURCE.PERSISTED };
}

function patientUi(patient = {}) {
  return {
    ...patient,
    status: patient.active === false ? 'inactive' : 'active',
    source: DATA_SOURCE.PERSISTED
  };
}

function timelineUi(item = {}) {
  const type = item.type || 'note';
  if (type === 'assessment') return { id: item.id, category: 'assessment', date: String(item.at || item.recordedAt || '').slice(0, 10), title: 'Avaliação clínica', notes: item.chiefComplaint || item.history || '', source: DATA_SOURCE.PERSISTED };
  if (type === 'treatment_session') return { id: item.id, category: 'session', date: String(item.at || item.startedAt || '').slice(0, 10), title: item.protocolTitle || 'Sessão de fotobiomodulação', notes: item.professionalAdjustmentReason || '', sessionId: item.id, protocolVersionId: item.protocolVersionId || null, source: DATA_SOURCE.PERSISTED };
  if (type === 'outcome') return { id: item.id, category: 'follow-up', date: String(item.at || item.recordedAt || item.measuredAt || '').slice(0, 10), title: item.metricType || 'Evolução clínica', notes: item.narrative || item.notes || '', source: DATA_SOURCE.PERSISTED };
  return { id: item.id, category: 'note', date: String(item.at || item.startedAt || '').slice(0, 10), title: type === 'encounter' ? 'Atendimento clínico' : 'Registro clínico', notes: item.notes || '', source: DATA_SOURCE.PERSISTED };
}

export function createClinicalApiAdapter({ request = fetch } = {}) {
  const safetyByPatient = new Map();
  const json = (path, options = {}) => apiRequest(path, { request, ...options });

  return {
    async getDashboard() {
      const [status, patientsPayload] = await Promise.all([json('/api/status'), json('/api/patients')]);
      const patients = patientsPayload.patients || [];
      return {
        sessionsToday: 0,
        activePatients: patients.filter((item) => item.active !== false).length,
        pendingFollowUps: status.openEncounterCount || 0,
        recentProtocols: 0,
        recentActivity: [],
        source: DATA_SOURCE.PERSISTED
      };
    },
    async listPatients() {
      const payload = await json('/api/patients');
      return (payload.patients || []).map(patientUi);
    },
    async getPatient(patientId) {
      const payload = await json(`/api/patients/${encodeURIComponent(patientId)}/workspace`);
      const workspace = payload.patient ? payload : payload.workspace || payload;
      const patient = patientUi(workspace.patient || {});
      const sessions = workspace.sessions || [];
      const timeline = (workspace.timeline || []).map((item) => ({
        id: item.id,
        title: item.type === 'treatment_session' ? (item.protocolTitle || 'Sessão') : item.type === 'assessment' ? 'Avaliação clínica' : item.type === 'outcome' ? (item.metricType || 'Evolução') : 'Atendimento',
        description: item.narrative || item.notes || item.chiefComplaint || '',
        meta: item.at || item.recordedAt || item.startedAt || ''
      }));
      return {
        ...patient,
        timeline,
        lastSession: sessions[0]?.startedAt || null,
        nextSession: null,
        currentProtocol: sessions[0]?.protocolTitle || null,
        alerts: [],
        pendingItems: [],
        workspace
      };
    },
    async createPatient(input) {
      const payload = await json('/api/patients', { method: 'POST', body: input });
      return patientUi(payload.patient);
    },
    async updatePatient(patientId, patch) {
      const payload = await json(`/api/patients/${encodeURIComponent(patientId)}`, { method: 'PATCH', body: patch });
      return patientUi(payload.patient);
    },
    async archivePatient(patientId) {
      const payload = await json(`/api/patients/${encodeURIComponent(patientId)}/archive`, { method: 'POST', body: {} });
      return patientUi(payload.patient);
    },
    async getClinicalIntake(patientId) {
      const [workspace, consentsPayload] = await Promise.all([
        json(`/api/patients/${encodeURIComponent(patientId)}/workspace`),
        json(`/api/patients/${encodeURIComponent(patientId)}/consents`)
      ]);
      const assessment = workspace.assessments?.[0] || {};
      const consent = consentsPayload.consents?.at(-1) || null;
      return {
        anamnesis: {
          complaint: assessment.chiefComplaint || '',
          goal: assessment.history || '',
          medications: assessment.medications || '',
          precautions: assessment.precautions || ''
        },
        consent: { status: consent?.status === 'accepted' ? 'collected-local' : 'pending', updatedAt: consent?.acceptedAt || consent?.revokedAt || null },
        safetyChecklist: safetyByPatient.get(patientId) || {},
        source: DATA_SOURCE.PERSISTED
      };
    },
    async updateAnamnesis(patientId, patch = {}) {
      await json(`/api/patients/${encodeURIComponent(patientId)}/encounters`, {
        method: 'POST',
        body: {
          notes: patch.goal || '',
          assessment: {
            chiefComplaint: patch.complaint || '',
            history: patch.goal || '',
            medications: patch.medications || '',
            precautions: patch.precautions || ''
          }
        }
      });
      return this.getClinicalIntake(patientId);
    },
    async updateConsent(patientId) {
      await json(`/api/patients/${encodeURIComponent(patientId)}/consents`, {
        method: 'POST',
        body: { consentType: 'pbm-treatment', version: '1.0', evidence: { method: 'local-ui-confirmation' } }
      });
      return this.getClinicalIntake(patientId);
    },
    async updateSafetyChecklist(patientId, patch = {}) {
      safetyByPatient.set(patientId, { ...(safetyByPatient.get(patientId) || {}), ...patch });
      return this.getClinicalIntake(patientId);
    },
    async listEvolution(patientId, filters = {}) {
      const payload = await json(withQuery(`/api/patients/${encodeURIComponent(patientId)}/timeline`, { order: 'desc' }));
      let records = (payload.timeline || []).map(timelineUi);
      if (filters.category && filters.category !== 'all') records = records.filter((item) => item.category === filters.category);
      if (filters.from) records = records.filter((item) => item.date >= filters.from);
      if (filters.to) records = records.filter((item) => item.date <= filters.to);
      return records;
    },
    async addEvolution(patientId, input = {}) {
      const payload = await json(`/api/patients/${encodeURIComponent(patientId)}/basic-outcomes`, {
        method: 'POST',
        body: { metricType: 'clinical_note', narrative: [input.title, input.notes].filter(Boolean).join(' — ') }
      });
      return timelineUi({ type: 'outcome', ...payload.outcome, at: payload.outcome?.recordedAt || input.date });
    },
    async listPhotos(patientId) {
      const payload = await json(`/api/patients/${encodeURIComponent(patientId)}/media`);
      return persisted((payload.media || []).map((item) => ({
        ...item,
        capturedDate: String(item.capturedAt || item.createdAt || '').slice(0, 10),
        region: item.caption || 'Registro clínico',
        observation: item.caption || '',
        storageUrl: item.storagePath || null
      })));
    },
    async addPhotoMetadata() {
      throw new Error('O upload clínico persistente requer o arquivo da imagem; a tela será conectada ao upload real na integração F4.');
    },
    async removePhotoMetadata() {
      throw new Error('Mídia clínica persistida não é removida por esta ação.');
    },
    async startEncounter(patientId, input) {
      const payload = await json(`/api/patients/${encodeURIComponent(patientId)}/encounters`, { method: 'POST', body: input });
      return persisted(payload.encounter);
    },
    async listConsents(patientId) {
      const payload = await json(`/api/patients/${encodeURIComponent(patientId)}/consents`);
      return persisted(payload.consents || []);
    },
    async listOutcomes(patientId, filters = {}) {
      const payload = await json(withQuery(`/api/patients/${encodeURIComponent(patientId)}/outcomes`, filters));
      return persisted(payload.outcomes || []);
    },
    async listEvidence(filters = {}) {
      const payload = await json(withQuery('/api/evidence', { q: filters.query, ...filters }));
      return persisted(payload.evidence || []);
    },
    async searchClinicalProtocols(filters = {}) {
      const payload = await json(withQuery('/api/clinical-engine/protocols', filters));
      return persisted(payload.results || []);
    },
    async getBodyMapCatalog() {
      const payload = await json('/api/body-map/catalog');
      return payload.regions || [];
    }
  };
}
