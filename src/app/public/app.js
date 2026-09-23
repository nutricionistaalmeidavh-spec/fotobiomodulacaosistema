import {
  PRIMARY_NAV_ITEMS,
  renderPrimaryNavigation,
  renderSecondaryNavigation,
  setMobileNavOpen
} from './ui/navigation.js';
import { UI_FIXTURES } from './data/fixtures.js';
import { createF0ApiAdapter } from './data/adapters/f0-api-adapter.js';
import { createLocalClinicalAdapter } from './data/adapters/local-clinical-adapter.js';
import { createClinicalDataGateway } from './data/clinical-data-gateway.js';
import { createDashboardView } from './features/dashboard.js';
import { createPatientsView } from './features/patients.js';
import { createPatientWorkspaceView } from './features/patient-workspace.js';
import { createPlannedRoutesView } from './features/planned-routes.js';
import { createF0Views } from './features/f0-views.js';

const state = {
  currentView: 'dashboard',
  status: null,
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

const gateway = createClinicalDataGateway({
  f0Adapter: createF0ApiAdapter(),
  localAdapter: createLocalClinicalAdapter(UI_FIXTURES)
});

function showMessage(message, kind = 'warning') {
  flash.hidden = !message;
  flash.textContent = message || '';
  flash.dataset.kind = kind;
}

async function refreshAll() {
  const [status, equipment, protocols, sessions, audit] = await Promise.all([
    gateway.getFoundationStatus(),
    gateway.listEquipment(),
    gateway.listProtocols(),
    gateway.listSessions(),
    gateway.getAuditState()
  ]);
  state.status = status;
  state.equipment = equipment;
  state.protocols = protocols;
  state.sessions = sessions;
  state.audit = audit;
  if (!state.selectedProtocolId || !state.protocols.some((item) => item.id === state.selectedProtocolId)) {
    state.selectedProtocolId = state.protocols[0]?.id ?? null;
  }
  document.querySelector('[data-phase-badge]').textContent = `${status.phase} concluída`;
}

const f0Views = createF0Views({ state, gateway, showMessage, rerenderFresh });
const plannedRoutesView = createPlannedRoutesView();
const dashboardView = createDashboardView({
  gateway,
  onNavigate: navigate,
  getFoundation: () => ({
    tableCount: state.status?.tableCount ?? 19,
    protocolCount: state.protocols.length,
    sessionCount: state.sessions.length,
    auditValid: state.audit.valid
  })
});
const patientsView = createPatientsView({
  gateway,
  onOpenPatient: openPatient,
  onChanged: render,
  onMessage: showMessage
});
const patientWorkspaceView = createPatientWorkspaceView({
  gateway,
  onBack: () => navigate('patients'),
  onChanged: render,
  onMessage: showMessage
});

async function openPatient(patientId) {
  showMessage('');
  try {
    await patientWorkspaceView.setPatient(patientId);
    state.currentView = 'patient-workspace';
    state.mobileNavOpen = false;
    render();
  } catch (error) {
    showMessage(error.message);
  }
}

async function loadRoute(route) {
  if (route === 'dashboard') await dashboardView.load();
  if (route === 'patients') await patientsView.load();
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
  try {
    await refreshAll();
    await loadRoute(route);
    render();
  } catch (error) {
    showMessage(error.message);
  }
}

mobileNavToggle.addEventListener('click', () => {
  state.mobileNavOpen = !state.mobileNavOpen;
  setMobileNavOpen(state.mobileNavOpen, mobileNavToggle, primaryNav);
});

view.addEventListener('pbm:rerender', render);

try {
  await refreshAll();
  await loadRoute('dashboard');
  render();
  document.body.dataset.appReady = 'true';
} catch (error) {
  showMessage(`Falha ao inicializar: ${error.message}`);
}
