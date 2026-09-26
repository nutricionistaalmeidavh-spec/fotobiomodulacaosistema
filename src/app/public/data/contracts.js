export const DATA_SOURCE = Object.freeze({ LOCAL: 'local', PERSISTED: 'persisted' });

export const F0_ADAPTER_METHODS = Object.freeze([
  'getFoundationStatus',
  'listProtocols',
  'createProtocol',
  'createProtocolVersion',
  'listEquipment',
  'createEquipment',
  'updateEquipment',
  'createApplicator',
  'adaptProtocolVersion',
  'listOpenEncounters',
  'listSessions',
  'createSession',
  'recordBodyMapPoint',
  'listPatientBodyMapPoints',
  'getAuditState'
]);

export const CLINICAL_ADAPTER_METHODS = Object.freeze([
  'getDashboard',
  'listPatients',
  'getPatient',
  'createPatient',
  'updatePatient',
  'archivePatient',
  'getClinicalIntake',
  'updateAnamnesis',
  'updateConsent',
  'revokeConsent',
  'updateSafetyChecklist',
  'listEvolution',
  'addEvolution',
  'listPhotos',
  'addPhotoMetadata',
  'removePhotoMetadata',
  'startEncounter',
  'listConsents',
  'listOutcomes',
  'listDocuments',
  'generateEncounterPdf',
  'listEvidence',
  'createEvidence',
  'listProtocolEvidence',
  'linkEvidenceToProtocolVersion',
  'searchClinicalProtocols',
  'getBodyMapCatalog'
]);

export const OPERATIONS_ADAPTER_METHODS = Object.freeze([
  'listAgenda',
  'createAgendaItem',
  'updateAgendaItem',
  'listPackages',
  'createPackage',
  'consumePackage',
  'listPayments',
  'createPayment',
  'markPaymentPaid',
  'getOperationalReport'
]);

export const AUTH_ADAPTER_METHODS = Object.freeze([
  'getAuthStatus', 'setupAuth', 'login', 'logout'
]);

export const ADMIN_ADAPTER_METHODS = Object.freeze([
  'getClinic', 'updateClinic', 'listAccounts', 'createAccount', 'updateAccount',
  'revokeAccountSessions', 'listAuthSessions', 'verifyOperationalIntegrity',
  'createAdminBackup', 'previewRestore', 'listAuditEvents', 'listMediaRetentionCandidates'
]);

export function assertAdapterCapabilities(name, adapter, methods) {
  if (!adapter || typeof adapter !== 'object') throw new TypeError(`${name} is required`);
  for (const method of methods) {
    if (typeof adapter[method] !== 'function') throw new TypeError(`${name} must implement ${method}()`);
  }
  return adapter;
}

export function cloneUiData(value) {
  return value == null ? value : structuredClone(value);
}
