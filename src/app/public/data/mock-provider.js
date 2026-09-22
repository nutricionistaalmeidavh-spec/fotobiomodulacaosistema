import { UI_FIXTURES } from './fixtures.js';
import { cloneUiData } from './contracts.js';

function emptyClinicalIntake() {
  return {
    anamnesis: { complaint: '', goal: '', medications: '', precautions: '' },
    consent: { status: 'pending', updatedAt: null },
    safetyChecklist: {
      identityConfirmed: false,
      objectiveReviewed: false,
      precautionsReviewed: false,
      siteReviewed: false,
      equipmentReviewed: false,
      professionalConfirmed: false
    }
  };
}

export function createMockUiProvider(seed = UI_FIXTURES) {
  const state = cloneUiData(seed);
  state.patients.forEach((patient) => { patient.clinicalIntake ||= emptyClinicalIntake(); });
  let sequence = state.patients.length + 1;

  function currentDashboard() {
    const dashboard = cloneUiData(state.dashboard);
    dashboard.activePatients = state.patients.filter((patient) => patient.status === 'active').length;
    return dashboard;
  }

  function patientOrThrow(id) {
    const patient = state.patients.find((item) => item.id === id);
    if (!patient) throw new TypeError('Paciente local não encontrado.');
    patient.clinicalIntake ||= emptyClinicalIntake();
    return patient;
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
        clinicalIntake: emptyClinicalIntake(),
        timeline: []
      };
      state.patients.push(patient);
      return cloneUiData(patient);
    },
    getClinicalIntake(id) {
      return cloneUiData(patientOrThrow(id).clinicalIntake);
    },
    updateAnamnesis(id, patch = {}) {
      const patient = patientOrThrow(id);
      Object.assign(patient.clinicalIntake.anamnesis, {
        complaint: String(patch.complaint ?? patient.clinicalIntake.anamnesis.complaint),
        goal: String(patch.goal ?? patient.clinicalIntake.anamnesis.goal),
        medications: String(patch.medications ?? patient.clinicalIntake.anamnesis.medications),
        precautions: String(patch.precautions ?? patient.clinicalIntake.anamnesis.precautions)
      });
      return cloneUiData(patient.clinicalIntake);
    },
    updateConsent(id, patch = {}) {
      const patient = patientOrThrow(id);
      Object.assign(patient.clinicalIntake.consent, patch);
      return cloneUiData(patient.clinicalIntake);
    },
    updateSafetyChecklist(id, patch = {}) {
      const patient = patientOrThrow(id);
      for (const key of Object.keys(patient.clinicalIntake.safetyChecklist)) {
        if (Object.hasOwn(patch, key)) patient.clinicalIntake.safetyChecklist[key] = Boolean(patch[key]);
      }
      return cloneUiData(patient.clinicalIntake);
    }
  };
}
