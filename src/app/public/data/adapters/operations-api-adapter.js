import { DATA_SOURCE } from '../contracts.js';
import { apiRequest, withQuery } from '../http-client.js';

function persisted(value) {
  if (Array.isArray(value)) return value.map((item) => ({ ...item, source: DATA_SOURCE.PERSISTED }));
  return value == null ? value : { ...value, source: DATA_SOURCE.PERSISTED };
}

export function createOperationsApiAdapter({ request = fetch } = {}) {
  const json = (path, options = {}) => apiRequest(path, { request, ...options });
  return {
    async listAgenda(filters = {}) {
      const payload = await json(withQuery('/api/appointments', filters));
      return persisted((payload.appointments || []).map((item) => ({
        ...item,
        startsAt: item.startsAt || item.startAt,
        note: item.note || item.notes || ''
      })));
    },
    async createAgendaItem(input) {
      const payload = await json('/api/appointments', { method: 'POST', body: input });
      const item = (payload.appointments || [])[0] || payload.appointment;
      return persisted(item);
    },
    async updateAgendaItem(id, patch) {
      const payload = await json(`/api/appointments/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch });
      return persisted(payload.appointment);
    },
    async listPackages(filters = {}) {
      const payload = await json(withQuery('/api/packages', filters));
      return persisted(payload.packages || []);
    },
    async createPackage(input) {
      const payload = await json('/api/packages', { method: 'POST', body: input });
      return persisted(payload.package);
    },
    async consumePackage(id, treatmentSessionId) {
      const payload = await json(`/api/packages/${encodeURIComponent(id)}/consume`, { method: 'POST', body: { treatmentSessionId } });
      return persisted(payload.usage);
    },
    async listPayments(filters = {}) {
      const payload = await json(withQuery('/api/payments', filters));
      return persisted(payload.payments || []);
    },
    async createPayment(input) {
      const payload = await json('/api/payments', { method: 'POST', body: input });
      return persisted(payload.payment);
    },
    async markPaymentPaid(id, paidAt) {
      const payload = await json(`/api/payments/${encodeURIComponent(id)}/pay`, { method: 'POST', body: paidAt ? { paidAt } : {} });
      return persisted(payload.payment);
    },
    async getOperationalReport(filters = {}) {
      const payload = await json(withQuery('/api/reports/operations', filters));
      return payload.report || payload;
    }
  };
}
