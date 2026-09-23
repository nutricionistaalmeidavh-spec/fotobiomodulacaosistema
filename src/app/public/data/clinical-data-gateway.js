import { assertAdapterCapabilities, F0_ADAPTER_METHODS, LOCAL_ADAPTER_METHODS } from './contracts.js';

export function createClinicalDataGateway({ f0Adapter, localAdapter }) {
  assertAdapterCapabilities('f0Adapter', f0Adapter, F0_ADAPTER_METHODS);
  assertAdapterCapabilities('localAdapter', localAdapter, LOCAL_ADAPTER_METHODS);

  return {
    ...Object.fromEntries(LOCAL_ADAPTER_METHODS.map((name) => [name, (...args) => localAdapter[name](...args)])),
    ...Object.fromEntries(F0_ADAPTER_METHODS.map((name) => [name, (...args) => f0Adapter[name](...args)]))
  };
}
