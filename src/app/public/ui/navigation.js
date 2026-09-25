const UI_ROLE_PERMISSIONS = Object.freeze({
  admin: Object.freeze([
    'patients.read', 'patients.write', 'clinical.read', 'clinical.write',
    'agenda.read', 'agenda.write', 'finance.read', 'finance.write',
    'protocols.read', 'protocols.write', 'equipment.read', 'equipment.write',
    'audit.read', 'accounts.manage', 'backup.manage'
  ]),
  professional: Object.freeze([
    'patients.read', 'patients.write', 'clinical.read', 'clinical.write',
    'agenda.read', 'agenda.write', 'protocols.read', 'protocols.write', 'equipment.read'
  ]),
  reception: Object.freeze([
    'patients.read', 'patients.write', 'agenda.read', 'agenda.write', 'finance.read', 'finance.write'
  ])
});

export const PRIMARY_NAV_ITEMS = Object.freeze([
  { id: 'dashboard', label: 'Dashboard', icon: 'grid', permission: null },
  { id: 'patients', label: 'Pacientes', icon: 'users', permission: 'patients.read' },
  { id: 'agenda', label: 'Agenda', icon: 'calendar', permission: 'agenda.read' },
  { id: 'protocols', label: 'Protocolos', icon: 'library', permission: 'protocols.read' },
  { id: 'equipment', label: 'Equipamentos', icon: 'device', permission: 'equipment.read' },
  { id: 'reports', label: 'Relatórios', icon: 'report', permission: 'finance.read' },
  { id: 'settings', label: 'Configurações', icon: 'settings', permission: 'accounts.manage' }
]);

export const SECONDARY_NAV_ITEMS = Object.freeze([
  { id: 'sessions', label: 'Sessões', permission: 'clinical.read' },
  { id: 'audit', label: 'Auditoria', permission: 'audit.read' }
]);

const ROUTE_PERMISSIONS = Object.freeze({
  dashboard: null,
  patients: 'patients.read',
  'patient-workspace': 'clinical.read',
  agenda: 'agenda.read',
  protocols: 'protocols.read',
  equipment: 'equipment.read',
  reports: 'finance.read',
  settings: 'accounts.manage',
  sessions: 'clinical.read',
  audit: 'audit.read'
});

export function hasUiPermission(role, permission) {
  if (!permission) return Boolean(role);
  return (UI_ROLE_PERMISSIONS[String(role || '')] || []).includes(permission);
}

export function canAccessRoute(role, route) {
  if (!Object.hasOwn(ROUTE_PERMISSIONS, route)) return false;
  return hasUiPermission(role, ROUTE_PERMISSIONS[route]);
}

export function visiblePrimaryNavigation(role = 'admin') {
  return PRIMARY_NAV_ITEMS.filter((item) => hasUiPermission(role, item.permission));
}

export function visibleSecondaryNavigation(role = 'admin') {
  return SECONDARY_NAV_ITEMS.filter((item) => hasUiPermission(role, item.permission));
}

function iconMarkup(icon) {
  const paths = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
    library: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5z"/><path d="M8 7h8M8 11h6"/>',
    device: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 22h8M12 18v4"/>',
    report: '<path d="M4 19V9M10 19V5M16 19v-7M22 19V3"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.1A1.7 1.7 0 0 0 8 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 3.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H2V9.6h.1A1.7 1.7 0 0 0 3.6 8a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 8 3.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V2h4v.1A1.7 1.7 0 0 0 15 3.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 8c.16.39.4.73.7 1 .3.27.69.4 1.1.4h.1v4h-.1c-.41 0-.8.13-1.1.4-.3.27-.54.61-.7 1.2z"/>'
  };
  const body = paths[icon] ?? paths.grid;
  return `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

export function renderPrimaryNavigation(activeRoute = 'dashboard', role = 'admin') {
  return visiblePrimaryNavigation(role).map((item) => `
    <button type="button" data-nav="${item.id}" ${activeRoute === item.id ? 'class="is-active" aria-current="page"' : ''}>
      ${iconMarkup(item.icon)}<span class="nav-label">${item.label}</span>
    </button>`).join('');
}

export function renderSecondaryNavigation(activeRoute = '', role = 'admin') {
  return visibleSecondaryNavigation(role).map((item) => `
    <button type="button" data-secondary-nav="${item.id}" ${activeRoute === item.id ? 'class="is-active" aria-current="page"' : ''}>${item.label}</button>`).join('');
}

export function setMobileNavOpen(open, toggle, navigation) {
  const isOpen = Boolean(open);
  if (toggle) toggle.setAttribute('aria-expanded', String(isOpen));
  if (navigation) navigation.dataset.open = String(isOpen);
  return isOpen;
}
