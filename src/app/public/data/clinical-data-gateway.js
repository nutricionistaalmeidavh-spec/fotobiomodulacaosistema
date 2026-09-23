import { assertAdapterCapabilities, F0_ADAPTER_METHODS, LOCAL_ADAPTER_METHODS } from './contracts.js';
import { deriveOperationalReport } from './operational-report.js';

export function createClinicalDataGateway({ f0Adapter, localAdapter, reportAdapter = null }) {
  assertAdapterCapabilities('f0Adapter', f0Adapter, F0_ADAPTER_METHODS);
  assertAdapterCapabilities('localAdapter', localAdapter, LOCAL_ADAPTER_METHODS);

  return {
    ...Object.fromEntries(LOCAL_ADAPTER_METHODS.map((name) => [name, (...args) => localAdapter[name](...args)])),
    ...Object.fromEntries(F0_ADAPTER_METHODS.map((name) => [name, (...args) => f0Adapter[name](...args)])),
    async getOperationalReport(filters = {}) {
      if (reportAdapter?.getOperationalReport) return reportAdapter.getOperationalReport(filters);
      const [patients, sessions, protocols] = await Promise.all([
        localAdapter.listPatients(),
        f0Adapter.listSessions(),
        f0Adapter.listProtocols()
      ]);
      return deriveOperationalReport({ patients, sessions, protocols, filters });
    }
  };
}
