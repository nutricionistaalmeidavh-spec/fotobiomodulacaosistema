const nativeFetch = window.fetch.bind(window);
let effectiveRole = null;

function jsonResponse(payload) {
  return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

function pathOf(input) {
  try {
    const raw = typeof input === 'string' ? input : input?.url;
    return new URL(raw, window.location.href).pathname;
  } catch { return ''; }
}

function rememberUser(payload) {
  const role = payload?.user?.role;
  if (role) {
    effectiveRole = role;
    window.__pbmEffectiveRole = role;
    queueMicrotask(applyRoleToDom);
  }
}

window.fetch = async function roleAwareFetch(input, init = {}) {
  const pathname = pathOf(input);
  const method = String(init?.method || 'GET').toUpperCase();

  if (method === 'GET' && effectiveRole === 'professional' && pathname === '/api/audit') {
    return jsonResponse({ valid: true, events: [] });
  }

  if (method === 'GET' && effectiveRole === 'reception') {
    if (pathname === '/api/equipment') return jsonResponse({ equipment: [] });
    if (pathname === '/api/protocols') return jsonResponse({ protocols: [] });
    if (pathname === '/api/sessions') return jsonResponse({ sessions: [] });
    if (pathname === '/api/encounters/open') return jsonResponse({ encounters: [] });
    if (pathname === '/api/audit') return jsonResponse({ valid: true, events: [] });

    const workspace = pathname.match(/^\/api\/patients\/([^/]+)\/workspace$/);
    if (workspace) {
      const response = await nativeFetch('/api/patients');
      if (!response.ok) return response;
      const payload = await response.json();
      const patientId = decodeURIComponent(workspace[1]);
      const patient = (payload.patients || []).find((item) => item.id === patientId);
      if (!patient) return new Response(JSON.stringify({ error: 'Paciente não encontrado.' }), { status: 404, headers: { 'content-type': 'application/json' } });
      return jsonResponse({ patient, encounters: [], assessments: [], sessions: [], outcomes: [], timeline: [] });
    }
  }

  const response = await nativeFetch(input, init);
  if (response.ok && ['/api/auth/status', '/api/auth/login', '/api/auth/setup'].includes(pathname)) {
    try { rememberUser(await response.clone().json()); } catch {}
  }
  return response;
};

function setNavVisibility(name, visible) {
  const button = document.querySelector(`[data-nav="${name}"]`);
  if (button) button.hidden = !visible;
}

function applyRoleToDom() {
  if (!effectiveRole) return;
  const admin = effectiveRole === 'admin';
  const professional = effectiveRole === 'professional';
  const reception = effectiveRole === 'reception';

  setNavVisibility('admin', admin);
  setNavVisibility('protocols', !reception);
  setNavVisibility('equipment', !reception);
  setNavVisibility('sessions', !reception);
  setNavVisibility('audit', admin);
  setNavVisibility('agenda', true);
  setNavVisibility('finance', admin || reception);
  setNavVisibility('reports', admin || reception);

  if (!admin) document.querySelector('.dashboard-audit')?.remove();

  if (professional) {
    document.querySelector('[data-create-equipment-f3]')?.remove();
    document.querySelector('[data-create-applicator-f3]')?.remove();
  }

  if (reception) {
    const workspace = document.querySelector('[data-patient-workspace]');
    if (workspace) {
      const sections = Array.from(workspace.querySelectorAll(':scope > section'));
      sections.slice(1).forEach((section) => section.remove());
    }
    for (const selector of ['[data-f4-clinical-tools]', '[data-f5-evolution]', '[data-f7-body-map]', '[data-f8-engine]']) {
      document.querySelectorAll(selector).forEach((node) => node.remove());
    }
  }
}

new MutationObserver(applyRoleToDom).observe(document.documentElement, { childList: true, subtree: true });
