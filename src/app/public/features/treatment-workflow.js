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

function encounterOptions(encounters = []) {
  if (!encounters.length) return '<option value="">Nenhum atendimento aberto</option>';
  return encounters.map((encounter) => `<option value="${escapeHtml(encounter.id)}">${escapeHtml(encounter.patientName || encounter.patientId || 'Paciente')} · ${escapeHtml(String(encounter.startedAt || '').slice(0, 16).replace('T', ' '))}</option>`).join('');
}

function equipmentOptions(equipment = []) {
  if (!equipment.length) return '<option value="">Nenhum equipamento cadastrado</option>';
  return equipment.filter((item) => item.active !== false).map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(`${item.manufacturer || ''} ${item.model || ''}`.trim())}</option>`).join('');
}

function applicatorOptions(equipment = [], equipmentId = null) {
  const selected = equipment.find((item) => item.id === equipmentId) || equipment.find((item) => item.active !== false);
  const applicators = (selected?.applicators || (selected?.applicator ? [selected.applicator] : [])).filter((item) => item.active !== false);
  if (!applicators.length) return '<option value="">Nenhum aplicador disponível</option>';
  return applicators.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name || 'Aplicador')}</option>`).join('');
}

function regionOptions(catalog = []) {
  return ['<option value="">Selecione a região</option>', ...catalog.map((region) => `<option value="${escapeHtml(region.id)}">${escapeHtml(region.label)}</option>`)].join('');
}

function sessionHistory(sessions = [], bodyMapPoints = []) {
  if (!sessions.length) return '<p class="muted">Nenhuma sessão registrada ainda.</p>';
  return sessions.map((session) => {
    const points = bodyMapPoints.filter((point) => point.treatmentSessionId === session.id);
    return `<article class="version-item" data-session-history="${escapeHtml(session.id)}">
      <header><strong>${escapeHtml(session.protocolTitle || 'Sem protocolo')} · v${escapeHtml(session.protocolVersionNumber || '—')}</strong><span class="muted">${escapeHtml(session.status || '')}</span></header>
      <div>Planejado: ${escapeHtml(session.plannedParameters?.energyJ ?? '—')} J · Aplicado: ${escapeHtml(session.appliedParameters?.energyJ ?? '—')} J</div>
      ${session.professionalAdjustmentReason ? `<div><strong>Justificativa:</strong> ${escapeHtml(session.professionalAdjustmentReason)}</div>` : ''}
      ${points.length ? `<div><strong>Mapa corporal:</strong> ${points.map((point) => escapeHtml(point.anatomicalLabel || point.regionLabel || point.regionId)).join(', ')}</div>` : ''}
    </article>`;
  }).join('');
}

function warningText(code) {
  const labels = {
    power_selection_required: 'Selecione explicitamente a potência do aplicador variável.',
    selected_power_out_of_range: 'A potência selecionada está fora da faixa cadastrada.',
    wavelength_incompatible: 'O comprimento de onda do aplicador não corresponde à referência.',
    mode_incompatible: 'O modo do aplicador não corresponde à referência.',
    frequency_incompatible: 'A frequência do aplicador não corresponde à referência.',
    power_missing: 'O aplicador não possui potência cadastrada.',
    spot_area_missing: 'O aplicador não possui área de spot cadastrada.',
    energy_missing: 'A versão de referência não possui energia calculável.'
  };
  return labels[code] || code;
}

export function renderAdaptationPreview(adaptation = null) {
  if (!adaptation) return '<span class="muted">Selecione protocolo, equipamento e aplicador para pré-visualizar a adaptação determinística.</span>';
  const reference = adaptation.referenceParameters || {};
  const derived = adaptation.equipmentDerivedParameters || {};
  const warnings = adaptation.warnings || [];
  return `<div class="adaptation-grid">
    <article class="card compact-card"><span class="eyebrow">REFERÊNCIA IMUTÁVEL</span><h3>Referência imutável</h3><dl>
      <div><dt>Potência</dt><dd data-reference-power>${escapeHtml(reference.powerMw ?? '—')} mW</dd></div>
      <div><dt>Tempo</dt><dd>${escapeHtml(reference.timeS ?? '—')} s</dd></div>
      <div><dt>Energia</dt><dd>${escapeHtml(reference.energyJ ?? '—')} J</dd></div>
      <div><dt>Área</dt><dd>${escapeHtml(reference.areaCm2 ?? '—')} cm²</dd></div>
    </dl></article>
    <article class="card compact-card"><span class="eyebrow">DERIVADO DO EQUIPAMENTO</span><h3>Derivado do equipamento</h3><dl>
      <div><dt>Potência</dt><dd data-derived-power>${escapeHtml(derived.powerMw ?? '—')} mW</dd></div>
      <div><dt>Tempo</dt><dd data-derived-time>${escapeHtml(derived.timeS ?? '—')} s</dd></div>
      <div><dt>Energia</dt><dd>${escapeHtml(derived.energyJ ?? '—')} J</dd></div>
      <div><dt>Área</dt><dd>${escapeHtml(derived.areaCm2 ?? '—')} cm²</dd></div>
    </dl></article>
    ${warnings.length ? `<div class="field-message ${adaptation.compatible ? 'field-warning' : 'field-error'}">${warnings.map(warningText).map(escapeHtml).join(' ')}</div>` : '<div class="field-message field-success">Adaptação calculada sem alertas bloqueantes.</div>'}
  </div>`;
}

