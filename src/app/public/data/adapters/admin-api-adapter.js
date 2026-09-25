import { apiRequest, withQuery } from '../http-client.js';

export function createAdminApiAdapter({ request = fetch } = {}) {
  const json = (path, options = {}) => apiRequest(path, { request, ...options });
  return {
    async getClinic() { return (await json('/api/admin/clinic')).clinic; },
    async updateClinic(patch) { return (await json('/api/admin/clinic', { method: 'PATCH', body: patch })).clinic; },
    async listAccounts() { return (await json('/api/admin/accounts')).accounts || []; },
    async createAccount(input) { return (await json('/api/admin/accounts', { method: 'POST', body: input })).account; },
    async updateAccount(id, patch) { return (await json(`/api/admin/accounts/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch })).account; },
    async revokeAccountSessions(id) { return (await json(`/api/admin/accounts/${encodeURIComponent(id)}/revoke-sessions`, { method: 'POST', body: {} })).result; },
    async listAuthSessions() { return (await json('/api/admin/sessions')).sessions || []; },
    async verifyOperationalIntegrity() { return (await json('/api/admin/integrity')).integrity; },
    async createAdminBackup() { return (await json('/api/admin/backups', { method: 'POST', body: {} })).backup; },
    async previewRestore(input) { return (await json('/api/admin/restore-preview', { method: 'POST', body: input })).preview; },
    async listAuditEvents(filters = {}) { return (await json(withQuery('/api/admin/audit', filters))).events || []; },
    async listMediaRetentionCandidates(now) { return (await json(withQuery('/api/admin/media-retention-candidates', { now }))).media || []; }
  };
}
