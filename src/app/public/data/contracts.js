export const DATA_SOURCE = Object.freeze({ LOCAL: 'local', PERSISTED: 'persisted' });

export const F0_ADAPTER_METHODS = Object.freeze([
  'getFoundationStatus',
  'listProtocols',
  'createProtocol',
  'createProtocolVersion',
  'listEquipment',
  'listSessions',
  'createSession',
  'getAuditState'
]);

export const LOCAL_ADAPTER_METHODS = Object.freeze([
  'getDashboard',
  'listPatients',
  'getPatient',
  'createPatient',
  'getClinicalIntake',
  'updateAnamnesis',
  'updateConsent',
  'updateSafetyChecklist',
  'listEvolution',
  'addEvolution',
  'listPhotos',
  'addPhotoMetadata',
  'removePhotoMetadata',
  'listAgenda',
  'createAgendaItem',
  'updateAgendaItem'
]);

export const UI_PROVIDER_METHODS = Object.freeze([
  'getDashboard',
  'listPatients',
  'getPatient',
  'createPatient'
]);

export function assertAdapterCapabilities(name, adapter, methods) {
  if (!adapter || typeof adapter !== 'object') throw new TypeError(`${name} is required`);
  for (const method of methods) {
    if (typeof adapter[method] !== 'function') throw new TypeError(`${name} must implement ${method}()`);
  }
  return adapter;
}

export function assertUiProvider(provider) {
  if (!provider || typeof provider !== 'object') throw new TypeError('UI provider is required');
  for (const method of UI_PROVIDER_METHODS) {
    if (typeof provider[method] !== 'function') throw new TypeError(`UI provider must implement ${method}()`);
  }
  return provider;
}

export function cloneUiData(value) {
  return value == null ? value : structuredClone(value);
}
