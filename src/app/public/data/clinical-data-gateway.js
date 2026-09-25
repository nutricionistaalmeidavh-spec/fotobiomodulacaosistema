import {
  ADMIN_ADAPTER_METHODS,
  assertAdapterCapabilities,
  AUTH_ADAPTER_METHODS,
  CLINICAL_ADAPTER_METHODS,
  F0_ADAPTER_METHODS,
  OPERATIONS_ADAPTER_METHODS
} from './contracts.js';

function expose(adapter, methods) {
  return Object.fromEntries(methods.map((name) => [name, (...args) => adapter[name](...args)]));
}

export function createClinicalDataGateway({
  f0Adapter,
  clinicalAdapter,
  operationsAdapter,
  authAdapter,
  adminAdapter
}) {
  assertAdapterCapabilities('f0Adapter', f0Adapter, F0_ADAPTER_METHODS);
  assertAdapterCapabilities('clinicalAdapter', clinicalAdapter, CLINICAL_ADAPTER_METHODS);
  assertAdapterCapabilities('operationsAdapter', operationsAdapter, OPERATIONS_ADAPTER_METHODS);
  assertAdapterCapabilities('authAdapter', authAdapter, AUTH_ADAPTER_METHODS);
  assertAdapterCapabilities('adminAdapter', adminAdapter, ADMIN_ADAPTER_METHODS);

  return Object.freeze({
    ...expose(authAdapter, AUTH_ADAPTER_METHODS),
    ...expose(clinicalAdapter, CLINICAL_ADAPTER_METHODS),
    ...expose(f0Adapter, F0_ADAPTER_METHODS),
    ...expose(operationsAdapter, OPERATIONS_ADAPTER_METHODS),
    ...expose(adminAdapter, ADMIN_ADAPTER_METHODS)
  });
}
