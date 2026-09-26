import { DATA_SOURCE } from '../contracts.js';
import { apiRequest } from '../http-client.js';

function persisted(value) {
  if (Array.isArray(value)) return value.map((item) => ({ ...item, source: DATA_SOURCE.PERSISTED }));
  return value == null ? value : { ...value, source: DATA_SOURCE.PERSISTED };
}

export function createF0ApiAdapter({ request = fetch } = {}) {
  const json = (path, options = {}) => apiRequest(path, { request, ...options });
  return {
    async getFoundationStatus() {
      return json('/api/status');
    },
    async listProtocols() {
      const payload = await json('/api/protocols');
      return persisted(payload.protocols || []);
    },
    async createProtocol(input) {
      const payload = await json('/api/protocols', { method: 'POST', body: input });
      return persisted(payload.protocol);
    },
    async createProtocolVersion(protocolId, input) {
      const payload = await json(`/api/protocols/${encodeURIComponent(protocolId)}/versions`, { method: 'POST', body: input });
      return persisted(payload.version || payload);
    },
    async listEquipment() {
      const payload = await json('/api/equipment');
      return persisted(payload.equipment || []);
    },
    async createEquipment(input) {
      const payload = await json('/api/equipment', { method: 'POST', body: input });
      return persisted(payload.equipment);
    },
    async updateEquipment(id, patch) {
      const payload = await json(`/api/equipment/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch });
      return persisted(payload.equipment);
    },
    async createApplicator(equipmentId, input) {
      const payload = await json(`/api/equipment/${encodeURIComponent(equipmentId)}/applicators`, { method: 'POST', body: input });
      return persisted(payload.applicator);
    },
    async adaptProtocolVersion(protocolVersionId, applicatorId, selectedPowerMw = null) {
      const payload = await json(`/api/protocol-versions/${encodeURIComponent(protocolVersionId)}/adapt`, {
        method: 'POST',
        body: { applicatorId, selectedPowerMw }
      });
      return payload.adaptation;
    },
    async listOpenEncounters() {
      const payload = await json('/api/encounters/open');
      return persisted(payload.encounters || []);
    },
    async listSessions() {
      const payload = await json('/api/sessions');
      return persisted(payload.sessions || []);
    },
    async createSession(input) {
      const payload = await json('/api/sessions', { method: 'POST', body: input });
      return persisted(payload.session || payload);
    },
    async recordBodyMapPoint(sessionId, input) {
      const payload = await json(`/api/sessions/${encodeURIComponent(sessionId)}/body-map-points`, { method: 'POST', body: input });
      return persisted(payload.point);
    },
    async listPatientBodyMapPoints(patientId) {
      const payload = await json(`/api/patients/${encodeURIComponent(patientId)}/body-map-points`);
      return persisted(payload.points || []);
    },
    async getAuditState() {
      const payload = await json('/api/audit');
      return { ...payload, source: DATA_SOURCE.PERSISTED };
    }
  };
}
