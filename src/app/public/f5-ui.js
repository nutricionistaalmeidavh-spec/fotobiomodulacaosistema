const view = document.querySelector('#view');
const upstreamFetch = window.fetch.bind(window);
let currentPatientId = null;
let mountScheduled = false;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function displayNumber(value) {
  if (value == null || value === '') return '—';
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return Number.isInteger(number) ? String(number) : String(Number(number.toFixed(2)));
}

function formatDate(value) {
  if (!value) return 'Sem data';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
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
  if (!response.ok) throw new Error(payload.error || 'Falha na operação F5.');
  return payload;
}

function eventLabel(type) {
  return ({
    assessment: 'Avaliação clínica',
    encounter: 'Atendimento',
    treatment_session: 'Sessão PBM',
    outcome: 'Desfecho clínico',
    clinical_media: 'Imagem clínica',
    consent: 'Consentimento',
    document: 'Documento clínico',
    application_point: 'Ponto de aplicação'
  })[type] || 'Evento clínico';
}

function eventDetails(item) {
  if (item.type === 'outcome') {
    const measured = item.metricValue == null
      ? ''
      : `${displayNumber(item.metricValue)}${item.metricUnit ? ` ${item.metricUnit}` : ''}`;
    return [item.metricType, measured, item.narrative].filter(Boolean).join(' · ');
  }
  if (item.type === 'assessment') {
    return item.chiefComplaint || item.chief_complaint || item.notes || 'Avaliação registrada';
  }
  if (item.type === 'treatment_session') {
    const applied = item.appliedEnergyJ ?? item.applied_energy_j ?? item.appliedParameters?.energyJ;
    return applied == null ? 'Sessão registrada' : `Energia aplicada: ${displayNumber(applied)} J`;
  }
  if (item.type === 'clinical_media') {
    return item.originalFilename || item.original_filename || item.caption || 'Imagem clínica registrada';
  }
  if (item.type === 'consent') return `${item.consentType || item.consent_type || 'consentimento'} · ${item.status || ''}`;
  if (item.type === 'document') return item.title || item.documentType || item.document_type || 'Documento clínico';
  if (item.type === 'encounter') return item.chiefComplaint || item.chief_complaint || item.notes || item.status || 'Atendimento registrado';
  return item.notes || item.narrative || '';
}

function renderTimeline(items) {
  const container = view?.querySelector('[data-f5-timeline]');
  if (!container) return;
  if (!items.length) {
    container.innerHTML = '<p class="empty-state">Nenhum evento longitudinal registrado.</p>';
    return;
  }
  container.innerHTML = items.map((item) => `
    <article class="f5-timeline-item" data-f5-timeline-item>
      <div>
        <strong>${escapeHtml(eventLabel(item.type))}</strong>
        <small>${escapeHtml(formatDate(item.at))}</small>
      </div>
      <p>${escapeHtml(eventDetails(item))}</p>
    </article>
  `).join('');
}

