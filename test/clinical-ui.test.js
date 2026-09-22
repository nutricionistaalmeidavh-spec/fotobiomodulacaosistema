import test from 'node:test';
import assert from 'node:assert/strict';
import { createClinicalIntakePanels } from '../src/app/public/features/clinical-intake.js';

function provider() {
  const intake = {
    anamnesis: { complaint: 'Dor no ombro', goal: 'Acompanhar função', medications: 'Informadas pelo paciente', precautions: '' },
    consent: { status: 'pending', updatedAt: null },
    safetyChecklist: { identityConfirmed: false, objectiveReviewed: false, precautionsReviewed: false, siteReviewed: false, equipmentReviewed: false, professionalConfirmed: false }
  };
  return {
    getDashboard() { return {}; },
    listPatients() { return []; },
    getPatient() { return { id: 'p1', fullName: 'Paciente Teste' }; },
    createPatient() { return {}; },
    getClinicalIntake() { return structuredClone(intake); },
    updateAnamnesis(_id, patch) { Object.assign(intake.anamnesis, patch); return structuredClone(intake); },
    updateConsent(_id, patch) { Object.assign(intake.consent, patch); return structuredClone(intake); },
    updateSafetyChecklist(_id, patch) { Object.assign(intake.safetyChecklist, patch); return structuredClone(intake); }
  };
}

test('clinical intake renders structured anamnesis, local-state notice and C09 without automatic clearance', () => {
  const panels = createClinicalIntakePanels({ provider: provider(), patientId: 'p1' });
  const html = panels.anamnesis();
  assert.match(html, /Queixa principal/);
  assert.match(html, /Objetivo do atendimento/);
  assert.match(html, /Medicações informadas/);
  assert.match(html, /não persistido/i);
  assert.match(html, /Checklist de segurança pré-sessão/);
  assert.match(html, /Confirmação profissional/);
  assert.doesNotMatch(html, /liberado automaticamente/i);
});

test('consent panel exposes status and does not claim digital signature or backend persistence', () => {
  const panels = createClinicalIntakePanels({ provider: provider(), patientId: 'p1' });
  const html = panels.consents();
  assert.match(html, /Consentimento informado/);
  assert.match(html, /Pendente/);
  assert.match(html, /registro local/i);
  assert.doesNotMatch(html, /assinatura digital concluída/i);
});
