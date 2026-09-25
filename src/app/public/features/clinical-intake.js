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

function emptyIntake() {
  return { anamnesis: {}, consent: null, consents: [], encounters: [], safetyChecklist: {} };
}

function consentLabel(status) {
  if (status === 'accepted') return 'Aceito';
  if (status === 'revoked') return 'Revogado';
  return 'Pendente';
}

export function createClinicalIntakePanels({ gateway, patientId, onChanged, onMessage }) {
  const local = { intake: emptyIntake() };

  async function load() {
    local.intake = await gateway.getClinicalIntake(patientId) || emptyIntake();
  }

  function intake() {
    return local.intake || emptyIntake();
  }

  function safetyChecklist() {
    const data = intake().safetyChecklist || {};
    return `<section class="card clinical-intake-card" data-c09-checklist>
      <div class="section-head"><div><span class="eyebrow">C09 · SEGURANÇA</span><h2>Checklist de segurança pré-sessão</h2></div><span class="status-badge status-warning">Revisão profissional</span></div>
      <p class="muted">Checklist operacional transitório. O software não determina elegibilidade clínica nem substitui a avaliação profissional.</p>
      <div class="safety-checklist">${SAFETY_ITEMS.map(([key, label]) => `<label class="check-row"><input type="checkbox" data-safety-key="${key}" ${checked(data[key])}><span>${escapeHtml(label)}</span></label>`).join('')}</div>
      <div class="actions"><button type="button" class="secondary" data-save-safety>Atualizar checklist desta sessão</button></div>
      <p class="module-note">O C09 permanece apenas no estado da interface até a sessão ser registrada; ele não cria uma inferência clínica nem uma nova entidade persistida.</p>
    </section>`;
  }

  function anamnesis() {
    const data = intake().anamnesis || {};
    return `<div class="clinical-intake-stack" data-clinical-intake>
      <section class="card clinical-intake-card">
        <div class="section-head"><div><span class="eyebrow">ANAMNESE</span><h2>Anamnese clínica</h2></div>${statusBadge(data.recordedAt ? 'Persistido' : 'Novo registro', data.recordedAt ? 'success' : 'info')}</div>
        <p class="muted">Cada salvamento registra uma nova avaliação clínica vinculada a um atendimento, preservando o histórico.</p>
        <div class="form-grid clinical-form-grid">
          <label>Queixa principal<textarea name="anamnesis-chief-complaint" rows="3">${escapeHtml(data.chiefComplaint || '')}</textarea></label>
          <label>Histórico clínico<textarea name="anamnesis-history" rows="3">${escapeHtml(data.history || '')}</textarea></label>
          <label>Medicações informadas<textarea name="anamnesis-medications" rows="3">${escapeHtml(data.medications || '')}</textarea></label>
          <label>Alergias<textarea name="anamnesis-allergies" rows="3">${escapeHtml(data.allergies || '')}</textarea></label>
          <label>Precauções<textarea name="anamnesis-precautions" rows="3">${escapeHtml(data.precautions || '')}</textarea></label>
          <label>Dor (0–10)<input name="anamnesis-pain-score" type="number" min="0" max="10" step="1" value="${escapeHtml(data.painScore || '')}"></label>
        </div>
        <div class="actions"><button type="button" class="primary" data-save-anamnesis>Salvar anamnese</button></div>
      </section>
      ${safetyChecklist()}
    </div>`;
  }

  function consentHistory() {
    const records = intake().consents || [];
    if (!records.length) return '<p class="muted">Nenhum consentimento registrado.</p>';
    return `<div class="evolution-list" data-consent-history>${[...records].reverse().map((record) => `<article class="card compact-card" data-consent-record="${escapeHtml(record.id)}">
      <div class="section-head"><div><strong>${escapeHtml(record.consentType || 'Consentimento PBM')}</strong><div class="muted">Versão ${escapeHtml(record.version || '—')}</div></div>${statusBadge(consentLabel(record.status), record.status === 'accepted' ? 'success' : 'neutral')}</div>
      <div class="muted">${escapeHtml(record.acceptedAt || record.revokedAt || record.createdAt || '—')}</div>
      ${record.status === 'revoked' && record.evidence?.reason ? `<p>Motivo: ${escapeHtml(record.evidence.reason)}</p>` : ''}
    </article>`).join('')}</div>`;
  }

  function consents() {
    const latest = intake().consent;
    const accepted = latest?.status === 'accepted';
    return `<section class="card clinical-intake-card" data-consent-panel>
      <div class="section-head"><div><span class="eyebrow">CONSENTIMENTO</span><h2>Consentimento informado</h2></div>${statusBadge(accepted ? 'Aceito' : latest?.status === 'revoked' ? 'Revogado' : 'Pendente', accepted ? 'success' : 'warning')}</div>
      <p>O histórico é append-only: aceite e revogação são registros distintos e auditáveis. A interface não afirma assinatura digital.</p>
      <div class="actions"><button type="button" class="primary" data-accept-consent>Registrar aceite</button></div>
      ${accepted ? `<div class="form-grid"><label>Motivo da revogação<input name="consent-revoke-reason" placeholder="Motivo informado pelo paciente/profissional"></label><div class="actions"><button type="button" class="secondary" data-revoke-consent="${escapeHtml(latest.id)}">Registrar revogação</button></div></div>` : ''}
      <h3>Histórico</h3>
      ${consentHistory()}
    </section>`;
  }

  function bindActions(root = document) {
    root.querySelector('[data-save-anamnesis]')?.addEventListener('click', async () => {
      try {
        local.intake = await gateway.updateAnamnesis(patientId, {
          chiefComplaint: root.querySelector('[name="anamnesis-chief-complaint"]')?.value ?? '',
          history: root.querySelector('[name="anamnesis-history"]')?.value ?? '',
          medications: root.querySelector('[name="anamnesis-medications"]')?.value ?? '',
          allergies: root.querySelector('[name="anamnesis-allergies"]')?.value ?? '',
          precautions: root.querySelector('[name="anamnesis-precautions"]')?.value ?? '',
          painScore: root.querySelector('[name="anamnesis-pain-score"]')?.value ?? ''
        });
        onMessage?.('Anamnese salva no prontuário.', 'success');
        onChanged?.();
      } catch (error) {
        onMessage?.(error.message);
      }
    });

    root.querySelector('[data-save-safety]')?.addEventListener('click', async () => {
      const patch = {};
      root.querySelectorAll('[data-safety-key]').forEach((input) => { patch[input.dataset.safetyKey] = input.checked; });
      try {
        local.intake = await gateway.updateSafetyChecklist(patientId, patch);
        onMessage?.('Checklist C09 atualizado para esta sessão de interface.', 'success');
        onChanged?.();
      } catch (error) {
        onMessage?.(error.message);
      }
    });

    root.querySelector('[data-accept-consent]')?.addEventListener('click', async () => {
      try {
        local.intake = await gateway.updateConsent(patientId, {
          consentType: 'pbm-treatment',
          version: '1.0',
          evidence: { method: 'local-ui-confirmation' }
        });
        onMessage?.('Aceite de consentimento registrado no histórico.', 'success');
        onChanged?.();
      } catch (error) {
        onMessage?.(error.message);
      }
    });

    root.querySelector('[data-revoke-consent]')?.addEventListener('click', async (event) => {
      const reason = root.querySelector('[name="consent-revoke-reason"]')?.value ?? '';
      try {
        await gateway.revokeConsent(event.currentTarget.dataset.revokeConsent, reason);
        await load();
        onMessage?.('Revogação registrada sem alterar o aceite histórico.', 'success');
        onChanged?.();
      } catch (error) {
        onMessage?.(error.message);
      }
    });
  }

  return { load, anamnesis, consents, safetyChecklist, bindActions };
}