function chartPolyline(points) {
  const numeric = points.filter((point) => Number.isFinite(point.metricValue));
  if (numeric.length < 2) return '';
  const values = numeric.map((point) => Number(point.metricValue));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const coordinates = values.map((value, index) => {
    const x = numeric.length === 1 ? 50 : 8 + (index / (numeric.length - 1)) * 84;
    const y = 88 - ((value - min) / span) * 72;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
  return `
    <svg viewBox="0 0 100 100" role="img" aria-label="Série longitudinal descritiva">
      <polyline points="${coordinates}" fill="none" vector-effect="non-scaling-stroke"></polyline>
    </svg>
  `;
}

function renderSeries(series) {
  const list = view?.querySelector('[data-f5-series-list]');
  const comparison = view?.querySelector('[data-f5-comparison]');
  const chart = view?.querySelector('[data-f5-chart]');
  if (!list || !comparison || !chart) return;

  const points = Array.isArray(series.points) ? series.points : [];
  list.innerHTML = points.length
    ? points.map((point) => `
        <div class="f5-series-point" data-f5-series-point>
          <strong>${escapeHtml(displayNumber(point.metricValue))}${point.metricUnit ? ` ${escapeHtml(point.metricUnit)}` : ''}</strong>
          <span>${escapeHtml(formatDate(point.measuredAt))}</span>
        </div>
      `).join('')
    : '<p class="empty-state">Sem pontos para esta série.</p>';

  if (series.firstValue != null && series.latestValue != null && points.length >= 2) {
    const unit = points.find((point) => point.metricUnit)?.metricUnit || '';
    comparison.textContent = `${displayNumber(series.firstValue)} → ${displayNumber(series.latestValue)}${unit ? ` ${unit}` : ''} · variação ${displayNumber(series.absoluteChange)}. Comparação descritiva entre registros; não estabelece causalidade.`;
  } else {
    comparison.textContent = 'Comparação descritiva disponível após pelo menos dois registros numéricos.';
  }
  chart.innerHTML = chartPolyline(points);
}

async function refreshTimeline() {
  if (!currentPatientId) return;
  const payload = await api(`/api/patients/${encodeURIComponent(currentPatientId)}/timeline?order=asc`);
  renderTimeline(payload.timeline || []);
}

async function loadSeries() {
  if (!currentPatientId) return;
  const type = view.querySelector('[name="f5-series-type"]')?.value || 'vas_pain';
  const group = view.querySelector('[name="f5-series-group"]')?.value.trim() || '';
  const params = new URLSearchParams({ metricType: type });
  if (group) params.set('baselineGroup', group);
  const payload = await api(`/api/patients/${encodeURIComponent(currentPatientId)}/outcome-series?${params}`);
  renderSeries(payload.series || { points: [] });
}

function syncUnitPlaceholder() {
  const type = view?.querySelector('[name="f5-outcome-type"]')?.value;
  const unit = view?.querySelector('[name="f5-outcome-unit"]');
  const value = view?.querySelector('[name="f5-outcome-value"]');
  if (!unit || !value) return;
  if (type === 'vas_pain') {
    unit.value = '0-10';
    unit.disabled = true;
    value.disabled = false;
  } else if (type === 'rom') {
    unit.value = unit.value && unit.value !== '0-10' ? unit.value : 'deg';
    unit.disabled = false;
    value.disabled = false;
  } else if (type === 'text') {
    unit.value = '';
    unit.disabled = true;
    value.value = '';
    value.disabled = true;
  } else {
    if (unit.value === '0-10') unit.value = '';
    unit.disabled = false;
    value.disabled = false;
  }
}

async function recordOutcome() {
  if (!currentPatientId) return;
  const type = view.querySelector('[name="f5-outcome-type"]').value;
  const rawValue = view.querySelector('[name="f5-outcome-value"]').value;
  const payload = {
    metricType: type,
    metricValue: rawValue === '' ? null : Number(rawValue),
    metricUnit: view.querySelector('[name="f5-outcome-unit"]').value.trim() || null,
    baselineGroup: view.querySelector('[name="f5-outcome-group"]').value.trim() || null,
    narrative: view.querySelector('[name="f5-outcome-narrative"]').value.trim() || null
  };
  await api(`/api/patients/${encodeURIComponent(currentPatientId)}/outcomes`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  const feedback = view.querySelector('[data-f5-feedback]');
  if (feedback) feedback.textContent = 'Evolução registrada.';
  const seriesType = view.querySelector('[name="f5-series-type"]');
  const seriesGroup = view.querySelector('[name="f5-series-group"]');
  if (seriesType) seriesType.value = type;
  if (seriesGroup) seriesGroup.value = payload.baselineGroup || '';
  await Promise.all([refreshTimeline(), loadSeries()]);
}

function mountEvolution() {
  if (!view || !currentPatientId) return;
  const workspace = view.querySelector('[data-patient-workspace]');
  if (!workspace || workspace.querySelector('[data-f5-evolution]')) return;

  const section = document.createElement('section');
  section.className = 'card f5-evolution';
  section.dataset.f5Evolution = '';
  section.innerHTML = `
    <div class="section-head">
      <div>
        <span class="eyebrow">F5 · EVOLUÇÃO LONGITUDINAL</span>
        <h2>Desfechos e evolução clínica</h2>
      </div>
      <span class="status">Descritivo</span>
    </div>
    <p class="muted">Registre medidas seriadas e compare valores ao longo do tempo. O sistema descreve a evolução e não atribui causalidade ao tratamento.</p>

    <div class="f5-grid">
      <div class="f5-panel">
        <h3>Novo desfecho</h3>
        <label>Tipo
          <select name="f5-outcome-type">
            <option value="vas_pain">Dor · VAS 0–10</option>
            <option value="functional_numeric">Funcional · numérico</option>
            <option value="edema">Edema · numérico</option>
            <option value="rom">Amplitude de movimento · ROM</option>
            <option value="text">Evolução textual</option>
          </select>
        </label>
        <div class="form-grid two">
          <label>Valor<input name="f5-outcome-value" type="number" step="any" inputmode="decimal"></label>
          <label>Unidade<input name="f5-outcome-unit" value="0-10"></label>
        </div>
        <label>Grupo longitudinal<input name="f5-outcome-group" placeholder="Ex.: cervical-setembro"></label>
        <label>Observação<textarea name="f5-outcome-narrative" rows="3" placeholder="Contexto clínico do registro"></textarea></label>
        <button type="button" data-record-outcome-f5>Registrar evolução</button>
        <p class="f5-feedback" data-f5-feedback></p>
      </div>

      <div class="f5-panel">
        <h3>Série e comparação</h3>
        <label>Métrica
          <select name="f5-series-type">
            <option value="vas_pain">Dor · VAS 0–10</option>
            <option value="functional_numeric">Funcional</option>
            <option value="edema">Edema</option>
            <option value="rom">ROM</option>
          </select>
        </label>
        <label>Grupo longitudinal<input name="f5-series-group" placeholder="Mesmo grupo usado nos registros"></label>
        <button type="button" class="secondary" data-load-series-f5>Carregar série</button>
        <div class="f5-comparison" data-f5-comparison>Comparação descritiva disponível após pelo menos dois registros numéricos.</div>
        <div class="f5-chart" data-f5-chart></div>
        <div class="f5-series-list" data-f5-series-list></div>
      </div>
    </div>

    <div class="f5-timeline-wrap">
      <div class="section-head compact-head">
        <div><h3>Linha do tempo clínica</h3><p class="muted">Avaliações, sessões, imagens e desfechos em ordem cronológica.</p></div>
      </div>
      <div class="f5-timeline" data-f5-timeline></div>
    </div>
  `;

  workspace.append(section);
  section.querySelector('[name="f5-outcome-type"]').addEventListener('change', syncUnitPlaceholder);
  section.querySelector('[data-record-outcome-f5]').addEventListener('click', () => recordOutcome().catch(showError));
  section.querySelector('[data-load-series-f5]').addEventListener('click', () => loadSeries().catch(showError));
  syncUnitPlaceholder();
  refreshTimeline().catch(showError);
}

function showError(error) {
  const feedback = view?.querySelector('[data-f5-feedback]');
  if (feedback) feedback.textContent = error?.message || 'Falha na operação F5.';
}

window.fetch = async (...args) => {
  const response = await upstreamFetch(...args);
  try {
    const source = typeof args[0] === 'string' ? args[0] : args[0]?.url;
    const pathname = source ? new URL(source, window.location.origin).pathname : '';
    const match = pathname.match(/^\/api\/patients\/([^/]+)\/workspace$/);
    if (match && response.ok) {
      currentPatientId = decodeURIComponent(match[1]);
      queueMicrotask(mountEvolution);
    }
  } catch {}
  return response;
};

function scheduleMount() {
  if (mountScheduled) return;
  mountScheduled = true;
  queueMicrotask(() => {
    mountScheduled = false;
    mountEvolution();
  });
}

if (view) new MutationObserver(scheduleMount).observe(view, { childList: true, subtree: true });