export function renderTreatmentWorkflow({ protocols = [], sessions = [], equipment = [], openEncounters = [], bodyMapCatalog = [], bodyMapPoints = [] } = {}) {
  const options = protocolOptions(protocols);
  const firstEquipmentId = equipment.find((item) => item.active !== false)?.id || null;
  return `<div class="page-stack treatment-workflow" data-treatment-workflow>
    <div class="page-heading"><div><span class="eyebrow">SESSÃO CLÍNICA</span><h1>Atendimento guiado e rastreável</h1><p>O fluxo organiza o atendimento em etapas sem automatizar decisão clínica. Parâmetros planejados e aplicados permanecem separados.</p></div><span class="status-badge status-warning">Decisão profissional</span></div>

    <nav class="treatment-steps" aria-label="Etapas do atendimento">
      ${TREATMENT_STAGES.map((stage, index) => `<button type="button" aria-label="${stage.label}" class="treatment-step${index === 0 ? ' is-active' : ''}" data-treatment-stage="${stage.id}" aria-current="${index === 0 ? 'step' : 'false'}"><span aria-hidden="true">${index + 1}</span>${stage.label}</button>`).join('')}
    </nav>

    <section class="card treatment-stage-panel" data-treatment-panel="planning">
      <div class="section-head"><div><span class="eyebrow">1 · PLANEJAMENTO</span><h2>Planejamento da sessão</h2></div><span class="status-badge status-info">Planejado</span></div>
      <p>Escolha um atendimento real, uma versão imutável do protocolo e o equipamento que será utilizado.</p>
      <div class="form-grid">
        <label>Atendimento aberto<select name="session-encounter">${encounterOptions(openEncounters)}</select></label>
        <label>Versão do protocolo<select name="session-protocol-version">${options}</select></label>
        <label>Equipamento<select name="session-equipment">${equipmentOptions(equipment)}</select></label>
        <label>Aplicador<select name="session-applicator">${applicatorOptions(equipment, firstEquipmentId)}</select></label>
        <label>Potência selecionada (mW)<input type="number" min="0.01" step="any" name="selected-power" placeholder="Obrigatória se variável"></label>
        <label>Energia planejada (J)<input type="number" min="0.01" step="0.1" name="planned-energy" value="4"></label>
      </div>
      <div class="actions"><button type="button" class="secondary" data-preview-adaptation>Pré-visualizar adaptação</button></div>
      <div class="adaptation-preview" data-adaptation-preview aria-live="polite">${renderAdaptationPreview()}</div>
      <div class="module-note">A adaptação preserva a referência e calcula somente parâmetros derivados do equipamento. Não escolhe potência, protocolo ou dose pelo profissional.</div>
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
      <div class="module-note">Este checklist permanece transitório e não é usado para liberação clínica automática.</div>
    </section>

    <section class="card treatment-stage-panel" data-treatment-panel="application" hidden>
      <div class="section-head"><div><span class="eyebrow">3 · APLICAÇÃO</span><h2>Parâmetro aplicado e mapa corporal</h2></div><span class="status-badge status-warning">Aplicado</span></div>
      <p>Registre o que foi efetivamente aplicado e o ponto anatômico confirmado pelo profissional.</p>
      <div class="form-grid">
        <label>Energia aplicada (J)<input type="number" min="0.01" step="0.1" name="applied-energy" value="4"></label>
        <label>Região corporal<select name="body-region">${regionOptions(bodyMapCatalog)}</select></label>
        <label>Vista<select name="body-view"><option value="anterior">anterior</option><option value="posterior">posterior</option></select></label>
        <label>Lado<select name="body-laterality"><option value="right">right</option><option value="left">left</option><option value="bilateral">bilateral</option><option value="midline">midline</option></select></label>
        <label>Coordenada X<input type="number" min="0" max="1" step="0.01" name="body-x" value="0.5"></label>
        <label>Coordenada Y<input type="number" min="0" max="1" step="0.01" name="body-y" value="0.5"></label>
        <label class="field-span">Rótulo anatômico<input name="body-label" placeholder="Ex.: Ombro direito anterior"></label>
      </div>
      <div class="module-note">O mapa corporal registra localização; não seleciona parâmetros terapêuticos.</div>
    </section>

    <section class="card treatment-stage-panel" data-treatment-panel="record" hidden>
      <div class="section-head"><div><span class="eyebrow">4 · REGISTRO</span><h2>Registro rastreável</h2></div><span class="status-badge status-success">Persistido</span></div>
      <p>Finalize somente após revisar o atendimento. O backend preserva snapshots separados de planejado e aplicado.</p>
      <label>Motivo profissional do ajuste<input name="adjustment-reason" placeholder="Obrigatório se aplicado ≠ planejado"></label>
      <div class="actions"><button type="button" class="primary" data-create-session>Registrar sessão</button></div>
    </section>

    <section class="card treatment-stage-panel" data-treatment-panel="evolution" hidden>
      <div class="section-head"><div><span class="eyebrow">5 · EVOLUÇÃO</span><h2>Histórico de sessões</h2></div><span class="status-badge status-info">Persistido</span></div>
      <div class="version-list" data-treatment-history>${sessionHistory(sessions, bodyMapPoints)}</div>
    </section>
  </div>`;
}

export function bindTreatmentWorkflow(root = document, { equipment = [], onEquipmentChanged } = {}) {
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

  const equipmentSelect = workflow.querySelector('[name="session-equipment"]');
  const applicatorSelect = workflow.querySelector('[name="session-applicator"]');
  equipmentSelect?.addEventListener('change', () => {
    if (applicatorSelect) applicatorSelect.innerHTML = applicatorOptions(equipment, equipmentSelect.value);
    onEquipmentChanged?.();
  });
}
