const view = document.querySelector('#view');
const flash = document.querySelector('#flash');
let selectedProtocolId = null;
let lastProtocols = [];

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

function setActiveNav() {
  document.querySelectorAll('[data-nav]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.nav === 'protocols');
  });
}

function protocolCurrentVersion(protocol) {
  const versions = protocol?.versions || [];
  return versions.find((version) => version.id === protocol.currentVersionId) || versions.at(-1) || null;
}

function protocolMeta(protocol) {
  const current = protocolCurrentVersion(protocol);
  if (!current) return '<div class="muted">Sem versão atual.</div>';
  const p = current.parameters || {};
  const indications = current.indications || [];
  const clinical = indications.length
    ? indications.map((item) => [item.condition, item.symptom, item.bodyRegion, item.therapeuticGoal, item.clinicalPhase]
      .filter(Boolean).map(esc).join(' · ')).join('<br>')
    : '<span class="muted">Sem indicação clínica estruturada.</span>';
  const dose = p.wavelengthNm
    ? `<div><strong>${esc(p.wavelengthNm)} nm</strong> · ${esc(p.powerMw)} mW · ${esc(p.timeS)} s · ${esc(p.areaCm2)} cm² · ${esc(p.energyJ)} J · ${esc(p.fluenceJcm2)} J/cm² · ${esc(p.irradianceMwCm2)} mW/cm² · ${esc(p.mode)} · ${esc(p.points)} ponto(s) · ${esc(p.technique)}</div>`
    : '<div class="muted">Sem dosimetria estruturada.</div>';
  return `<div class="module-note f2-protocol-meta"><div>${clinical}</div>${dose}</div>`;
}

function protocolCard(protocol) {
  return `<article class="version-item" data-protocol-card data-protocol-id="${esc(protocol.id)}">
    <header><div><strong>${esc(protocol.title)}</strong><div class="muted">Versão atual: v${esc(protocol.currentVersionNumber ?? protocolCurrentVersion(protocol)?.versionNumber ?? '—')}</div></div><button class="secondary" data-select-protocol="${esc(protocol.id)}">Abrir</button></header>
    ${protocolMeta(protocol)}
    <div class="version-list inner">${(protocol.versions || []).map((version) => `<div><strong>v${esc(version.versionNumber)}</strong> — ${esc(version.changeSummary)} <span class="muted">(${esc(version.sourceType)})</span></div>`).join('')}</div>
  </article>`;
}

function protocolListHtml(protocols, emptyMessage = 'Nenhum protocolo cadastrado.') {
  return protocols.length ? protocols.map(protocolCard).join('') : `<p class="muted">${esc(emptyMessage)}</p>`;
}

function protocolWorkspaceTemplate(protocols) {
  const selected = protocols.find((item) => item.id === selectedProtocolId) || protocols[0] || null;
  if (selected && !selectedProtocolId) selectedProtocolId = selected.id;
  return `<div class="grid two-column" data-f2-protocol-workspace>
    <section class="card">
      <span class="eyebrow">NOVO PROTOCOLO · F2</span><h2>Registrar protocolo estruturado</h2>
      <label>Título<input name="protocol-title"></label>
      <label>Resumo da versão inicial<input name="protocol-summary"></label>
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
        <span data-dosimetry-energy>1 J</span> ·
        <span data-dosimetry-fluence>1 J/cm²</span> ·
        <span data-dosimetry-irradiance>100 mW/cm²</span>
        <div class="muted">Valores derivados do que o profissional informar. Não constituem recomendação clínica automática.</div>
      </div>
      <div class="actions"><button class="primary" data-create-protocol>Criar protocolo + v1</button></div>
    </section>

    <section class="card">
      <span class="eyebrow">NOVA VERSÃO</span><h2>${selected ? esc(selected.title) : 'Selecione um protocolo'}</h2>
      <p class="muted">A versão anterior não é alterada. Metadados clínicos e parâmetros são copiados para uma nova versão quando não forem substituídos.</p>
      <label>Resumo da alteração<input name="version-summary"></label>
      <div class="actions"><button class="primary" data-create-version ${selected ? '' : 'disabled'}>Criar nova versão</button></div>
    </section>

    <section class="card wide" data-protocol-filters>
      <div class="section-head"><div><span class="eyebrow">BUSCA CLÍNICA</span><h2>Filtrar biblioteca</h2></div><span class="status">Apoio à consulta</span></div>
      <div class="form-grid">
        <label>Sintoma<input name="filter-symptom" placeholder="Ex.: dor cervical"></label>
        <label>Região corporal<input name="filter-body-region" placeholder="Ex.: cervical"></label>
        <label>Fase clínica<input name="filter-clinical-phase" placeholder="Ex.: aguda"></label>
      </div>
      <div class="actions"><button class="secondary" data-filter-protocols>Aplicar filtros</button><button class="secondary" data-clear-protocol-filters>Limpar</button></div>
    </section>

    <section class="card wide">
      <div class="section-head"><div><span class="eyebrow">BIBLIOTECA</span><h2>Protocolos versionados</h2></div><span class="status">Versionamento imutável</span></div>
      <div class="version-list" data-protocol-list>${protocolListHtml(protocols)}</div>
    </section>
  </div>`;
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
  return {
    title: document.querySelector('[name="protocol-title"]')?.value || '',
    changeSummary: document.querySelector('[name="protocol-summary"]')?.value || '',
    parameters,
    indications: Object.values(indication).some((value) => String(value).trim()) ? [indication] : []
  };
}

