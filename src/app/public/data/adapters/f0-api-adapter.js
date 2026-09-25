import { DATA_SOURCE } from '../contracts.js';
import { apiRequest } from '../http-client.js';

export function createF0ApiAdapter({ request = fetch } = {}) {
  const json = (path, options = {}) => apiRequest(path, { request, ...options });
  return {
    async getFoundationStatus() {
      return json('/api/status');
    },
    async listProtocols() {
      const payload = await json('/api/protocols');
      return (payload.protocols || []).map((item) => ({ ...item, source: DATA_SOURCE.PERSISTED }));
    },
    async createProtocol(input) {
      const payload = await json('/api/protocols', { method: 'POST', body: input });
      return { ...payload.protocol, source: DATA_SOURCE.PERSISTED };
    },
    async createProtocolVersion(protocolId, input) {
      const payload = await json(`/api/protocols/${encodeURIComponent(protocolId)}/versions`, { method: 'POST', body: input });
      return { ...(payload.version || payload), source: DATA_SOURCE.PERSISTED };
    },
    async listEquipment() {
      const payload = await json('/api/equipment');
      return (payload.equipment || []).map((item) => ({ ...item, source: DATA_SOURCE.PERSISTED }));
    },
    async listSessions() {
      const payload = await json('/api/sessions');
      return (payload.sessions || []).map((item) => ({ ...item, source: DATA_SOURCE.PERSISTED }));
    },
    async createSession(input) {
      const payload = await json('/api/sessions', { method: 'POST', body: input });
      return { ...(payload.session || payload), source: DATA_SOURCE.PERSISTED };
    },
    async getAuditState() {
      const payload = await json('/api/audit');
      return { ...payload, source: DATA_SOURCE.PERSISTED };
    }
  };
}
