const view = document.querySelector('#view');
const flash = document.querySelector('#flash');
let enriching = false;

function esc(value) {
  return String(value ?? '').replace(/[&<>'\"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '\"': '&quot;'
  }[char]));
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return '—';
  return String(Number(value.toFixed(6)));
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Falha HTTP ${response.status}`);
  return payload;
}

function show(message, kind = 'success') {
  if (!flash) return;
  flash.hidden = !message;
  flash.textContent = message || '';
  flash.dataset.kind = kind;
}

function protocolsVisible() {
  return Boolean(document.querySelector('[name="protocol-title"]'));
}

function updateDosimetryPreview() {
  const power = Number(document.querySelector('[name="protocol-power"]')?.value);
  const time = Number(document.querySelector('[name="protocol-time"]')?.value);
  const area = Number(document.querySelector('[name="protocol-area"]')?.value);
  const energy = power > 0 && time > 0 ? (power / 1000) * time : NaN;
  const irradiance = power > 0 && area > 0 ? power / area : NaN;
  const fluence = Number.isFinite(energy) && area > 0 ? energy / area : NaN;
  const energyNode = document.querySelector('[data-dosimetry-energy]');
  const fluenceNode = document.querySelector('[data-dosimetry-fluence]');
  const irradianceNode = document.querySelector('[data-dosimetry-irradiance]');
  if (energyNode) energyNode.textContent = Number.isFinite(energy) ? `${formatNumber(energy)} J` : '—';
  if (fluenceNode) fluenceNode.textContent = Number.isFinite(fluence) ? `${formatNumber(fluence)} J/cm²` : '—';
  if (irradianceNode) irradianceNode.textContent = Number.isFinite(irradiance) ? `${formatNumber(irradiance)} mW/cm²` : '—';
}

function ensureProtocolControls() {
  if (!protocolsVisible()) return;
  const createSection = document.querySelector('[name="protocol-title"]')?.closest('section.card');
  if (!createSection) return;

  if (!document.querySelector('[data-protocol-f2-fields]')) {
    const actions = createSection.querySelector('.actions');
    actions?.insertAdjacentHTML('beforebegin', `
      <div data-protocol-f2-fields>
        <div class="form-grid">
          <label>Condição<input name="protocol-condition" placeholder="Ex.: Cervicalgia"></label>
          <label>Sintoma<input name="protocol-symptom" placeholder="Ex.: Dor cervical"></label>
          <label>Região corporal<input name="protocol-body-region" placeholder="Ex.: Cervical"></label>
          <label>Objetivo terapêutico<input name="protocol-goal" placeholder="Ex.: Analgesia"></label>
          <label>Fase clínica<input name="protocol-clinical-phase" placeholder="Ex.: aguda"></label>
        </div>
        <div class="form-grid">
          <label>Comprimento de onda (nm)<input type="number" min="1" step="1" name="protocol-wavelength" value="660"></label>
          <label>Potência (mW)<input type="number" min="0.01" step="0.01" name="protocol-power" value="100"></label>
          <label>Tempo por aplicação (s)<input type="number" min="0.01" step="0.01" name="protocol-time" value="10"></label>
          <label>Área/spot (cm²)<input type="number" min="0.0001" step="0.0001" name="protocol-area" value="1"></label>
          <label>Modo<select name="protocol-mode"><option value="continuous">Contínuo</option><option value="pulsed">Pulsado</option></select></label>
          <label>Frequência (Hz, se pulsado)<input type="number" min="0.01" step="0.01" name="protocol-frequency"></label>
          <label>Pontos<input type="number" min="1" step="1" name="protocol-points" value="1"></label>
          <label>Técnica<input name="protocol-technique" value="contact"></label>
        </div>
        <div class="module-note" data-dosimetry-preview>
          <strong>Cálculo físico:</strong>
          <span data-dosimetry-energy>—</span> ·
          <span data-dosimetry-fluence>—</span> ·
          <span data-dosimetry-irradiance>—</span>
          <div class="muted">Valores derivados do que o profissional informar. Não constituem recomendação clínica automática.</div>
        </div>
      </div>`);
  }

  const library = Array.from(document.querySelectorAll('section.card.wide')).find((section) => section.textContent.includes('Protocolos versionados'));
  if (library && !document.querySelector('[data-protocol-filters]')) {
    library.insertAdjacentHTML('beforebegin', `
      <section class="card wide" data-protocol-filters>
        <div class="section-head"><div><span class="eyebrow">BUSCA CLÍNICA</span><h2>Filtrar biblioteca</h2></div><span class="status">Apoio à consulta</span></div>
        <div class="form-grid">
          <label>Sintoma<input name="filter-symptom" placeholder="Ex.: dor cervical"></label>
          <label>Região corporal<input name="filter-body-region" placeholder="Ex.: cervical"></label>
          <label>Fase clínica<input name="filter-clinical-phase" placeholder="Ex.: aguda"></label>
        </div>
        <div class="actions"><button class="secondary" data-filter-protocols>Aplicar filtros</button><button class="secondary" data-clear-protocol-filters>Limpar</button></div>
      </section>`);
  }
  updateDosimetryPreview();
  if (document.querySelector('article.version-item:not([data-protocol-card]) [data-select-protocol]')) {
    enrichProtocolCards();
  }
}

function protocolMeta(protocol) {
  const versions = protocol.versions || [];
  const current = versions.find((version) => version.id === protocol.currentVersionId) || versions.at(-1);
  if (!current) return '<div class="muted">Sem versão atual.</div>';
  const p = current.parameters || {};
  const indications = current.indications || [];
  const clinical = indications.length
    ? indications.map((item) => [item.condition, item.symptom, item.bodyRegion, item.therapeuticGoal, item.clinicalPhase].filter(Boolean).map(esc).join(' · ')).join('<br>')
    : '<span class="muted">Sem indicação clínica estruturada.</span>';
  const dose = p.wavelengthNm
    ? `<div><strong>${esc(p.wavelengthNm)} nm</strong> · ${esc(p.powerMw)} mW · ${esc(p.timeS)} s · ${esc(p.areaCm2)} cm² · ${esc(p.energyJ)} J · ${esc(p.fluenceJcm2)} J/cm² · ${esc(p.irradianceMwCm2)} mW/cm² · ${esc(p.mode)} · ${esc(p.points)} ponto(s) · ${esc(p.technique)}</div>`
    : '<div class="muted">Sem dosimetria estruturada.</div>';
  return `<div class="module-note f2-protocol-meta"><div>${clinical}</div>${dose}</div>`;
}

async function enrichProtocolCards() {
  if (enriching || !protocolsVisible()) return;
  enriching = true;
  try {
    const result = await api('/api/protocols');
    for (const protocol of result.protocols || []) {
      const button = document.querySelector(`[data-select-protocol="${CSS.escape(protocol.id)}"]`);
      const card = button?.closest('article.version-item');
      if (!card || card.hasAttribute('data-protocol-card')) continue;
      card.setAttribute('data-protocol-card', '');
      card.dataset.protocolId = protocol.id;
      if (!card.querySelector('.f2-protocol-meta')) {
        card.querySelector('header')?.insertAdjacentHTML('afterend', protocolMeta(protocol));
      }
    }
  } catch (error) {
    show(error.message, 'warning');
  } finally {
    enriching = false;
  }
}

function protocolPayload() {
  const mode = document.querySelector('[name="protocol-mode"]')?.value || 'continuous';
  const frequency = Number(document.querySelector('[name="protocol-frequency"]')?.value);
  const parameters = {
    wavelengthNm: Number(document.querySelector('[name="protocol-wavelength"]')?.value),
    powerMw: Number(document.querySelector('[name="protocol-power"]')?.value),
    timeS: Number(document.querySelector('[name="protocol-time"]')?.value),
    areaCm2: Number(document.querySelector('[name="protocol-area"]')?.value),
    mode,
    points: Number(document.querySelector('[name="protocol-points"]')?.value),
    technique: document.querySelector('[name="protocol-technique"]')?.value || ''
  };
  if (mode === 'pulsed' && frequency > 0) parameters.frequencyHz = frequency;

  const indication = {
    condition: document.querySelector('[name="protocol-condition"]')?.value || '',
    symptom: document.querySelector('[name="protocol-symptom"]')?.value || '',
    bodyRegion: document.querySelector('[name="protocol-body-region"]')?.value || '',
    therapeuticGoal: document.querySelector('[name="protocol-goal"]')?.value || '',
    clinicalPhase: document.querySelector('[name="protocol-clinical-phase"]')?.value || ''
  };
  const hasIndication = Object.values(indication).some((value) => String(value).trim());
  return {
    title: document.querySelector('[name="protocol-title"]')?.value || '',
    changeSummary: document.querySelector('[name="protocol-summary"]')?.value || '',
    parameters,
    indications: hasIndication ? [indication] : []
  };
}

function waitForProtocol(id) {
  return new Promise((resolve) => {
    let attempts = 0;
    const find = () => {
      const button = document.querySelector(`[data-select-protocol="${CSS.escape(id)}"]`);
      if (button || attempts >= 40) return resolve(button || null);
      attempts += 1;
      setTimeout(find, 50);
    };
    find();
  });
}

async function createStructuredProtocol() {
  try {
    const result = await api('/api/protocols', { method: 'POST', body: JSON.stringify(protocolPayload()) });
    show('Protocolo F2 criado com dosimetria calculada e versão imutável.');
    document.querySelector('[data-nav="protocols"]')?.click();
    const select = await waitForProtocol(result.protocol.id);
    select?.click();
    await enrichProtocolCards();
  } catch (error) {
    show(error.message, 'warning');
  }
}

async function applyProtocolFilters() {
  const params = new URLSearchParams();
  const values = {
    symptom: document.querySelector('[name="filter-symptom"]')?.value || '',
    bodyRegion: document.querySelector('[name="filter-body-region"]')?.value || '',
    clinicalPhase: document.querySelector('[name="filter-clinical-phase"]')?.value || ''
  };
  for (const [key, value] of Object.entries(values)) if (String(value).trim()) params.set(key, value.trim());
  try {
    const result = await api(`/api/protocols${params.size ? `?${params.toString()}` : ''}`);
    const visible = new Set((result.protocols || []).map((item) => item.id));
    document.querySelectorAll('[data-protocol-card]').forEach((card) => {
      card.hidden = !visible.has(card.dataset.protocolId);
    });
  } catch (error) {
    show(error.message, 'warning');
  }
}

function clearProtocolFilters() {
  for (const name of ['filter-symptom', 'filter-body-region', 'filter-clinical-phase']) {
    const input = document.querySelector(`[name="${name}"]`);
    if (input) input.value = '';
  }
  document.querySelectorAll('[data-protocol-card]').forEach((card) => { card.hidden = false; });
}

document.addEventListener('click', (event) => {
  const createButton = event.target.closest?.('[data-create-protocol]');
  if (createButton && document.querySelector('[data-protocol-f2-fields]')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    createStructuredProtocol();
    return;
  }
  if (event.target.closest?.('[data-filter-protocols]')) {
    event.preventDefault();
    applyProtocolFilters();
  }
  if (event.target.closest?.('[data-clear-protocol-filters]')) {
    event.preventDefault();
    clearProtocolFilters();
  }
}, true);

document.addEventListener('input', (event) => {
  if (event.target?.matches?.('[name="protocol-power"], [name="protocol-time"], [name="protocol-area"]')) updateDosimetryPreview();
}, true);

document.addEventListener('change', (event) => {
  if (event.target?.matches?.('[name="protocol-power"], [name="protocol-time"], [name="protocol-area"]')) updateDosimetryPreview();
}, true);

new MutationObserver(() => ensureProtocolControls()).observe(view, { childList: true, subtree: true });
ensureProtocolControls();
