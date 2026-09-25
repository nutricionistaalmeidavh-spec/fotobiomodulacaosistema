import {
  canAccessRoute,
  renderPrimaryNavigation,
  renderSecondaryNavigation,
  setMobileNavOpen
} from './ui/navigation.js';
import { createF0ApiAdapter } from './data/adapters/f0-api-adapter.js';
import { createClinicalApiAdapter } from './data/adapters/clinical-api-adapter.js';
import { createOperationsApiAdapter } from './data/adapters/operations-api-adapter.js';
import { createAdminApiAdapter } from './data/adapters/admin-api-adapter.js';
import { createAuthApiAdapter } from './data/adapters/auth-api-adapter.js';
import { createClinicalDataGateway } from './data/clinical-data-gateway.js';
import { createAuthView } from './features/auth.js';
import { createDashboardView } from './features/dashboard.js';
import { createPatientsView } from './features/patients.js';
import { createPatientWorkspaceView } from './features/patient-workspace.js';
import { createAgendaView } from './features/agenda.js';
import { createReportsView } from './features/reports.js';
import { createAuditView } from './features/audit.js';
import { createPlannedRoutesView } from './features/planned-routes.js';
import { createF0Views } from './features/f0-views.js';

const state = {
  user: null,
  currentView: 'dashboard',
  status: null,
  equipment: [],
  protocols: [],
  sessions: [],
  audit: { valid: true, events: [] },
  selectedProtocolId: null,
  mobileNavOpen: false
};

const authRoot = document.querySelector('#auth-root');
const appShell = document.querySelector('#app-shell');
const view = document.querySelector('#view');
const flash = document.querySelector('#flash');
const primaryNav = document.querySelector('#primary-navigation');
const secondaryNav = document.querySelector('#secondary-navigation');
const mobileNavToggle = document.querySelector('[data-mobile-nav-toggle]');
const authUser = document.querySelector('[data-auth-user]');
const logoutButton = document.querySelector('[data-logout]');

const gateway = createClinicalDataGateway({
  f0Adapter: createF0ApiAdapter(),
  clinicalAdapter: createClinicalApiAdapter(),
  operationsAdapter: createOperationsApiAdapter(),
  authAdapter: createAuthApiAdapter(),
  adminAdapter: createAdminApiAdapter()
});

function showMessage(message, kind = 'warning') {
  if (!flash) return;
  flash.hidden = !message;
  flash.textContent = message || '';
  flash.dataset.kind = kind;
}

function role() {
  return state.user?.role || '';
}

async function loadFoundationStatus() {
  state.status = await gateway.getFoundationStatus();
  const badge = document.querySelector('[data-phase-badge]');
  if (badge) badge.textContent = `${state.status.phase} concluída`;
}

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
  onMessage: showMessage,
  canOpenPatient: () => canAccessRoute(role(), 'patient-workspace')
});
const patientWorkspaceView = createPatientWorkspaceView({
  gateway,
  onBack: () => navigate('patients'),
  onChanged: render,
  onMessage: showMessage
});
const agendaView = createAgendaView({
  gateway,
  onOpenPatient: openPatient,
  onChanged: render,
  onMessage: showMessage
});
const reportsView = createReportsView({ gateway, onChanged: render, onMessage: showMessage });
const auditView = createAuditView({ gateway, onChanged: render, onMessage: showMessage });
const f0Views = createF0Views({ state, gateway, showMessage, rerenderFresh });

async function loadRouteData(route) {
  await loadFoundationStatus();
  if (route === 'dashboard') return dashboardView.load();
  if (route === 'patients') return patientsView.load();
  if (route === 'agenda') return agendaView.load();
  if (route === 'reports') return reportsView.load();
  if (route === 'audit') return auditView.load();
  if (route === 'protocols') {
    state.protocols = await gateway.listProtocols();
    if (!state.selectedProtocolId || !state.protocols.some((item) => item.id === state.selectedProtocolId)) {
      state.selectedProtocolId = state.protocols[0]?.id ?? null;
    }
    return;
  }
  if (route === 'equipment') {
    state.equipment = await gateway.listEquipment();
    return;
  }
  if (route === 'sessions') {
    [state.protocols, state.sessions] = await Promise.all([
      gateway.listProtocols(),
      gateway.listSessions()
    ]);
    if (!state.selectedProtocolId || !state.protocols.some((item) => item.id === state.selectedProtocolId)) {
      state.selectedProtocolId = state.protocols[0]?.id ?? null;
    }
  }
}

