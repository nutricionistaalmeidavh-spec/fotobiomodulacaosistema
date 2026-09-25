import test from 'node:test';
import assert from 'node:assert/strict';
import { createClinicalIntakePanels } from '../src/app/public/features/clinical-intake.js';

function gateway() {
  const intake = {
    anamnesis: {
      chiefComplaint: 'Dor no ombro',
      history: 'Sintomas há duas semanas',
      medications: 'Informadas pelo paciente',
      allergies: '',
      precautions: '',
      painScore: '5'
    },
    consent: null,
    consents: [],
    encounters: [],
    safetyChecklist: { identityConfirmed: false, objectiveReviewed: false, precautionsReviewed: false, siteReviewed: false, equipmentReviewed: false, professionalConfirmed: false }
  };
  return {
    getClinicalIntake() { return structuredClone(intake); },
    updateAnamnesis(_id, patch) { Object.assign(intake.anamnesis, patch); return structuredClone(intake); },
    updateConsent() { return structuredClone(intake); },
    revokeConsent() { return {}; },
    updateSafetyChecklist(_id, patch) { Object.assign(intake.safetyChecklist, patch); return structuredClone(intake); }
  };
}

test('clinical intake renders persisted structured anamnesis and C09 without automatic clearance', () => {
  const panels = createClinicalIntakePanels({ gateway: gateway(), patientId: 'p1' });
  const html = panels.anamnesis();
  assert.match(html, /Queixa principal/);
  assert.match(html, /Histórico clínico/);
  assert.match(html, /Medicações informadas/);
  assert.match(html, /Alergias/);
  assert.match(html, /Dor \(0–10\)/);
  assert.match(html, /Cada salvamento registra uma nova avaliação clínica/);
  assert.match(html, /Checklist de segurança pré-sessão/);
  assert.match(html, /Confirmação profissional/);
  assert.doesNotMatch(html, /liberado automaticamente/i);
});

test('consent panel exposes append-only persisted history without claiming digital signature', () => {
  const panels = createClinicalIntakePanels({ gateway: gateway(), patientId: 'p1' });
  const html = panels.consents();
  assert.match(html, /Consentimento informado/);
  assert.match(html, /Pendente/);
  assert.match(html, /append-only/i);
  assert.match(html, /Registrar aceite/);
  assert.doesNotMatch(html, /assinatura digital concluída/i);
});
