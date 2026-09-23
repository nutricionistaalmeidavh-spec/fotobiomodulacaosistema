const view = document.querySelector('#view');
const upstreamFetch = window.fetch.bind(window);
let currentPatientId = null;
let catalog = [];
let selectedRegion = null;
let selectedCoordinates = null;
let mountScheduled = false;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function api(url, options = {}) {
  const response = await upstreamFetch(url, {
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Falha no mapa corporal.');
  return payload;
}

function section() {
  return view?.querySelector('[data-f7-body-map]');
}

function currentView() {
  return section()?.querySelector('[name="f7-view"]')?.value || 'posterior';
}

function availableRegions(bodyView) {
  return catalog.filter((item) => item.views?.includes(bodyView) && Array.isArray(item.centers?.[bodyView]));
}

function renderMap() {
  const root = section();
  const svg = root?.querySelector('[data-f7-map-svg]');
  if (!svg) return;
  const bodyView = currentView();
  const regions = availableRegions(bodyView);

  svg.innerHTML = `
    <g class="f7-silhouette" aria-hidden="true">
      <circle cx="150" cy="50" r="28"></circle>
      <path d="M150 80 C115 95 102 145 106 220 L115 355 L98 505 M150 80 C185 95 198 145 194 220 L185 355 L202 505 M116 150 L67 300 M184 150 L233 300 M116 355 L122 500 M184 355 L178 500"></path>
    </g>
    ${regions.map((item) => {
      const [x, y] = item.centers[bodyView];
      const cx = Math.round(x * 300);
      const cy = Math.round(y * 520);
      const active = selectedRegion?.id === item.id;
      return `<circle class="f7-region" data-body-region-id="${escapeHtml(item.id)}" data-x="${x}" data-y="${y}" cx="${cx}" cy="${cy}" r="17" tabindex="0" role="button" aria-label="${escapeHtml(item.label)}" aria-pressed="${active}"></circle>`;
    }).join('')}
    ${selectedCoordinates && selectedRegion?.views.includes(bodyView)
      ? `<circle class="f7-marker" data-f7-marker cx="${Math.round(selectedCoordinates.x * 300)}" cy="${Math.round(selectedCoordinates.y * 520)}" r="7"></circle>`
      : ''}
  `;

  for (const target of svg.querySelectorAll('[data-body-region-id]')) {
    const select = () => selectRegion(target.dataset.bodyRegionId, Number(target.dataset.x), Number(target.dataset.y));
    target.addEventListener('click', select);
    target.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        select();
      }
    });
  }
}

function selectRegion(regionId, x, y) {
  const root = section();
  const region = catalog.find((item) => item.id === regionId);
  if (!root || !region) return;
  selectedRegion = region;
  selectedCoordinates = { x, y };
  root.querySelector('[name="f7-label"]').value = region.label;
  root.querySelector('[data-f7-selection]').textContent = `${region.label} · ${currentView()} · x ${x.toFixed(2)} · y ${y.toFixed(2)}`;
  renderMap();
}

function renderPoints(points) {
  const root = section();
  if (!root) return;
  const list = root.querySelector('[data-f7-points-list]');
  list.innerHTML = points.length ? points.map((point) => `
    <article class="f7-point-item" data-f7-point-item>
      <strong>${escapeHtml(point.anatomicalLabel || point.bodyRegion || 'Ponto anatômico')}</strong>
      <span>${escapeHtml(point.bodyRegion || '')} · ${escapeHtml(point.coordinates?.view || '')} · ${escapeHtml(point.coordinates?.laterality || '')}</span>
      <small>Sessão ${escapeHtml(point.treatmentSessionId)} · sequência ${escapeHtml(point.sequenceNumber)} · x ${escapeHtml(point.coordinates?.x)} · y ${escapeHtml(point.coordinates?.y)}</small>
    </article>
  `).join('') : '<p class="empty-state">Nenhum ponto de mapa corporal registrado.</p>';
  const sequence = root.querySelector('[name="f7-sequence"]');
  if (sequence && !sequence.dataset.edited) sequence.value = String(points.length + 1);
}

async function refreshPoints() {
  if (!currentPatientId) return;
  const patientId = currentPatientId;
  const payload = await api(`/api/patients/${encodeURIComponent(patientId)}/body-map-points`);
  if (patientId !== currentPatientId) return;
  renderPoints(payload.points || []);
}

