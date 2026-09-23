const view = document.querySelector('#view');
const flash = document.querySelector('#flash');
let equipmentCache = [];
let adaptationMounting = false;

function esc(value) {
  return String(value ?? '').replace(/[&<>'\"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '\"': '&quot;'
  }[char]));
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

function setActiveNav(name) {
  document.querySelectorAll('[data-nav]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.nav === name);
  });
}

function equipmentCard(item) {
  const applicators = item.applicators || [];
  return `<article class="version-item" data-equipment-card data-equipment-id="${esc(item.id)}">
    <header>
      <div>
        <strong>${esc(item.manufacturer)} ${esc(item.model)}</strong>
        <div class="muted">${esc(item.serialNumber || 'Sem número de série')} · ${item.active ? 'Ativo' : 'Arquivado'}</div>
      </div>
      <span class="status ${item.active ? '' : 'warning'}">${item.active ? 'Ativo' : 'Arquivado'}</span>
    </header>
    <div class="form-grid compact-grid">
      <label>Fabricante<input data-equipment-edit-manufacturer value="${esc(item.manufacturer)}"></label>
      <label>Modelo<input data-equipment-edit-model value="${esc(item.model)}"></label>
      <label>Série<input data-equipment-edit-serial value="${esc(item.serialNumber || '')}"></label>
      <label>Observações<input data-equipment-edit-notes value="${esc(item.notes || '')}"></label>
    </div>
    <div class="actions">
      <button class="secondary" data-save-equipment-f3="${esc(item.id)}">Salvar dados</button>
      <button class="secondary" data-toggle-equipment-f3="${esc(item.id)}" data-active="${item.active ? '1' : '0'}">${item.active ? 'Arquivar' : 'Reativar'}</button>
    </div>
    <div class="version-list inner">
      ${applicators.length ? applicators.map((applicator) => `<div>
        <strong>${esc(applicator.name)}</strong> · ${esc(applicator.wavelengthNm)} nm ·
        ${applicator.fixedPowerMw ? `${esc(applicator.fixedPowerMw)} mW fixos` : `${esc(applicator.minPowerMw || '—')}–${esc(applicator.maxPowerMw || '—')} mW`} ·
        ${esc(applicator.spotAreaCm2 || '—')} cm² · ${(applicator.modes || []).map(esc).join(', ') || 'modo não informado'}
      </div>`).join('') : '<div class="muted">Nenhum aplicador cadastrado.</div>'}
    </div>
  </article>`;
}

function equipmentOptions() {
  return equipmentCache.filter((item) => item.active).map((item) =>
    `<option value="${esc(item.id)}">${esc(item.manufacturer)} ${esc(item.model)}</option>`
  ).join('');
}

function equipmentWorkspaceTemplate() {
  return `<div class="grid two-column" data-f3-equipment-workspace>
    <section class="card">
      <span class="eyebrow">EQUIPAMENTO · F3</span><h2>Cadastrar equipamento</h2>
      <div class="form-grid">
        <label>Fabricante<input name="equipment-manufacturer"></label>
        <label>Modelo<input name="equipment-model"></label>
        <label>Número de série<input name="equipment-serial"></label>
        <label>Observações<input name="equipment-notes"></label>
      </div>
      <div class="actions"><button class="primary" data-create-equipment-f3>Cadastrar equipamento</button></div>
    </section>

    <section class="card">
      <span class="eyebrow">APLICADOR / PONTEIRA</span><h2>Capacidade real do aplicador</h2>
      <label>Equipamento<select name="applicator-equipment"><option value="">Selecione…</option>${equipmentOptions()}</select></label>
      <div class="form-grid">
        <label>Nome<input name="applicator-name"></label>
        <label>Comprimento de onda (nm)<input type="number" min="1" name="applicator-wavelength"></label>
        <label>Potência fixa (mW)<input type="number" min="0.01" step="0.01" name="applicator-fixed-power"></label>
        <label>Potência mínima (mW)<input type="number" min="0.01" step="0.01" name="applicator-min-power"></label>
        <label>Potência máxima (mW)<input type="number" min="0.01" step="0.01" name="applicator-max-power"></label>
        <label>Área/spot (cm²)<input type="number" min="0.0001" step="0.0001" name="applicator-area"></label>
        <label>Modo<select name="applicator-mode"><option value="continuous">Contínuo</option><option value="pulsed">Pulsado</option></select></label>
        <label>Frequências Hz (separadas por vírgula)<input name="applicator-frequencies"></label>
        <label>Limitações<input name="applicator-limitations"></label>
      </div>
      <p class="muted">Em aplicadores com faixa de potência, o sistema exige que o profissional informe a potência escolhida antes do cálculo.</p>
      <div class="actions"><button class="primary" data-create-applicator-f3>Cadastrar aplicador</button></div>
    </section>

    <section class="card wide">
      <div class="section-head"><div><span class="eyebrow">INVENTÁRIO</span><h2>Equipamentos e aplicadores</h2></div><span class="status">Edição não destrutiva</span></div>
      <div class="version-list">${equipmentCache.length ? equipmentCache.map(equipmentCard).join('') : '<p class="muted">Nenhum equipamento cadastrado.</p>'}</div>
    </section>
  </div>`;
}