async function fetchProtocols(query = '') {
  const result = await api(`/api/protocols${query ? `?${query}` : ''}`);
  return result.protocols || [];
}

async function renderProtocolWorkspace({ message = '', kind = 'success' } = {}) {
  setActiveNav();
  try {
    lastProtocols = await fetchProtocols();
    if (selectedProtocolId && !lastProtocols.some((item) => item.id === selectedProtocolId)) selectedProtocolId = null;
    view.innerHTML = protocolWorkspaceTemplate(lastProtocols);
    updateDosimetryPreview();
    if (message) show(message, kind);
  } catch (error) {
    view.innerHTML = `<section class="card"><h2>Protocolos</h2><p class="module-note">${esc(error.message)}</p></section>`;
    show(error.message, 'warning');
  }
}

async function createProtocol() {
  try {
    const result = await api('/api/protocols', { method: 'POST', body: JSON.stringify(protocolPayload()) });
    selectedProtocolId = result.protocol.id;
    await renderProtocolWorkspace({ message: 'Protocolo criado com versão v1 imutável.' });
  } catch (error) { show(error.message, 'warning'); }
}

async function createVersion() {
  if (!selectedProtocolId) return;
  try {
    await api(`/api/protocols/${encodeURIComponent(selectedProtocolId)}/versions`, {
      method: 'POST',
      body: JSON.stringify({ changeSummary: document.querySelector('[name="version-summary"]')?.value || '' })
    });
    await renderProtocolWorkspace({ message: 'Nova versão criada; versões anteriores permanecem preservadas.' });
  } catch (error) { show(error.message, 'warning'); }
}

async function applyFilters() {
  const params = new URLSearchParams();
  const values = {
    symptom: document.querySelector('[name="filter-symptom"]')?.value || '',
    bodyRegion: document.querySelector('[name="filter-body-region"]')?.value || '',
    clinicalPhase: document.querySelector('[name="filter-clinical-phase"]')?.value || ''
  };
  for (const [key, value] of Object.entries(values)) if (String(value).trim()) params.set(key, value.trim());
  try {
    const protocols = await fetchProtocols(params.toString());
    const list = document.querySelector('[data-protocol-list]');
    if (list) list.innerHTML = protocolListHtml(protocols, 'Nenhum protocolo encontrado para os filtros informados.');
  } catch (error) { show(error.message, 'warning'); }
}

function clearFilters() {
  for (const name of ['filter-symptom', 'filter-body-region', 'filter-clinical-phase']) {
    const input = document.querySelector(`[name="${name}"]`);
    if (input) input.value = '';
  }
  const list = document.querySelector('[data-protocol-list]');
  if (list) list.innerHTML = protocolListHtml(lastProtocols);
}

document.addEventListener('click', (event) => {
  const protocolsNav = event.target.closest?.('[data-nav="protocols"]');
  if (protocolsNav) {
    event.preventDefault();
    event.stopImmediatePropagation();
    show('');
    renderProtocolWorkspace();
    return;
  }
  if (!document.querySelector('[data-f2-protocol-workspace]')) return;
  const select = event.target.closest?.('[data-select-protocol]');
  if (select) {
    event.preventDefault();
    selectedProtocolId = select.dataset.selectProtocol;
    view.innerHTML = protocolWorkspaceTemplate(lastProtocols);
    updateDosimetryPreview();
    return;
  }
  if (event.target.closest?.('[data-create-protocol]')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    createProtocol();
    return;
  }
  if (event.target.closest?.('[data-create-version]')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    createVersion();
    return;
  }
  if (event.target.closest?.('[data-filter-protocols]')) {
    event.preventDefault();
    applyFilters();
    return;
  }
  if (event.target.closest?.('[data-clear-protocol-filters]')) {
    event.preventDefault();
    clearFilters();
  }
}, true);

document.addEventListener('input', (event) => {
  if (event.target?.matches?.('[name="protocol-power"], [name="protocol-time"], [name="protocol-area"]')) updateDosimetryPreview();
}, true);

document.addEventListener('change', (event) => {
  if (event.target?.matches?.('[name="protocol-power"], [name="protocol-time"], [name="protocol-area"]')) updateDosimetryPreview();
}, true);
