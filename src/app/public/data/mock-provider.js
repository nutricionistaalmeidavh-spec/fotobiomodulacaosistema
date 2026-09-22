import { UI_FIXTURES } from './fixtures.js';
import { cloneUiData } from './contracts.js';

export function createMockUiProvider(seed = UI_FIXTURES) {
  const state = cloneUiData(seed);
  let sequence = state.patients.length + 1;

  function currentDashboard() {
    const dashboard = cloneUiData(state.dashboard);
    dashboard.activePatients = state.patients.filter((patient) => patient.status === 'active').length;
    return dashboard;
  }

  return {
    getDashboard() {
      return currentDashboard();
    },
    listPatients() {
      return cloneUiData(state.patients);
    },
    getPatient(id) {
      return cloneUiData(state.patients.find((patient) => patient.id === id) || null);
    },
    createPatient(input = {}) {
      const fullName = String(input.fullName ?? '').trim();
      if (!fullName) throw new TypeError('Nome do paciente é obrigatório.');
      const id = `mock-patient-${String(sequence++).padStart(3, '0')}`;
      const patient = {
        id,
        fullName,
        status: input.status === 'inactive' ? 'inactive' : 'active',
        phone: String(input.phone ?? '').trim(),
        email: String(input.email ?? '').trim(),
        notes: String(input.notes ?? '').trim(),
        birthDate: String(input.birthDate ?? '').trim(),
        lastSession: null,
        nextSession: null,
        currentProtocol: null,
        alerts: [],
        pendingItems: [],
        timeline: []
      };
      state.patients.push(patient);
      return cloneUiData(patient);
    }
  };
}
