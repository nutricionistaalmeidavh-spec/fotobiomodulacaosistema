const state = {
  currentView: 'dashboard', status: null, patients: [], equipment: [], protocols: [], sessions: [],
  audit: { valid: true, events: [] }, selectedProtocolId: null
};

const view = document.querySelector('#view');
const flash = document.querySelector('#flash');
const navButtons = Array.from(document.querySelectorAll('[data-nav]'));

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Falha HTTP ${response.status}`);
  return payload;
}

function showMessage(message, kind = 'warning') {
  flash.hidden = !message;
  flash.textContent = message || '';
  flash.dataset.kind = kind;
}

async function refreshAll() {
  const [status, patients, equipment, protocols, sessions, audit] = await Promise.all([
    api('/api/status'), api('/api/patients'), api('/api/equipment'), api('/api/protocols'), api('/api/sessions'), api('/api/audit')
  ]);
  state.status = status; state.patients = patients.patients; state.equipment = equipment.equipment;
  state.protocols = protocols.protocols; state.sessions = sessions.sessions; state.audit = audit;
  if (!state.selectedProtocolId || !state.protocols.some((item) => item.id === state.selectedProtocolId)) {
    state.selectedProtocolId = state.protocols[0]?.id ?? null;
  }
  document.querySelector('[data-phase-badge]').textContent = `${status.phase} concluída`;
}

function dashboardTemplate() {
  return `
    <div class="grid cards">
      <article class="card"><span class="eyebrow">SCHEMA</span><div class="metric">${state.status.tableCount}</div><strong>19 tabelas</strong><p>Domínio clínico + controle versionado de migrations.</p></article>
      <article class="card"><span class="eyebrow">PROTOCOLOS</span><div class="metric">${state.protocols.length}</div><strong>Versionamento imutável</strong><p>Versões antigas permanecem preservadas e sem ação de edição.</p></article>
      <article class="card"><span class="eyebrow">SESSÕES</span><div class="metric">${state.sessions.length}</div><strong>Planejado ≠ aplicado</strong><p>Ajustes exigem justificativa profissional registrada.</p></article>
      <article class="card"><span class="eyebrow">AUDITORIA</span><div class="metric">${state.audit.events.length}</div><strong>Auditoria append-only</strong><p>${state.audit.valid ? 'Cadeia íntegra' : 'Integridade comprometida'} por hash encadeado.</p></article>
    </div>
    <div class="card" style="margin-top:16px">
      <div class="section-head"><div><span class="eyebrow">ESTADO ATUAL</span><h2>F0 concluída</h2></div><span class="status ${state.audit.valid ? '' : 'warning'}">${state.audit.valid ? 'Cadeia íntegra' : 'Revisar auditoria'}</span></div>
      <p>A fundação está operando localmente com Node + SQLite. Pacientes e equipamentos abaixo são registros demonstrativos para validar relacionamentos da F0; seus fluxos completos entram nas fases clínicas correspondentes.</p>
      <div class="module-note">Próximo marco: F1 — paciente, anamnese, prontuário/atendimento e histórico clínico completos.</div>
    </div>`;
}

function patientsTemplate() {
  return `<div class="card"><div class="section-head"><div><span class="eyebrow">DOMÍNIO</span><h2>Pacientes</h2></div><span class="status">Estrutura F0</span></div>
    <p class="module-note">A F0 garante identidade e relacionamentos no banco. CRUD clínico completo será aprofundado na F1.</p>
    <div class="table-wrap"><table><thead><tr><th>Paciente</th><th>Observação</th><th>ID</th></tr></thead><tbody>${state.patients.map((patient) => `<tr><td><strong>${esc(patient.fullName)}</strong></td><td>${esc(patient.notes || '—')}</td><td class="code">${esc(patient.id)}</td></tr>`).join('')}</tbody></table></div>
  </div>`;
}

function protocolCard(protocol) {
  const versions = protocol.versions || [];
  return `<article class="version-item" data-protocol-id="${esc(protocol.id)}">
    <header><div><strong>${esc(protocol.title)}</strong><div class="muted">Versão atual: v${esc(protocol.currentVersionNumber)}</div></div><button class="secondary" data-select-protocol="${esc(protocol.id)}">Abrir</button></header>
    <div class="version-list" style="margin-top:10px">${versions.map((version) => `<div><strong>v${version.versionNumber}</strong> — ${esc(version.changeSummary)} <span class="muted">(${esc(version.sourceType)})</span></div>`).join('')}</div>
  </article>`;
}

function protocolsTemplate() {
  const selected = state.protocols.find((item) => item.id === state.selectedProtocolId) || state.protocols[0];
  return `<div class="grid two-column">
    <section class="card"><span class="eyebrow">NOVO PROTOCOLO</span><h2>Registrar protocolo</h2>
      <label>Título<input name="protocol-title" placeholder="Ex.: Dor cervical"></label>
      <label>Resumo da versão inicial<input name="protocol-summary" placeholder="O que esta versão representa"></label>
      <div class="actions"><button class="primary" data-create-protocol>Criar protocolo + v1</button></div></section>
    <section class="card"><span class="eyebrow">NOVA VERSÃO</span><h2>${selected ? esc(selected.title) : 'Selecione um protocolo'}</h2>
      <p class="muted">A versão anterior não é alterada. Uma nova linha é criada e mantida no histórico.</p>
      <label>Resumo da alteração<input name="version-summary" placeholder="Ex.: Ajuste documental"></label>
      <div class="actions"><button class="primary" data-create-version ${selected ? '' : 'disabled'}>Criar nova versão</button></div></section>
    <section class="card" style="grid-column:1/-1"><div class="section-head"><div><span class="eyebrow">BIBLIOTECA</span><h2>Protocolos versionados</h2></div><span class="status">Versionamento imutável</span></div>
      <div class="version-list">${state.protocols.map(protocolCard).join('')}</div></section>
  </div>`;
}

function equipmentTemplate() {
  return `<div class="card"><div class="section-head"><div><span class="eyebrow">DOMÍNIO</span><h2>Equipamentos e aplicadores</h2></div><span class="status">Estrutura F0</span></div>
    <p class="module-note">A F0 já separa equipamento e aplicador. Cadastro avançado, compatibilidade e cálculos por equipamento entram nas fases F2/F3.</p>
    <div class="table-wrap"><table><thead><tr><th>Equipamento</th><th>Aplicador</th><th>Comprimento de onda</th><th>Potência máx.</th></tr></thead><tbody>${state.equipment.map((item) => `<tr><td><strong>${esc(item.manufacturer)} ${esc(item.model)}</strong><div class="muted">${esc(item.serialNumber || '')}</div></td><td>${esc(item.applicator?.name || '—')}</td><td>${item.applicator?.wavelengthNm ? `${esc(item.applicator.wavelengthNm)} nm` : '—'}</td><td>${item.applicator?.maxPowerMw ? `${esc(item.applicator.maxPowerMw)} mW` : '—'}</td></tr>`).join('')}</tbody></table></div>
  </div>`;
}

function sessionsTemplate() {
  const versions = state.protocols.flatMap((protocol) => (protocol.versions || []).map((version) => ({ protocol, version })));
  return `<div class="grid two-column sessions-layout">
    <section class="card"><span class="eyebrow">REGISTRO RASTREÁVEL</span><h2>Nova sessão</h2>
      <label>Versão do protocolo<select name="session-protocol-version">${versions.map(({ protocol, version }) => `<option value="${esc(version.id)}">${esc(protocol.title)} · v${version.versionNumber}</option>`).join('')}</select></label>
      <div class="form-grid"><label>Energia planejada (J)<input type="number" min="0.01" step="0.1" name="planned-energy" value="4"></label><label>Energia aplicada (J)<input type="number" min="0.01" step="0.1" name="applied-energy" value="4"></label></div>
      <label>Motivo profissional do ajuste<input name="adjustment-reason" placeholder="Obrigatório se aplicado ≠ planejado"></label>
      <div class="actions"><button class="primary" data-create-session>Registrar sessão</button></div></section>
    <section class="card"><div class="section-head"><div><span class="eyebrow">HISTÓRICO</span><h2>Sessões registradas</h2></div><span class="status">Planejado ≠ aplicado</span></div>
      <div class="version-list">${state.sessions.length ? state.sessions.map((session) => `<div class="version-item"><header><strong>${esc(session.protocolTitle || 'Sem protocolo')} · v${esc(session.protocolVersionNumber || '—')}</strong><span class="muted">${esc(session.status)}</span></header><div>Planejado: ${esc(session.plannedParameters.energyJ)} J · Aplicado: ${esc(session.appliedParameters.energyJ)} J</div>${session.professionalAdjustmentReason ? `<div><strong>Justificativa:</strong> ${esc(session.professionalAdjustmentReason)}</div>` : ''}</div>`).join('') : '<p class="muted">Nenhuma sessão registrada ainda.</p>'}</div></section>
  </div>`;
}

function auditTemplate() {
  return `<div class="card"><div class="section-head"><div><span class="eyebrow">RASTREABILIDADE</span><h2>Auditoria append-only</h2></div><span class="status ${state.audit.valid ? '' : 'warning'}">${state.audit.valid ? 'Cadeia íntegra' : 'Integridade comprometida'}</span></div>
    <p>Eventos são encadeados por SHA-256. O banco bloqueia UPDATE e DELETE em registros de auditoria.</p>
    <div class="audit-list">${state.audit.events.length ? state.audit.events.slice().reverse().map((event) => `<article class="audit-item"><header><strong>${esc(event.action)}</strong><span class="muted">${esc(event.createdAt)}</span></header><div>${esc(event.entityType)} · <span class="code">${esc(event.entityId)}</span></div><div class="code">hash ${esc(event.eventHash)}</div></article>`).join('') : '<p class="muted">Ações auditáveis aparecerão aqui.</p>'}</div>
  </div>`;
}

function render() {
  navButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.nav === state.currentView));
  const templates = { dashboard: dashboardTemplate, patients: patientsTemplate, protocols: protocolsTemplate, equipment: equipmentTemplate, sessions: sessionsTemplate, audit: auditTemplate };
  view.innerHTML = templates[state.currentView]();
  bindViewActions();
}

async function rerenderFresh(message = '') {
  await refreshAll();
  if (message) showMessage(message, 'success');
  render();
}

function bindViewActions() {
  document.querySelectorAll('[data-select-protocol]').forEach((button) => button.addEventListener('click', () => {
    state.selectedProtocolId = button.dataset.selectProtocol; render();
  }));
  document.querySelector('[data-create-protocol]')?.addEventListener('click', async () => {
    showMessage('');
    const title = document.querySelector('[name="protocol-title"]').value;
    const changeSummary = document.querySelector('[name="protocol-summary"]').value;
    try {
      const result = await api('/api/protocols', { method: 'POST', body: JSON.stringify({ title, changeSummary }) });
      state.selectedProtocolId = result.protocol.id;
      await rerenderFresh('Protocolo criado com versão v1 imutável.');
    } catch (error) { showMessage(error.message); }
  });
  document.querySelector('[data-create-version]')?.addEventListener('click', async () => {
    showMessage('');
    const changeSummary = document.querySelector('[name="version-summary"]').value;
    try {
      await api(`/api/protocols/${encodeURIComponent(state.selectedProtocolId)}/versions`, { method: 'POST', body: JSON.stringify({ changeSummary }) });
      await rerenderFresh('Nova versão criada; versões anteriores permanecem preservadas.');
    } catch (error) { showMessage(error.message); }
  });
  document.querySelector('[data-create-session]')?.addEventListener('click', async () => {
    showMessage('');
    const protocolVersionId = document.querySelector('[name="session-protocol-version"]').value;
    const plannedEnergyJ = Number(document.querySelector('[name="planned-energy"]').value);
    const appliedEnergyJ = Number(document.querySelector('[name="applied-energy"]').value);
    const professionalAdjustmentReason = document.querySelector('[name="adjustment-reason"]').value.trim();
    if (plannedEnergyJ !== appliedEnergyJ && !professionalAdjustmentReason) {
      showMessage('Informe o motivo profissional quando os parâmetros aplicados diferirem dos planejados.'); return;
    }
    try {
      await api('/api/sessions', { method: 'POST', body: JSON.stringify({ protocolVersionId, plannedEnergyJ, appliedEnergyJ, professionalAdjustmentReason }) });
      await rerenderFresh('Sessão registrada com parâmetros planejados e aplicados separados.');
    } catch (error) { showMessage(error.message); }
  });
}

navButtons.forEach((button) => button.addEventListener('click', async () => {
  state.currentView = button.dataset.nav; showMessage(''); await refreshAll(); render();
}));

try {
  await refreshAll(); render(); document.body.dataset.appReady = 'true';
} catch (error) {
  showMessage(`Falha ao inicializar: ${error.message}`);
}
