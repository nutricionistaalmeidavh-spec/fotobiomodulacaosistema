import { assertUiProvider } from '../data/contracts.js';
import { escapeHtml, statusBadge } from '../ui/primitives.js';

const SAFETY_ITEMS = Object.freeze([
  ['identityConfirmed', 'Identidade e paciente em contexto conferidos'],
  ['objectiveReviewed', 'Objetivo clínico e área de aplicação revisados'],
  ['precautionsReviewed', 'Precauções, contraindicações relatadas e medicações revisadas'],
  ['siteReviewed', 'Local de aplicação avaliado antes da sessão'],
  ['equipmentReviewed', 'Equipamento e aplicador conferidos'],
  ['professionalConfirmed', 'Confirmação profissional']
]);

function checked(value) {
  return value ? 'checked' : '';
}

export function createClinicalIntakePanels({ provider, patientId, onChanged, onMessage }) {
  assertUiProvider(provider);
  if (typeof provider.getClinicalIntake !== 'function') throw new TypeError('UI provider must implement getClinicalIntake()');

  function intake() {
    return provider.getClinicalIntake(patientId) || { anamnesis: {}, consent: {}, safetyChecklist: {} };
  }

  function safetyChecklist() {
    const data = intake().safetyChecklist || {};
    return `<section class="card clinical-intake-card" data-c09-checklist>
      <div class="section-head"><div><span class="eyebrow">C09 · SEGURANÇA</span><h2>Checklist de segurança pré-sessão</h2></div><span class="status-badge status-warning">Revisão profissional</span></div>
      <p class="muted">Checklist operacional local. O software não determina elegibilidade clínica nem substitui a avaliação profissional.</p>
      <div class="safety-checklist">${SAFETY_ITEMS.map(([key, label]) => `<label class="check-row"><input type="checkbox" data-safety-key="${key}" ${checked(data[key])}><span>${escapeHtml(label)}</span></label>`).join('')}</div>
      <div class="actions"><button type="button" class="secondary" data-save-safety>Atualizar checklist local</button></div>
      <p class="module-note">Estado local de interface — não persistido no backend clínico nesta etapa.</p>
    </section>`;
  }

  function anamnesis() {
    const data = intake().anamnesis || {};
    return `<div class="clinical-intake-stack" data-clinical-intake>
      <section class="card clinical-intake-card">
        <div class="section-head"><div><span class="eyebrow">ANAMNESE</span><h2>Anamnese clínica</h2></div><span class="status-badge status-info">Rascunho local</span></div>
        <p class="muted">Estrutura clínica de interface. Este rascunho é local e não persistido no backend F1.</p>
        <div class="form-grid clinical-form-grid">
          <label>Queixa principal<textarea name="anamnesis-complaint" rows="3">${escapeHtml(data.complaint || '')}</textarea></label>
          <label>Objetivo do atendimento<textarea name="anamnesis-goal" rows="3">${escapeHtml(data.goal || '')}</textarea></label>
          <label>Medicações informadas<textarea name="anamnesis-medications" rows="3">${escapeHtml(data.medications || '')}</textarea></label>
          <label>Precauções e observações<textarea name="anamnesis-precautions" rows="3">${escapeHtml(data.precautions || '')}</textarea></label>
        </div>
        <div class="actions"><button type="button" class="primary" data-save-anamnesis>Salvar rascunho local</button></div>
      </section>
      ${safetyChecklist()}
    </div>`;
  }

  function consents() {
    const data = intake().consent || {};
    const collected = data.status === 'collected-local';
    return `<section class="card clinical-intake-card" data-consent-panel>
      <div class="section-head"><div><span class="eyebrow">CONSENTIMENTO</span><h2>Consentimento informado</h2></div>${statusBadge(collected ? 'Coletado localmente' : 'Pendente', collected ? 'success' : 'warning')}</div>
      <p>O fluxo está preparado para histórico e vínculo clínico. Nesta fase, qualquer mudança é somente um <strong>registro local de interface</strong>.</p>
      <div class="consent-summary"><div><span class="muted">Status</span><strong>${collected ? 'Coletado localmente' : 'Pendente'}</strong></div><div><span class="muted">Última atualização</span><strong>${escapeHtml(data.updatedAt || 'Sem registro persistido')}</strong></div></div>
      <div class="module-note">Nenhum consentimento registrado no backend. Esta ação não representa assinatura digital nem comprovação jurídica.</div>
      <div class="actions"><button type="button" class="primary" data-simulate-consent ${collected ? 'disabled' : ''}>${collected ? 'Simulação registrada' : 'Simular consentimento coletado'}</button></div>
    </section>`;
  }

  function bindActions(root = document) {
    root.querySelector('[data-save-anamnesis]')?.addEventListener('click', () => {
      provider.updateAnamnesis?.(patientId, {
        complaint: root.querySelector('[name="anamnesis-complaint"]')?.value ?? '',
        goal: root.querySelector('[name="anamnesis-goal"]')?.value ?? '',
        medications: root.querySelector('[name="anamnesis-medications"]')?.value ?? '',
        precautions: root.querySelector('[name="anamnesis-precautions"]')?.value ?? ''
      });
      onMessage?.('Rascunho local atualizado; nenhuma persistência clínica foi realizada.', 'success');
      onChanged?.();
    });

    root.querySelector('[data-save-safety]')?.addEventListener('click', () => {
      const patch = {};
      root.querySelectorAll('[data-safety-key]').forEach((input) => { patch[input.dataset.safetyKey] = input.checked; });
      provider.updateSafetyChecklist?.(patientId, patch);
      onMessage?.('Checklist C09 atualizado somente no estado local da interface.', 'success');
      onChanged?.();
    });

    root.querySelector('[data-simulate-consent]')?.addEventListener('click', () => {
      provider.updateConsent?.(patientId, { status: 'collected-local', updatedAt: 'Simulação local atual' });
      onMessage?.('Consentimento marcado somente na simulação local de interface.', 'success');
      onChanged?.();
    });
  }

  return { anamnesis, consents, safetyChecklist, bindActions };
}
