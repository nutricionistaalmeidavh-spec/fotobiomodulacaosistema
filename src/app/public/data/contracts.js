export const UI_PROVIDER_METHODS = Object.freeze([
  'getDashboard',
  'listPatients',
  'getPatient',
  'createPatient'
]);

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
