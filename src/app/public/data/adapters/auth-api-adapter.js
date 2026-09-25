import { apiRequest } from '../http-client.js';

export function createAuthApiAdapter({ request = fetch } = {}) {
  return {
    async getAuthStatus() {
      return apiRequest('/api/auth/status', { request });
    },
    async setupAuth(input) {
      return apiRequest('/api/auth/setup', { request, method: 'POST', body: input });
    },
    async login(input) {
      return apiRequest('/api/auth/login', { request, method: 'POST', body: input });
    },
    async logout() {
      return apiRequest('/api/auth/logout', { request, method: 'POST', body: {} });
    }
  };
}