async function renderEquipmentWorkspace(message = '') {
  setActiveNav('equipment');
  try {
    const result = await api('/api/equipment');
    equipmentCache = result.equipment || [];
    view.innerHTML = equipmentWorkspaceTemplate();
    if (message) show(message);
  } catch (error) {
    view.innerHTML = `<section class="card"><h2>Equipamentos</h2><p class="module-note">${esc(error.message)}</p></section>`;
    show(error.message, 'warning');
  }
}

function csvNumbers(value) {
  return String(value || '').split(',').map((item) => Number(item.trim())).filter((value) => Number.isFinite(value) && value > 0);
}

function numberOrNull(selector) {
  const value = document.querySelector(selector)?.value;
  if (value == null || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function createEquipment() {
  try {
    await api('/api/equipment', {
      method: 'POST',
      body: JSON.stringify({
        manufacturer: document.querySelector('[name="equipment-manufacturer"]')?.value || '',
        model: document.querySelector('[name="equipment-model"]')?.value || '',
        serialNumber: document.querySelector('[name="equipment-serial"]')?.value || '',
        notes: document.querySelector('[name="equipment-notes"]')?.value || ''
      })
    });
    await renderEquipmentWorkspace('Equipamento cadastrado.');
  } catch (error) { show(error.message, 'warning'); }
}

async function createApplicator() {
  const equipmentId = document.querySelector('[name="applicator-equipment"]')?.value;
  if (!equipmentId) return show('Selecione um equipamento.', 'warning');
  const mode = document.querySelector('[name="applicator-mode"]')?.value || 'continuous';
  try {
    await api(`/api/equipment/${encodeURIComponent(equipmentId)}/applicators`, {
      method: 'POST',
      body: JSON.stringify({
        name: document.querySelector('[name="applicator-name"]')?.value || '',
        wavelengthNm: numberOrNull('[name="applicator-wavelength"]'),
        fixedPowerMw: numberOrNull('[name="applicator-fixed-power"]'),
        minPowerMw: numberOrNull('[name="applicator-min-power"]'),
        maxPowerMw: numberOrNull('[name="applicator-max-power"]'),
        spotAreaCm2: numberOrNull('[name="applicator-area"]'),
        modes: [mode],
        frequenciesHz: csvNumbers(document.querySelector('[name="applicator-frequencies"]')?.value),
        limitations: document.querySelector('[name="applicator-limitations"]')?.value || ''
      })
    });
    await renderEquipmentWorkspace('Aplicador cadastrado.');
  } catch (error) { show(error.message, 'warning'); }
}

async function saveEquipment(button) {
  const card = button.closest('[data-equipment-card]');
  try {
    await api(`/api/equipment/${encodeURIComponent(button.dataset.saveEquipmentF3)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        manufacturer: card.querySelector('[data-equipment-edit-manufacturer]')?.value || '',
        model: card.querySelector('[data-equipment-edit-model]')?.value || '',
        serialNumber: card.querySelector('[data-equipment-edit-serial]')?.value || '',
        notes: card.querySelector('[data-equipment-edit-notes]')?.value || ''
      })
    });
    await renderEquipmentWorkspace('Dados do equipamento atualizados.');
  } catch (error) { show(error.message, 'warning'); }
}

async function toggleEquipment(button) {
  try {
    await api(`/api/equipment/${encodeURIComponent(button.dataset.toggleEquipmentF3)}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: button.dataset.active !== '1' })
    });
    await renderEquipmentWorkspace(button.dataset.active === '1' ? 'Equipamento arquivado.' : 'Equipamento reativado.');
  } catch (error) { show(error.message, 'warning'); }
}

function adaptationPanel(protocols, equipment) {
  const versions = protocols.flatMap((protocol) => (protocol.versions || []).map((version) => ({ protocol, version })));
  const applicators = equipment.flatMap((item) => (item.applicators || []).filter((app) => app.active).map((app) => ({ equipment: item, app })));
  return `<section class="card wide" data-f3-adaptation>
    <div class="section-head"><div><span class="eyebrow">ADAPTAÇÃO AO EQUIPAMENTO · F3</span><h2>Referência × equipamento real</h2></div><span class="status">Cálculo técnico</span></div>
    <p class="muted">O protocolo de referência permanece intacto. O sistema apenas calcula parâmetros derivados do equipamento selecionado; isso não é recomendação automática de dose.</p>
    <div class="form-grid">
      <label>Versão do protocolo<select name="adaptation-protocol-version"><option value="">Selecione…</option>${versions.map(({ protocol, version }) => `<option value="${esc(version.id)}">${esc(protocol.title)} · v${esc(version.versionNumber)}</option>`).join('')}</select></label>
      <label>Aplicador<select name="adaptation-applicator"><option value="">Selecione…</option>${applicators.map(({ equipment: item, app }) => `<option value="${esc(app.id)}">${esc(item.manufacturer)} ${esc(item.model)} · ${esc(app.name)} · ${esc(app.wavelengthNm)} nm</option>`).join('')}</select></label>
      <label>Potência escolhida (mW, se variável)<input type="number" min="0.01" step="0.01" name="adaptation-selected-power"></label>
    </div>
    <div class="actions"><button class="primary" data-preview-adaptation>Calcular adaptação</button></div>
    <div class="grid two-column" data-adaptation-result hidden>
      <div class="module-note" data-adaptation-reference></div>
      <div class="module-note" data-adaptation-derived></div>
    </div>
    <div class="version-list" data-adaptation-warnings></div>
  </section>`;
}