async function openPatient(patientId) {
  showMessage('');
  if (!canAccessRoute(role(), 'patient-workspace')) {
    showMessage('Seu perfil pode acessar o cadastro administrativo, mas não o prontuário clínico.');
    return;
  }
  try {
    await patientWorkspaceView.setPatient(patientId);
    state.currentView = 'patient-workspace';
    state.mobileNavOpen = false;
    render();
  } catch (error) {
    await handleRuntimeError(error);
  }
}

function renderChrome() {
  const activePrimaryRoute = state.currentView === 'patient-workspace' ? 'patients' : state.currentView;
  primaryNav.innerHTML = renderPrimaryNavigation(activePrimaryRoute, role());
  secondaryNav.innerHTML = renderSecondaryNavigation(state.currentView, role());
  setMobileNavOpen(state.mobileNavOpen, mobileNavToggle, primaryNav);
  authUser.textContent = state.user ? `${state.user.name} · ${state.user.role}` : '';

  primaryNav.querySelectorAll('[data-nav]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.nav)));
  secondaryNav.querySelectorAll('[data-secondary-nav]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.secondaryNav)));
}

function render() {
  if (!state.user) return;
  renderChrome();
  const templates = {
    dashboard: dashboardView.render,
    patients: patientsView.render,
    'patient-workspace': patientWorkspaceView.render,
    ...f0Views.templates,
    agenda: agendaView.render,
    reports: reportsView.render,
    audit: auditView.render,
    settings: () => plannedRoutesView.render('settings')
  };
  const template = templates[state.currentView] || dashboardView.render;
  view.innerHTML = template();
  dashboardView.bindActions(view);
  patientsView.bindActions(view);
  patientWorkspaceView.bindActions(view);
  agendaView.bindActions(view);
  reportsView.bindActions(view);
  auditView.bindActions(view);
  f0Views.bindActions(view);
}

async function rerenderFresh(message = '') {
  try {
    await loadRouteData(state.currentView);
    if (message) showMessage(message, 'success');
    render();
  } catch (error) {
    await handleRuntimeError(error);
  }
}

async function navigate(route) {
  if (!state.user || !canAccessRoute(role(), route)) {
    if (state.user) showMessage('Acesso não autorizado para este módulo.');
    return;
  }
  state.currentView = route;
  state.mobileNavOpen = false;
  showMessage('');
  try {
    await loadRouteData(route);
    render();
  } catch (error) {
    await handleRuntimeError(error);
  }
}

async function enterApp(user) {
  state.user = user;
  if (!canAccessRoute(role(), state.currentView)) state.currentView = 'dashboard';
  authRoot.hidden = true;
  authRoot.innerHTML = '';
  appShell.hidden = false;
  showMessage('');
  await loadRouteData(state.currentView);
  render();
  document.body.dataset.appReady = 'true';
}

const authView = createAuthView({
  gateway,
  onAuthenticated: enterApp,
  onMessage: () => {}
});

async function showAuth() {
  state.user = null;
  state.currentView = 'dashboard';
  delete document.body.dataset.appReady;
  appShell.hidden = true;
  authRoot.hidden = false;
  const status = await authView.load();
  if (status.authenticated && status.user) return enterApp(status.user);
  authRoot.innerHTML = authView.render();
  authView.bindActions(authRoot);
}

async function handleRuntimeError(error) {
  if (error?.status === 401) {
    await showAuth();
    return;
  }
  if (error?.status === 403) {
    showMessage('Acesso não autorizado para esta operação.');
    return;
  }
  showMessage(error?.message || 'Falha inesperada.');
}

mobileNavToggle.addEventListener('click', () => {
  state.mobileNavOpen = !state.mobileNavOpen;
  setMobileNavOpen(state.mobileNavOpen, mobileNavToggle, primaryNav);
});

logoutButton.addEventListener('click', async () => {
  try { await gateway.logout(); } finally { await showAuth(); }
});

view.addEventListener('pbm:rerender', render);

try {
  await showAuth();
} catch (error) {
  authRoot.hidden = false;
  authRoot.innerHTML = `<section class="card"><h1>Falha ao inicializar</h1><p>${String(error?.message || 'Erro inesperado')}</p></section>`;
}
