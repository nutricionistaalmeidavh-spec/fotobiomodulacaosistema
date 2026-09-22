import {
  PRIMARY_NAV_ITEMS,
  renderPrimaryNavigation,
  renderSecondaryNavigation,
  setMobileNavOpen
} from './ui/navigation.js';
import { createMockUiProvider } from './data/mock-provider.js';
import { createDashboardView } from './features/dashboard.js';
import { createPatientsView } from './features/patients.js';
import { createPatientWorkspaceView } from './features/patient-workspace.js';
import { createPlannedRoutesView } from './features/planned-routes.js';
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
const uiProvider = createMockUiProvider();

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

const f0Views = createF0Views({ state, api, showMessage, rerenderFresh });
const plannedRoutesView = createPlannedRoutesView();
const dashboardView = createDashboardView({
  provider: uiProvider,
  onNavigate: navigate,
  getFoundation: () => ({
    tableCount: state.status?.tableCount ?? 19,
    protocolCount: state.protocols.length,
    sessionCount: state.sessions.length,
    auditValid: state.audit.valid
  })
});
const patientsView = createPatientsView({
  provider: uiProvider,
  onOpenPatient: openPatient,
  onChanged: render,
  onMessage: showMessage
});
const patientWorkspaceView = createPatientWorkspaceView({
  provider: uiProvider,
  onBack: () => navigate('patients'),
  onChanged: render,
  onMessage: showMessage
});

function openPatient(patientId) {
  patientWorkspaceView.setPatient(patientId);
  state.currentView = 'patient-workspace';
  state.mobileNavOpen = false;
  showMessage('');
  render();
}

function renderChrome() {
  const activePrimaryRoute = state.currentView === 'patient-workspace' ? 'patients' : state.currentView;
  primaryNav.innerHTML = renderPrimaryNavigation(activePrimaryRoute);
  secondaryNav.innerHTML = renderSecondaryNavigation(state.currentView);
  setMobileNavOpen(state.mobileNavOpen, mobileNavToggle, primaryNav);

  primaryNav.querySelectorAll('[data-nav]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.nav)));
  secondaryNav.querySelectorAll('[data-secondary-nav]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.secondaryNav)));
}

function render() {
  renderChrome();
  const templates = {
    dashboard: dashboardView.render,
    patients: patientsView.render,
    'patient-workspace': patientWorkspaceView.render,
    ...f0Views.templates,
    agenda: () => plannedRoutesView.render('agenda'),
    reports: () => plannedRoutesView.render('reports'),
    settings: () => plannedRoutesView.render('settings')
  };
  const template = templates[state.currentView] || dashboardView.render;
  view.innerHTML = template();
  dashboardView.bindActions(view);
  patientsView.bindActions(view);
  patientWorkspaceView.bindActions(view);
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
