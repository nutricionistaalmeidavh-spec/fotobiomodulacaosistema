const ALL_PERMISSIONS = Object.freeze([
  'patients.read', 'patients.write',
  'clinical.read', 'clinical.write',
  'agenda.read', 'agenda.write',
  'finance.read', 'finance.write',
  'protocols.read', 'protocols.write',
  'equipment.read', 'equipment.write',
  'audit.read', 'accounts.manage', 'backup.manage'
]);

const ROLE_PERMISSIONS = Object.freeze({
  admin: Object.freeze([...ALL_PERMISSIONS]),
  professional: Object.freeze([
    'patients.read', 'patients.write',
    'clinical.read', 'clinical.write',
    'agenda.read', 'agenda.write',
    'protocols.read', 'protocols.write',
    'equipment.read'
  ]),
  reception: Object.freeze([
    'patients.read', 'patients.write',
    'agenda.read', 'agenda.write',
    'finance.read', 'finance.write'
  ])
});

export function permissionsForRole(role) {
  return new Set(ROLE_PERMISSIONS[String(role || '').trim()] || []);
}

export function hasPermission(role, permission) {
  return permissionsForRole(role).has(permission);
}

export function assertPermission(role, permission) {
  if (!hasPermission(role, permission)) {
    const error = new Error('Acesso não autorizado para esta operação.');
    error.code = 'FORBIDDEN';
    throw error;
  }
}

export { ALL_PERMISSIONS, ROLE_PERMISSIONS };