function parameterSummary(parameters = {}) {
  const parts = [];
  if (parameters.wavelengthNm != null) parts.push(`${esc(parameters.wavelengthNm)} nm`);
  if (parameters.powerMw != null) parts.push(`${esc(parameters.powerMw)} mW`);
  if (parameters.timeS != null) parts.push(`${esc(parameters.timeS)} s`);
  if (parameters.energyJ != null) parts.push(`${esc(parameters.energyJ)} J`);
  if (parameters.areaCm2 != null) parts.push(`${esc(parameters.areaCm2)} cm²`);
  if (parameters.irradianceMwCm2 != null) parts.push(`${esc(parameters.irradianceMwCm2)} mW/cm²`);
  if (parameters.fluenceJcm2 != null) parts.push(`${esc(parameters.fluenceJcm2)} J/cm²`);
  return parts.join(' · ') || 'Dados insuficientes';
}

async function mountAdaptationPanel() {
  if (adaptationMounting || !document.querySelector('[data-f2-protocol-workspace]') || document.querySelector('[data-f3-adaptation]')) return;
  adaptationMounting = true;
  try {
    const [protocolResult, equipmentResult] = await Promise.all([api('/api/protocols'), api('/api/equipment')]);
    const workspace = document.querySelector('[data-f2-protocol-workspace]');
    if (workspace && !document.querySelector('[data-f3-adaptation]')) {
      workspace.insertAdjacentHTML('beforeend', adaptationPanel(protocolResult.protocols || [], equipmentResult.equipment || []));
    }
  } catch (error) {
    show(error.message, 'warning');
  } finally {
    adaptationMounting = false;
  }
}

async function previewAdaptation() {
  const versionId = document.querySelector('[name="adaptation-protocol-version"]')?.value;
  const applicatorId = document.querySelector('[name="adaptation-applicator"]')?.value;
  if (!versionId || !applicatorId) return show('Selecione protocolo e aplicador.', 'warning');
  const selectedPowerMw = numberOrNull('[name="adaptation-selected-power"]');
  try {
    const result = await api(`/api/protocol-versions/${encodeURIComponent(versionId)}/adapt`, {
      method: 'POST', body: JSON.stringify({ applicatorId, selectedPowerMw })
    });
    const adaptation = result.adaptation;
    const resultBox = document.querySelector('[data-adaptation-result]');
    resultBox.hidden = false;
    document.querySelector('[data-adaptation-reference]').innerHTML = `<strong>Referência preservada</strong><div>${parameterSummary(adaptation.referenceParameters)}</div>`;
    document.querySelector('[data-adaptation-derived]').innerHTML = `<strong>Calculado para equipamento</strong><div>${parameterSummary(adaptation.equipmentDerivedParameters)}</div>`;
    document.querySelector('[data-adaptation-warnings]').innerHTML = adaptation.warnings.length
      ? adaptation.warnings.map((warning) => `<div data-adaptation-warning class="module-note">${esc(warning)}</div>`).join('')
      : '<div class="muted">Sem incompatibilidades técnicas detectadas.</div>';
  } catch (error) { show(error.message, 'warning'); }
}

document.addEventListener('click', (event) => {
  const equipmentNav = event.target.closest?.('[data-nav="equipment"]');
  if (equipmentNav) {
    event.preventDefault();
    event.stopImmediatePropagation();
    show('');
    renderEquipmentWorkspace();
    return;
  }
  if (event.target.closest?.('[data-create-equipment-f3]')) {
    event.preventDefault(); event.stopImmediatePropagation(); createEquipment(); return;
  }
  if (event.target.closest?.('[data-create-applicator-f3]')) {
    event.preventDefault(); event.stopImmediatePropagation(); createApplicator(); return;
  }
  const save = event.target.closest?.('[data-save-equipment-f3]');
  if (save) { event.preventDefault(); saveEquipment(save); return; }
  const toggle = event.target.closest?.('[data-toggle-equipment-f3]');
  if (toggle) { event.preventDefault(); toggleEquipment(toggle); return; }
  if (event.target.closest?.('[data-preview-adaptation]')) {
    event.preventDefault(); previewAdaptation();
  }
}, true);

new MutationObserver(() => mountAdaptationPanel()).observe(view, { childList: true, subtree: true });
mountAdaptationPanel();
