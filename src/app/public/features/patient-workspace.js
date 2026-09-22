import { assertUiProvider } from '../data/contracts.js';
import { emptyState, escapeHtml, statusBadge } from '../ui/primitives.js';

export const WORKSPACE_TABS = Object.freeze([
  { id: 'summary', label: 'Resumo' },
  { id: 'anamnesis', label: 'Anamnese' },
  { id: 'protocols', label: 'Protocolos' },
  { id: 'sessions', label: 'Sessões' },
  { id: 'evolution', label: 'Evolução' },
  { id: 'photos', label: 'Fotos' },
  { id: 'documents', label: 'Documentos' },
  { id: 'consents', label: 'Consentimentos' }
]);

export function createPatientWorkspaceView({ provider, onBack, onChanged }) {
  assertUiProvider(provider);
  const local = { patientId: null, activeTab: 'summary' };

  function setPatient(patientId) {
    local.patientId = patientId;
    local.activeTab = 'summary';
  }

  function renderTimeline(patient) {
    if (!patient.timeline?.length) {
      return emptyState({ title: 'Sem evolução registrada', description: 'A timeline será preenchida conforme atendimentos e eventos clínicos forem registrados.' });
    }
    return `<div class="workspace-timeline">${patient.timeline.map((item, index) => `<article class="workspace-timeline-item">
      <span class="timeline-dot" aria-hidden="true"></span>
      <div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.description || '')}</p></div>
      <time>${escapeHtml(item.meta || '')}</time>
      ${index === patient.timeline.length - 1 ? '' : '<span class="timeline-line" aria-hidden="true"></span>'}
    </article>`).join('')}</div>`;
  }

  function summary(patient) {
    const alerts = patient.alerts?.length
      ? `<div class="clinical-alerts">${patient.alerts.map((alert) => `<div class="clinical-alert" role="alert"><strong>Atenção clínica</strong><p>${escapeHtml(alert)}</p></div>`).join('')}</div>`
      : '';
    const pending = patient.pendingItems?.length
      ? `<ul class="pending-list">${patient.pendingItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
      : '<p class="muted">Sem pendências clínicas no fixture atual.</p>';

    return `<div class="workspace-panel-grid">
      <section class="workspace-main-column">
        ${alerts}
        <div class="grid workspace-session-grid">
          <article class="card compact-card"><span class="eyebrow">ÚLTIMA SESSÃO</span><strong>${escapeHtml(patient.lastSession || 'Nenhuma sessão registrada')}</strong></article>
          <article class="card compact-card"><span class="eyebrow">PRÓXIMA SESSÃO</span><strong>${escapeHtml(patient.nextSession || 'Sem retorno agendado')}</strong></article>
          <article class="card compact-card"><span class="eyebrow">PROTOCOLO ATUAL</span><strong>${escapeHtml(patient.currentProtocol || 'Sem protocolo associado')}</strong></article>
        </div>
        <section class="card"><div class="section-head"><div><span class="eyebrow">EVOLUÇÃO</span><h2>Visão geral clínica</h2></div></div>${renderTimeline(patient)}</section>
      </section>
      <aside class="workspace-side-column">
        <section class="card"><span class="eyebrow">PENDÊNCIAS</span><h2>Acompanhar</h2>${pending}</section>
        <section class="card patient-facts"><span class="eyebrow">IDENTIFICAÇÃO</span><dl><div><dt>E-mail</dt><dd>${escapeHtml(patient.email || '—')}</dd></div><div><dt>Telefone</dt><dd>${escapeHtml(patient.phone || '—')}</dd></div><div><dt>Nascimento</dt><dd>${escapeHtml(patient.birthDate || '—')}</dd></div></dl></section>
      </aside>
    </div>`;
  }

  function anamnesis(patient) {
    return `<section class="card workspace-detail-card"><span class="eyebrow">ANAMNESE</span><h2>Anamnese clínica</h2><p>Superfície preparada para histórico, queixa principal, objetivo do atendimento e critérios de segurança. Os dados persistidos entram na F1; aqui há apenas contexto visual.</p><div class="module-note">Paciente em contexto: ${escapeHtml(patient.fullName)}. Nenhum dado clínico novo é gravado por esta tela nesta etapa.</div></section>`;
  }

  function protocols(patient) {
    return `<section class="card workspace-detail-card"><span class="eyebrow">PROTOCOLOS</span><h2>Protocolo em uso</h2><div class="workspace-feature-value">${escapeHtml(patient.currentProtocol || 'Sem protocolo associado')}</div><p>O vínculo final será feito por versão imutável do protocolo no backend clínico, preservando o histórico.</p></section>`;
  }

  function sessions(patient) {
    return `<div class="grid workspace-session-grid"><section class="card workspace-detail-card"><span class="eyebrow">SESSÕES</span><h2>Sessões do paciente</h2><p>Última registrada no fixture:</p><div class="workspace-feature-value">${escapeHtml(patient.lastSession || 'Nenhuma')}</div></section><section class="card workspace-detail-card"><span class="eyebrow">RETORNO</span><h2>Próximo atendimento</h2><div class="workspace-feature-value">${escapeHtml(patient.nextSession || 'Sem retorno agendado')}</div><p>Planejamento e aplicação continuarão separados quando esta tela for ligada aos contratos reais.</p></section></div>`;
  }

  function evolution(patient) {
    return `<section class="card workspace-detail-card"><span class="eyebrow">EVOLUÇÃO</span><h2>Evolução longitudinal</h2><p>Linha do tempo clínica preparada para reunir sessões, avaliações e eventos persistidos.</p>${renderTimeline(patient)}</section>`;
  }

  function photos() {
    return emptyState({ title: 'Nenhuma foto registrada', description: 'Fotos clínicas poderão ser organizadas por sessão e data quando a camada de persistência correspondente estiver disponível.' });
  }

  function documents() {
    return emptyState({ title: 'Nenhum documento registrado', description: 'Documentos do paciente aparecerão aqui com metadados e vínculo clínico quando a F1 correspondente for implementada.' });
  }

  function consents() {
    return emptyState({ title: 'Nenhum consentimento registrado', description: 'Termos e consentimentos serão apresentados com status e histórico sem simular aceite ou assinatura nesta etapa.' });
  }

  function activePanel(patient) {
    const panels = { summary, anamnesis, protocols, sessions, evolution, photos, documents, consents };
    return (panels[local.activeTab] || summary)(patient);
  }

  function render() {
    const patient = local.patientId ? provider.getPatient(local.patientId) : null;
    if (!patient) {
      return emptyState({ title: 'Paciente não encontrado', description: 'Volte à lista de pacientes e selecione um registro disponível.' });
    }
    return `<div class="page-stack patient-workspace" data-patient-workspace>
      <button type="button" class="ghost workspace-back" data-workspace-back>← Voltar para pacientes</button>
      <header class="patient-context-header">
        <div class="patient-avatar" aria-hidden="true">${escapeHtml(patient.fullName.slice(0, 2).toUpperCase())}</div>
        <div class="patient-context-copy"><span class="eyebrow">PACIENTE EM CONTEXTO</span><h1>${escapeHtml(patient.fullName)}</h1><div class="patient-context-meta"><span>${escapeHtml(patient.email || 'Sem e-mail')}</span><span>${escapeHtml(patient.phone || 'Sem telefone')}</span>${statusBadge(patient.status === 'active' ? 'Ativo' : 'Inativo', patient.status === 'active' ? 'success' : 'neutral')}</div></div>
      </header>
      <nav class="workspace-tabs" role="tablist" aria-label="Navegação do paciente">${WORKSPACE_TABS.map((tab) => `<button type="button" role="tab" id="workspace-tab-${tab.id}" aria-controls="workspace-panel" aria-selected="${local.activeTab === tab.id ? 'true' : 'false'}" tabindex="${local.activeTab === tab.id ? '0' : '-1'}" data-workspace-tab="${tab.id}" ${local.activeTab === tab.id ? 'class="is-active"' : ''}>${escapeHtml(tab.label)}</button>`).join('')}</nav>
      <section id="workspace-panel" class="workspace-panel" role="tabpanel" aria-labelledby="workspace-tab-${local.activeTab}" tabindex="0">${activePanel(patient)}</section>
    </div>`;
  }

  function bindActions(root = document) {
    root.querySelector('[data-workspace-back]')?.addEventListener('click', () => onBack?.());
    root.querySelectorAll('[data-workspace-tab]').forEach((button) => button.addEventListener('click', () => {
      local.activeTab = button.dataset.workspaceTab;
      onChanged?.();
    }));
  }

  return { render, bindActions, setPatient };
}