async function refreshSessions() {
  if (!currentPatientId) return;
  const patientId = currentPatientId;
  const workspace = await api(`/api/patients/${encodeURIComponent(patientId)}/workspace`);
  if (patientId !== currentPatientId) return;
  const select = section()?.querySelector('[name="f7-session"]');
  if (!select) return;
  const sessions = workspace.sessions || [];
  select.innerHTML = sessions.length
    ? sessions.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.id)} · ${escapeHtml(item.startedAt || 'sessão')}</option>`).join('')
    : '<option value="">Nenhuma sessão registrada</option>';
}

async function ensureCatalog() {
  if (catalog.length) return catalog;
  const payload = await api('/api/body-map/catalog');
  catalog = payload.regions || [];
  return catalog;
}

async function recordPoint() {
  const root = section();
  if (!root || !currentPatientId) return;
  const feedback = root.querySelector('[data-f7-feedback]');
  const button = root.querySelector('[data-record-body-map-f7]');
  const sessionId = root.querySelector('[name="f7-session"]').value;
  if (!sessionId) {
    feedback.textContent = 'Registre uma sessão clínica antes de adicionar um ponto anatômico.';
    return;
  }
  if (!selectedRegion || !selectedCoordinates) {
    feedback.textContent = 'Selecione uma região no mapa corporal.';
    return;
  }
  if (button.disabled) return;
  button.disabled = true;
  feedback.textContent = 'Registrando ponto anatômico…';
  try {
    await api(`/api/sessions/${encodeURIComponent(sessionId)}/body-map-points`, {
      method: 'POST',
      body: JSON.stringify({
        sequenceNumber: Number(root.querySelector('[name="f7-sequence"]').value),
        regionId: selectedRegion.id,
        view: currentView(),
        laterality: root.querySelector('[name="f7-laterality"]').value,
        x: selectedCoordinates.x,
        y: selectedCoordinates.y,
        anatomicalLabel: root.querySelector('[name="f7-label"]').value.trim() || selectedRegion.label
      })
    });
    feedback.textContent = 'Ponto anatômico registrado na sessão.';
    root.querySelector('[name="f7-sequence"]').dataset.edited = '';
    await refreshPoints();
  } catch (error) {
    feedback.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

async function mountBodyMap() {
  if (!view || !currentPatientId) return;
  const workspace = view.querySelector('[data-patient-workspace]');
  if (!workspace || workspace.querySelector('[data-f7-body-map]')) return;
  await ensureCatalog();
  if (!workspace.isConnected || workspace !== view.querySelector('[data-patient-workspace]')) return;

  const panel = document.createElement('section');
  panel.className = 'card f7-body-map';
  panel.dataset.f7BodyMap = '';
  panel.innerHTML = `
    <div class="section-head">
      <div>
        <span class="eyebrow">F7 · MAPA CORPORAL</span>
        <h2>Localização anatômica da aplicação</h2>
      </div>
      <span class="status">Confirmação profissional</span>
    </div>
    <p class="muted">Selecione a região e confirme o ponto aplicado. O mapa registra localização; não sugere dose, protocolo ou conduta.</p>
    <div class="f7-map-shell">
      <svg class="f7-map" data-f7-map-svg viewBox="0 0 300 520" role="img" aria-label="Mapa corporal anatômico"></svg>
      <div class="f7-panel">
        <div class="form-grid two">
          <label>Sessão<select name="f7-session"></select></label>
          <label>Sequência<input name="f7-sequence" type="number" min="1" value="1"></label>
          <label>Vista
            <select name="f7-view">
              <option value="posterior">Posterior</option>
              <option value="anterior">Anterior</option>
            </select>
          </label>
          <label>Lateralidade
            <select name="f7-laterality">
              <option value="midline">Linha média</option>
              <option value="left">Esquerda</option>
              <option value="right">Direita</option>
              <option value="bilateral">Bilateral</option>
            </select>
          </label>
        </div>
        <label>Rótulo anatômico<input name="f7-label" placeholder="Ex.: C4-C5"></label>
        <div class="f7-selection" data-f7-selection>Nenhuma região selecionada.</div>
        <button type="button" data-record-body-map-f7>Registrar ponto na sessão</button>
        <p class="f7-feedback" data-f7-feedback></p>
      </div>
    </div>
    <div class="f7-panel" style="margin-top:1rem">
      <h3>Pontos anatômicos registrados</h3>
      <div class="f7-points-list" data-f7-points-list></div>
    </div>
  `;
  workspace.append(panel);
  panel.querySelector('[name="f7-view"]').addEventListener('change', () => {
    selectedRegion = null;
    selectedCoordinates = null;
    panel.querySelector('[data-f7-selection]').textContent = 'Nenhuma região selecionada.';
    renderMap();
  });
  panel.querySelector('[name="f7-sequence"]').addEventListener('input', (event) => { event.target.dataset.edited = 'true'; });
  panel.querySelector('[data-record-body-map-f7]').addEventListener('click', recordPoint);
  renderMap();
  await Promise.all([refreshSessions(), refreshPoints()]);
}

window.fetch = async (...args) => {
  const response = await upstreamFetch(...args);
  try {
    const source = typeof args[0] === 'string' ? args[0] : args[0]?.url;
    const pathname = source ? new URL(source, window.location.origin).pathname : '';
    const match = pathname.match(/^\/api\/patients\/([^/]+)\/workspace$/);
    if (match && response.ok) {
      currentPatientId = decodeURIComponent(match[1]);
      queueMicrotask(() => mountBodyMap().catch(() => {}));
    }
  } catch {}
  return response;
};

function scheduleMount() {
  if (mountScheduled) return;
  mountScheduled = true;
  queueMicrotask(() => {
    mountScheduled = false;
    mountBodyMap().catch(() => {});
  });
}

if (view) new MutationObserver(scheduleMount).observe(view, { childList: true, subtree: true });
