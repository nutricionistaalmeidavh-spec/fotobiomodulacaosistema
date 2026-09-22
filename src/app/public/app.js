import {
  PRIMARY_NAV_ITEMS,
  renderPrimaryNavigation,
  renderSecondaryNavigation,
  setMobileNavOpen
} from './ui/navigation.js';
import { escapeHtml } from './ui/primitives.js';
import { createF0Views } from './features/f0-views.js';

const state = {
  currentView: 'dashboard',
  status: null,
  patients: [],
  equipment: [],
  protocols: [],
  sessions: [],
  audit: { valid: true, events: [] },
  selectedProtocolId: null,
  mobileNavOpen: false
};

const view = document.querySelector('#view');
const flash = document.querySelector('#flash');
const primaryNav = document.querySelector('#primary-navigation');
const secondaryNav = document.querySelector('#secondary-navigation');
const mobileNavToggle = document.querySelector('[data-mobile-nav-toggle]');

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Falha HTTP ${response.status}`);
  return payload;
}

function showMessage(message, kind = 'warning') {
  flash.hidden = !message;
  flash.textContent = message || '';
  flash.dataset.kind = kind;
}

async function refreshAll() {
  const [status, patients, equipment, protocols, sessions, audit] = await Promise.all([
    api('/api/status'),
    api('/api/patients'),
    api('/api/equipment'),
    api('/api/protocols'),
    api('/api/sessions'),
    api('/api/audit')
  ]);
  state.status = status;
  state.patients = patients.patients;
  state.equipment = equipment.equipment;
  state.protocols = protocols.protocols;
  state.sessions = sessions.sessions;
  state.audit = audit;
  if (!state.selectedProtocolId || !state.protocols.some((item) => item.id === state.selectedProtocolId)) {
    state.selectedProtocolId = state.protocols[0]?.id ?? null;
  }
  document.querySelector('[data-phase-badge]').textContent = `${status.phase} concluída`;
}

function dashboardTemplate() {
  return `<div class="page-stack">
    <div class="page-heading"><div><span class="eyebrow">VISÃO GERAL</span><h1>Fundação clínica rastreável</h1><p>O núcleo F0 segue local e independente enquanto a experiência clínica evolui em paralelo.</p></div><span class="status-badge status-success">F0 concluída</span></div>
    <div class="grid cards">
      <article class="card"><span class="eyebrow">SCHEMA</span><div class="metric">${state.status.tableCount}</div><strong>19 tabelas</strong><p>Domínio clínico + controle versionado de migrations.</p></article>
      <article class="card"><span class="eyebrow">PROTOCOLOS</span><div class="metric">${state.protocols.length}</div><strong>Versionamento imutável</strong><p>Versões antigas permanecem preservadas e sem ação de edição.</p></article>
      <article class="card"><span class="eyebrow">SESSÕES</span><div class="metric">${state.sessions.length}</div><strong>Planejado ≠ aplicado</strong><p>Ajustes exigem justificativa profissional registrada.</p></article>
      <article class="card"><span class="eyebrow">AUDITORIA</span><div class="metric">${state.audit.events.length}</div><strong>Auditoria append-only</strong><p>${state.audit.valid ? 'Cadeia íntegra' : 'Integridade comprometida'} por hash encadeado.</p></article>
    </div>
    <section class="card"><div class="section-head"><div><span class="eyebrow">ESTADO ATUAL</span><h2>F0 concluída</h2></div><span class="status-badge ${state.audit.valid ? 'status-success' : 'status-warning'}">${state.audit.valid ? 'Cadeia íntegra' : 'Revisar auditoria'}</span></div>
      <p>A fundação continua operando com Node + SQLite. As próximas superfícies de paciente serão adicionadas por um provider de UI sem alterar o domínio F0.</p>
      <div class="module-note">Próximo marco clínico: paciente, anamnese, prontuário/atendimento e histórico completos.</div>
    </section>
  </div>`;
}

function patientsTemplate() {
  return `<div class="page-stack"><div class="page-heading"><div><span class="eyebrow">PACIENTES</span><h1>Pacientes</h1><p>A estrutura F0 abaixo permanece disponível até a nova superfície fixture-backed entrar nesta branch.</p></div><span class="status-badge status-info">Estrutura F0</span></div>
    <section class="card"><div class="table-wrap"><table><thead><tr><th>Paciente</th><th>Observação</th><th>ID</th></tr></thead><tbody>${state.patients.map((patient) => `<tr><td><strong>${escapeHtml(patient.fullName)}</strong></td><td>${escapeHtml(patient.notes || '—')}</td><td class="code">${escapeHtml(patient.id)}</td></tr>`).join('')}</tbody></table></div></section>
  </div>`;
}

const plannedCopy = Object.freeze({
  agenda: ['Agenda', 'Agenda clínica preparada para receber consultas e sessões sem acoplar o frontend ao backend incompleto.'],
  reports: ['Relatórios', 'Relatórios operacionais entrarão por contratos explícitos de dados, sem dependências externas obrigatórias.'],
  settings: ['Configurações', 'Preferências locais e adapters opcionais serão expostos aqui conforme as próximas fases.']
});

function plannedTemplate(route) {
  const [title, description] = plannedCopy[route] || ['Módulo', 'Superfície planejada.'];
  return `<div class="page-stack"><div class="page-heading"><div><span class="eyebrow">EM EVOLUÇÃO</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div><span class="status-badge status-neutral">Planejado</span></div>
    <section class="empty-state"><div class="empty-state-mark" aria-hidden="true">○</div><h2>${escapeHtml(title)}</h2><p>Esta área já faz parte da arquitetura de navegação e será aprofundada sem simular persistência que ainda não existe.</p></section>
  </div>`;
}

const f0Views = createF0Views({ state, api, showMessage, rerenderFresh });

function renderChrome() {
  primaryNav.innerHTML = renderPrimaryNavigation(state.currentView);
  secondaryNav.innerHTML = renderSecondaryNavigation(state.currentView);
  setMobileNavOpen(state.mobileNavOpen, mobileNavToggle, primaryNav);

  primaryNav.querySelectorAll('[data-nav]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.nav)));
  secondaryNav.querySelectorAll('[data-secondary-nav]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.secondaryNav)));
}

function render() {
  renderChrome();
  const templates = {
    dashboard: dashboardTemplate,
    patients: patientsTemplate,
    ...f0Views.templates,
    agenda: () => plannedTemplate('agenda'),
    reports: () => plannedTemplate('reports'),
    settings: () => plannedTemplate('settings')
  };
  const template = templates[state.currentView] || dashboardTemplate;
  view.innerHTML = template();
  f0Views.bindActions(view);
}

async function rerenderFresh(message = '') {
  await refreshAll();
  if (message) showMessage(message, 'success');
  render();
}

async function navigate(route) {
  const knownPrimary = PRIMARY_NAV_ITEMS.some((item) => item.id === route);
  const knownSecondary = ['sessions', 'audit'].includes(route);
  if (!knownPrimary && !knownSecondary) return;
  state.currentView = route;
  state.mobileNavOpen = false;
  showMessage('');
  await refreshAll();
  render();
}

mobileNavToggle.addEventListener('click', () => {
  state.mobileNavOpen = !state.mobileNavOpen;
  setMobileNavOpen(state.mobileNavOpen, mobileNavToggle, primaryNav);
});

view.addEventListener('pbm:rerender', render);

try {
  await refreshAll();
  render();
  document.body.dataset.appReady = 'true';
} catch (error) {
  showMessage(`Falha ao inicializar: ${error.message}`);
}
