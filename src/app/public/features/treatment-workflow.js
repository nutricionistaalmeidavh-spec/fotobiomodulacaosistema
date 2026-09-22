import { escapeHtml } from '../ui/primitives.js';

export const TREATMENT_STAGES = Object.freeze([
  { id: 'planning', label: 'Planejamento' },
  { id: 'safety', label: 'Segurança' },
  { id: 'application', label: 'Aplicação' },
  { id: 'record', label: 'Registro' },
  { id: 'evolution', label: 'Evolução' }
]);

function protocolOptions(protocols = []) {
  return protocols.flatMap((protocol) => (protocol.versions || []).map((version) =>
    `<option value="${escapeHtml(version.id)}">${escapeHtml(protocol.title)} · v${escapeHtml(version.versionNumber)}</option>`
  )).join('');
}

function sessionHistory(sessions = []) {
  if (!sessions.length) return '<p class="muted">Nenhuma sessão registrada ainda.</p>';
  return sessions.map((session) => `<article class="version-item">
    <header><strong>${escapeHtml(session.protocolTitle || 'Sem protocolo')} · v${escapeHtml(session.protocolVersionNumber || '—')}</strong><span class="muted">${escapeHtml(session.status || '')}</span></header>
    <div>Planejado: ${escapeHtml(session.plannedParameters?.energyJ ?? '—')} J · Aplicado: ${escapeHtml(session.appliedParameters?.energyJ ?? '—')} J</div>
    ${session.professionalAdjustmentReason ? `<div><strong>Justificativa:</strong> ${escapeHtml(session.professionalAdjustmentReason)}</div>` : ''}
  </article>`).join('');
}

export function renderTreatmentWorkflow({ protocols = [], sessions = [] } = {}) {
  const options = protocolOptions(protocols);
  return `<div class="page-stack treatment-workflow" data-treatment-workflow>
    <div class="page-heading"><div><span class="eyebrow">SESSÃO CLÍNICA</span><h1>Atendimento guiado e rastreável</h1><p>O fluxo organiza o atendimento em etapas sem automatizar decisão clínica. Parâmetros planejados e aplicados permanecem separados.</p></div><span class="status-badge status-warning">Decisão profissional</span></div>

    <nav class="treatment-steps" aria-label="Etapas do atendimento">
      ${TREATMENT_STAGES.map((stage, index) => `<button type="button" aria-label="${stage.label}" class="treatment-step${index === 0 ? ' is-active' : ''}" data-treatment-stage="${stage.id}" aria-current="${index === 0 ? 'step' : 'false'}"><span aria-hidden="true">${index + 1}</span>${stage.label}</button>`).join('')}
    </nav>

    <section class="card treatment-stage-panel" data-treatment-panel="planning">
      <div class="section-head"><div><span class="eyebrow">1 · PLANEJAMENTO</span><h2>Planejamento da sessão</h2></div><span class="status-badge status-info">Planejado</span></div>
      <p>Escolha uma versão imutável do protocolo e registre apenas o parâmetro planejado desta aplicação.</p>
      <label>Versão do protocolo<select name="session-protocol-version">${options}</select></label>
      <label>Energia planejada (J)<input type="number" min="0.01" step="0.1" name="planned-energy" value="4"></label>
      <div class="module-note">A seleção de protocolo não é recomendação automática; o profissional continua responsável pela decisão e pelos parâmetros definidos.</div>
    </section>

    <section class="card treatment-stage-panel" data-treatment-panel="safety" hidden>
      <div class="section-head"><div><span class="eyebrow">2 · SEGURANÇA</span><h2>Segurança pré-sessão</h2></div><span class="status-badge status-warning">C09 local</span></div>
      <p>Revisão operacional antes da aplicação. Este checkpoint é local de interface e não representa liberação clínica pelo software.</p>
      <div class="safety-checklist session-safety-list">
        <label class="check-row"><input type="checkbox" data-session-safety="identity"><span>Paciente e contexto confirmados</span></label>
        <label class="check-row"><input type="checkbox" data-session-safety="precautions"><span>Precauções e informações relevantes revisadas</span></label>
        <label class="check-row"><input type="checkbox" data-session-safety="equipment"><span>Equipamento e aplicador conferidos</span></label>
        <label class="check-row"><input type="checkbox" data-session-safety="professional"><span>Confirmação profissional antes da aplicação</span></label>
      </div>
      <div class="module-note">Nenhum item desta etapa é persistido no backend F0 nesta fase.</div>
    </section>

    <section class="card treatment-stage-panel" data-treatment-panel="application" hidden>
      <div class="section-head"><div><span class="eyebrow">3 · APLICAÇÃO</span><h2>Parâmetro aplicado</h2></div><span class="status-badge status-warning">Aplicado</span></div>
      <p>Registre o que foi efetivamente aplicado, independentemente do que havia sido planejado.</p>
      <label>Energia aplicada (J)<input type="number" min="0.01" step="0.1" name="applied-energy" value="4"></label>
      <div class="module-note">A diferença entre planejado e aplicado exigirá justificativa profissional antes do registro final.</div>
    </section>

    <section class="card treatment-stage-panel" data-treatment-panel="record" hidden>
      <div class="section-head"><div><span class="eyebrow">4 · REGISTRO</span><h2>Registro rastreável</h2></div><span class="status-badge status-success">Backend F0</span></div>
      <p>Finalize somente após revisar o atendimento. O backend continuará preservando snapshots separados de planejado e aplicado.</p>
      <label>Motivo profissional do ajuste<input name="adjustment-reason" placeholder="Obrigatório se aplicado ≠ planejado"></label>
      <div class="actions"><button type="button" class="primary" data-create-session>Registrar sessão</button></div>
    </section>

    <section class="card treatment-stage-panel" data-treatment-panel="evolution" hidden>
      <div class="section-head"><div><span class="eyebrow">5 · EVOLUÇÃO</span><h2>Histórico de sessões</h2></div><span class="status-badge status-info">Persistido</span></div>
      <div class="version-list" data-treatment-history>${sessionHistory(sessions)}</div>
    </section>
  </div>`;
}

export function bindTreatmentWorkflow(root = document) {
  const workflow = root.querySelector('[data-treatment-workflow]');
  if (!workflow) return;

  const activate = (stageId) => {
    workflow.querySelectorAll('[data-treatment-stage]').forEach((button) => {
      const active = button.dataset.treatmentStage === stageId;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-current', active ? 'step' : 'false');
    });
    workflow.querySelectorAll('[data-treatment-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.treatmentPanel !== stageId;
    });
  };

  workflow.querySelectorAll('[data-treatment-stage]').forEach((button) => {
    button.addEventListener('click', () => activate(button.dataset.treatmentStage));
  });
}
