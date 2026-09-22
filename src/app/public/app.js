const state = {
  auth: { setupRequired: false, authenticated: false, user: null }, authError: '',
  currentView: 'dashboard', status: null, patients: [], equipment: [], protocols: [], sessions: [],
  openEncounters: [], audit: { valid: true, events: [] }, selectedProtocolId: null,
  selectedPatientId: null, patientWorkspace: null
};

const authRoot = document.querySelector('#auth-root');
const appShell = document.querySelector('#app-shell');
const view = document.querySelector('#view');
const flash = document.querySelector('#flash');
const navButtons = Array.from(document.querySelectorAll('[data-nav]'));

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

function showMessage(message, kind = 'warning') {
  flash.hidden = !message;
  flash.textContent = message || '';
  flash.dataset.kind = kind;
}

function authTemplate() {
  if (state.auth.setupRequired) {
    return `<section class="auth-card" data-auth-setup>
      <span class="eyebrow">PRIMEIRO ACESSO</span>
      <h1>Configure o acesso local</h1>
      <p>Crie a primeira conta profissional. Credenciais e sessões ficam no SQLite local.</p>
      ${state.authError ? `<div class="auth-error">${esc(state.authError)}</div>` : ''}
      <label>Nome do profissional<input name="setup-name" autocomplete="name"></label>
      <label>E-mail<input type="email" name="setup-email" autocomplete="username"></label>
      <label>Senha<input type="password" name="setup-password" autocomplete="new-password"></label>
      <button class="primary full" data-setup-submit>Configurar e entrar</button>
      <small class="muted">Core R$ 0 · self-hosted · sem provedor externo obrigatório.</small>
    </section>`;
  }
  return `<section class="auth-card" data-auth-login>
    <span class="eyebrow">ACESSO PROFISSIONAL</span>
    <h1>Entrar no workspace clínico</h1>
    <p>Use a conta local configurada neste banco.</p>
    ${state.authError ? `<div class="auth-error">${esc(state.authError)}</div>` : ''}
    <label>E-mail<input type="email" name="login-email" autocomplete="username"></label>
    <label>Senha<input type="password" name="login-password" autocomplete="current-password"></label>
    <button class="primary full" data-login-submit>Entrar</button>
  </section>`;
}

function renderAuth() {
  appShell.hidden = true;
  document.body.removeAttribute('data-app-ready');
  authRoot.hidden = false;
  authRoot.innerHTML = authTemplate();

  document.querySelector('[data-setup-submit]')?.addEventListener('click', async () => {
    state.authError = '';
    try {
      const result = await api('/api/auth/setup', {
        method: 'POST', body: JSON.stringify({
          name: document.querySelector('[name="setup-name"]').value,
          email: document.querySelector('[name="setup-email"]').value,
          password: document.querySelector('[name="setup-password"]').value
        })
      });
      state.auth = { setupRequired: false, authenticated: true, user: result.user };
      await launchApp();
    } catch (error) { state.authError = error.message; renderAuth(); }
  });

  document.querySelector('[data-login-submit]')?.addEventListener('click', async () => {
    state.authError = '';
    try {
      const result = await api('/api/auth/login', {
        method: 'POST', body: JSON.stringify({
          email: document.querySelector('[name="login-email"]').value,
          password: document.querySelector('[name="login-password"]').value
        })
      });
      state.auth = { setupRequired: false, authenticated: true, user: result.user };
      await launchApp();
    } catch (error) { state.authError = error.message; renderAuth(); }
  });
}

async function refreshAll() {
  const [status, patients, equipment, protocols, sessions, encounters, audit] = await Promise.all([
    api('/api/status'), api('/api/patients'), api('/api/equipment'), api('/api/protocols'),
    api('/api/sessions'), api('/api/encounters/open'), api('/api/audit')
  ]);
  state.status = status;
  state.patients = patients.patients;
  state.equipment = equipment.equipment;
  state.protocols = protocols.protocols;
  state.sessions = sessions.sessions;
  state.openEncounters = encounters.encounters;
  state.audit = audit;
  if (!state.selectedProtocolId || !state.protocols.some((item) => item.id === state.selectedProtocolId)) {
    state.selectedProtocolId = state.protocols[0]?.id ?? null;
  }
  document.querySelector('[data-phase-badge]').textContent = `${status.phase} concluída`;
}

async function loadPatientWorkspace(patientId) {
  state.selectedPatientId = patientId;
  state.patientWorkspace = await api(`/api/patients/${encodeURIComponent(patientId)}/workspace`);
}

function dashboardTemplate() {
  return `<div class="grid cards">
    <article class="card"><span class="eyebrow">SCHEMA</span><div class="metric">${state.status.tableCount}</div><strong>${state.status.tableCount} tabelas</strong><p>Domínio clínico, autenticação local e migrations versionadas.</p></article>
    <article class="card"><span class="eyebrow">PACIENTES</span><div class="metric">${state.status.patientCount}</div><strong>Workspace longitudinal</strong><p>Cadastro, anamnese, atendimentos e sessões vinculados ao paciente.</p></article>
    <article class="card"><span class="eyebrow">PROTOCOLOS</span><div class="metric">${state.protocols.length}</div><strong>Versionamento imutável</strong><p>Versões antigas permanecem preservadas e sem ação de edição.</p></article>
    <article class="card"><span class="eyebrow">SESSÕES</span><div class="metric">${state.sessions.length}</div><strong>Planejado ≠ aplicado</strong><p>Ajustes exigem justificativa profissional registrada.</p></article>
  </div>
  <div class="card dashboard-audit">
    <div class="section-head"><div><span class="eyebrow">RASTREABILIDADE</span><h2>F1 concluída</h2></div><span class="status ${state.audit.valid ? '' : 'warning'}">${state.audit.valid ? 'Cadeia íntegra' : 'Revisar auditoria'}</span></div>
    <strong>Auditoria append-only</strong><p>Eventos clínicos permanecem encadeados por hash e associados ao profissional autenticado.</p>
  </div>`;
}

function patientRows() {
  if (!state.patients.length) return '<p class="muted">Nenhum paciente ativo.</p>';
  return `<div class="table-wrap"><table><thead><tr><th>Paciente</th><th>Contato</th><th>Observação</th><th></th></tr></thead><tbody>
    ${state.patients.map((patient) => `<tr data-patient-row><td><strong>${esc(patient.fullName)}</strong><div class="muted">${esc(patient.birthDate || 'Sem data de nascimento')}</div></td><td>${esc(patient.phone || '—')}<div class="muted">${esc(patient.email || '')}</div></td><td>${esc(patient.notes || '—')}</td><td><button class="secondary" data-open-patient="${esc(patient.id)}">Abrir</button></td></tr>`).join('')}
  </tbody></table></div>`;
}

function encounterCard(encounter, assessments) {
  const assessment = assessments.find((item) => item.id === encounter.assessmentId);
  const isOpen = encounter.status === 'open';
  return `<article class="timeline-item">
    <header><div><strong>${isOpen ? 'Atendimento aberto' : 'Atendimento finalizado'}</strong><div class="muted">${esc(encounter.startedAt)}</div></div>${isOpen ? `<button class="secondary" data-finalize-encounter="${esc(encounter.id)}">Finalizar atendimento</button>` : '<span class="status">Finalizado</span>'}</header>
    <div class="timeline-body">
      <strong>${esc(assessment?.chiefComplaint || 'Sem queixa principal')}</strong>
      ${assessment?.painScore != null ? `<span class="pill">Dor ${esc(assessment.painScore)}/10</span>` : ''}
      ${assessment?.history ? `<p>${esc(assessment.history)}</p>` : ''}
      ${encounter.notes ? `<p><strong>Notas:</strong> ${esc(encounter.notes)}</p>` : ''}
    </div>
  </article>`;
}

function patientWorkspaceTemplate() {
  const workspace = state.patientWorkspace;
  if (!workspace) return '';
  const patient = workspace.patient;
  const openEncounter = workspace.encounters.find((item) => item.status === 'open');
  return `<div data-patient-workspace class="stack">
    <section class="card">
      <div class="section-head"><div><span class="eyebrow">PACIENTE</span><h2>${esc(patient.fullName)}</h2><p class="workspace-note">${esc(patient.notes || 'Sem observações cadastrais')}</p></div><button class="secondary" data-back-patients>Voltar à lista</button></div>
      <div class="form-grid">
        <label>Nome<input name="workspace-patient-name" value="${esc(patient.fullName)}"></label>
        <label>Data de nascimento<input type="date" name="workspace-patient-birth-date" value="${esc(patient.birthDate || '')}"></label>
        <label>E-mail<input type="email" name="workspace-patient-email" value="${esc(patient.email || '')}"></label>
        <label>Telefone<input name="workspace-patient-phone" value="${esc(patient.phone || '')}"></label>
      </div>
      <label>Observações<textarea name="workspace-patient-notes">${esc(patient.notes || '')}</textarea></label>
      <div class="actions"><button class="primary" data-update-patient>Salvar cadastro</button></div>
    </section>

    <section class="card">
      <div class="section-head"><div><span class="eyebrow">ANAMNESE + PRONTUÁRIO</span><h2>${openEncounter ? 'Atendimento em andamento' : 'Iniciar atendimento'}</h2></div>${openEncounter ? '<span class="status warning">Atendimento aberto</span>' : ''}</div>
      ${openEncounter ? '<p class="module-note">Finalize o atendimento aberto antes de iniciar outro.</p>' : `<div class="form-grid">
        <label>Queixa principal<input name="encounter-chief-complaint"></label>
        <label>Escore de dor (0–10)<input type="number" min="0" max="10" name="encounter-pain-score"></label>
        <label class="wide">História<textarea name="encounter-history"></textarea></label>
        <label>Medicações<input name="encounter-medications"></label>
        <label>Alergias<input name="encounter-allergies"></label>
        <label class="wide">Precauções<input name="encounter-precautions"></label>
        <label class="wide">Notas do atendimento<textarea name="encounter-notes"></textarea></label>
      </div><div class="actions"><button class="primary" data-start-encounter>Registrar anamnese e iniciar atendimento</button></div>`}
    </section>

    <section class="card">
      <div class="section-head"><div><span class="eyebrow">HISTÓRICO CLÍNICO</span><h2>Linha do tempo</h2></div><span class="status">${workspace.timeline.length} eventos</span></div>
      <div class="timeline-list">
        ${workspace.encounters.map((item) => encounterCard(item, workspace.assessments)).join('')}
        ${workspace.sessions.map((session) => `<article class="timeline-item"><header><strong>Sessão PBM · ${esc(session.protocolTitle || 'Sem protocolo')}</strong><span class="muted">${esc(session.startedAt)}</span></header><div class="timeline-body"><div>Planejado: ${esc(session.plannedParameters.energyJ)} J · <strong>Aplicado: ${esc(session.appliedParameters.energyJ)} J</strong></div>${session.professionalAdjustmentReason ? `<p><strong>Justificativa:</strong> ${esc(session.professionalAdjustmentReason)}</p>` : ''}</div></article>`).join('')}
        ${workspace.encounters.length || workspace.sessions.length ? '' : '<p class="muted">Nenhum atendimento registrado.</p>'}
      </div>
    </section>
  </div>`;
}

function patientsTemplate() {
  if (state.selectedPatientId && state.patientWorkspace) return patientWorkspaceTemplate();
  return `<div class="grid patient-layout">
    <section class="card"><span class="eyebrow">NOVO PACIENTE</span><h2>Cadastrar paciente</h2>
      <div class="form-grid">
        <label>Nome<input name="patient-name"></label>
        <label>Data de nascimento<input type="date" name="patient-birth-date"></label>
        <label>E-mail<input type="email" name="patient-email"></label>
        <label>Telefone<input name="patient-phone"></label>
        <label class="wide">Observações<textarea name="patient-notes"></textarea></label>
      </div>
      <div class="actions"><button class="primary" data-create-patient>Criar paciente</button></div>
    </section>
    <section class="card"><div class="section-head"><div><span class="eyebrow">PACIENTES ATIVOS</span><h2>Lista clínica</h2></div><span class="status">${state.patients.length}</span></div>${patientRows()}</section>
  </div>`;
}

function protocolCard(protocol) {
  return `<article class="version-item"><header><div><strong>${esc(protocol.title)}</strong><div class="muted">Versão atual: v${esc(protocol.currentVersionNumber)}</div></div><button class="secondary" data-select-protocol="${esc(protocol.id)}">Abrir</button></header>
    <div class="version-list inner">${(protocol.versions || []).map((version) => `<div><strong>v${version.versionNumber}</strong> — ${esc(version.changeSummary)} <span class="muted">(${esc(version.sourceType)})</span></div>`).join('')}</div></article>`;
}

function protocolsTemplate() {
  const selected = state.protocols.find((item) => item.id === state.selectedProtocolId) || state.protocols[0];
  return `<div class="grid two-column">
    <section class="card"><span class="eyebrow">NOVO PROTOCOLO</span><h2>Registrar protocolo</h2>
      <label>Título<input name="protocol-title"></label><label>Resumo da versão inicial<input name="protocol-summary"></label>
      <div class="actions"><button class="primary" data-create-protocol>Criar protocolo + v1</button></div></section>
    <section class="card"><span class="eyebrow">NOVA VERSÃO</span><h2>${selected ? esc(selected.title) : 'Selecione um protocolo'}</h2>
      <p class="muted">A versão anterior não é alterada. Uma nova linha é criada e mantida no histórico.</p>
      <label>Resumo da alteração<input name="version-summary"></label>
      <div class="actions"><button class="primary" data-create-version ${selected ? '' : 'disabled'}>Criar nova versão</button></div></section>
    <section class="card wide"><div class="section-head"><div><span class="eyebrow">BIBLIOTECA</span><h2>Protocolos versionados</h2></div><span class="status">Versionamento imutável</span></div>
      <div class="version-list">${state.protocols.map(protocolCard).join('')}</div></section>
  </div>`;
}

function equipmentTemplate() {
  return `<div class="card"><div class="section-head"><div><span class="eyebrow">DOMÍNIO</span><h2>Equipamentos e aplicadores</h2></div><span class="status">Base validada</span></div>
    <div class="table-wrap"><table><thead><tr><th>Equipamento</th><th>Aplicador</th><th>Comprimento de onda</th><th>Potência máx.</th></tr></thead><tbody>${state.equipment.map((item) => `<tr><td><strong>${esc(item.manufacturer)} ${esc(item.model)}</strong><div class="muted">${esc(item.serialNumber || '')}</div></td><td>${esc(item.applicator?.name || '—')}</td><td>${item.applicator?.wavelengthNm ? `${esc(item.applicator.wavelengthNm)} nm` : '—'}</td><td>${item.applicator?.maxPowerMw ? `${esc(item.applicator.maxPowerMw)} mW` : '—'}</td></tr>`).join('')}</tbody></table></div>
  </div>`;
}

function sessionsTemplate() {
  const versions = state.protocols.flatMap((protocol) => (protocol.versions || []).map((version) => ({ protocol, version })));
  return `<div class="grid two-column sessions-layout">
    <section class="card"><span class="eyebrow">REGISTRO RASTREÁVEL</span><h2>Nova sessão PBM</h2>
      <label>Atendimento aberto<select name="session-encounter">${state.openEncounters.map((encounter) => `<option value="${esc(encounter.id)}">${esc(encounter.patientName)} · ${esc(encounter.startedAt)}</option>`).join('')}</select></label>
      <label>Versão do protocolo<select name="session-protocol-version">${versions.map(({ protocol, version }) => `<option value="${esc(version.id)}">${esc(protocol.title)} · v${version.versionNumber}</option>`).join('')}</select></label>
      <div class="form-grid"><label>Energia planejada (J)<input type="number" min="0.01" step="0.1" name="planned-energy" value="4"></label><label>Energia aplicada (J)<input type="number" min="0.01" step="0.1" name="applied-energy" value="4"></label></div>
      <label>Motivo profissional do ajuste<input name="adjustment-reason" placeholder="Obrigatório se aplicado ≠ planejado"></label>
      <div class="actions"><button class="primary" data-create-session ${state.openEncounters.length && versions.length ? '' : 'disabled'}>Registrar sessão</button></div>
      ${state.openEncounters.length ? '' : '<p class="module-note">Abra um atendimento no workspace do paciente antes de registrar a sessão.</p>'}
    </section>
    <section class="card"><div class="section-head"><div><span class="eyebrow">HISTÓRICO</span><h2>Sessões registradas</h2></div><span class="status">Planejado ≠ aplicado</span></div>
      <div class="version-list">${state.sessions.length ? state.sessions.map((session) => `<div class="version-item"><header><strong>${esc(session.patientName || 'Paciente')} · ${esc(session.protocolTitle || 'Sem protocolo')} · v${esc(session.protocolVersionNumber || '—')}</strong><span class="muted">${esc(session.status)}</span></header><div>Planejado: ${esc(session.plannedParameters.energyJ)} J · Aplicado: ${esc(session.appliedParameters.energyJ)} J</div>${session.professionalAdjustmentReason ? `<div><strong>Justificativa:</strong> ${esc(session.professionalAdjustmentReason)}</div>` : ''}</div>`).join('') : '<p class="muted">Nenhuma sessão registrada ainda.</p>'}</div></section>
  </div>`;
}

function auditTemplate() {
  return `<div class="card"><div class="section-head"><div><span class="eyebrow">RASTREABILIDADE</span><h2>Auditoria append-only</h2></div><span class="status ${state.audit.valid ? '' : 'warning'}">${state.audit.valid ? 'Cadeia íntegra' : 'Integridade comprometida'}</span></div>
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
  if (state.selectedPatientId) await loadPatientWorkspace(state.selectedPatientId);
  if (message) showMessage(message, 'success');
  render();
}

function bindViewActions() {
  document.querySelector('[data-create-patient]')?.addEventListener('click', async () => {
    showMessage('');
    try {
      const result = await api('/api/patients', { method: 'POST', body: JSON.stringify({
        fullName: document.querySelector('[name="patient-name"]').value,
        birthDate: document.querySelector('[name="patient-birth-date"]').value,
        email: document.querySelector('[name="patient-email"]').value,
        phone: document.querySelector('[name="patient-phone"]').value,
        notes: document.querySelector('[name="patient-notes"]').value
      }) });
      await refreshAll();
      await loadPatientWorkspace(result.patient.id);
      showMessage('Paciente criado e workspace clínico aberto.', 'success');
      render();
    } catch (error) { showMessage(error.message); }
  });

  document.querySelectorAll('[data-open-patient]').forEach((button) => button.addEventListener('click', async () => {
    try { await loadPatientWorkspace(button.dataset.openPatient); showMessage(''); render(); }
    catch (error) { showMessage(error.message); }
  }));

  document.querySelector('[data-back-patients]')?.addEventListener('click', () => {
    state.selectedPatientId = null; state.patientWorkspace = null; showMessage(''); render();
  });

  document.querySelector('[data-update-patient]')?.addEventListener('click', async () => {
    try {
      await api(`/api/patients/${encodeURIComponent(state.selectedPatientId)}`, { method: 'PATCH', body: JSON.stringify({
        fullName: document.querySelector('[name="workspace-patient-name"]').value,
        birthDate: document.querySelector('[name="workspace-patient-birth-date"]').value,
        email: document.querySelector('[name="workspace-patient-email"]').value,
        phone: document.querySelector('[name="workspace-patient-phone"]').value,
        notes: document.querySelector('[name="workspace-patient-notes"]').value
      }) });
      await rerenderFresh('Cadastro do paciente atualizado.');
    } catch (error) { showMessage(error.message); }
  });

  document.querySelector('[data-start-encounter]')?.addEventListener('click', async () => {
    try {
      await api(`/api/patients/${encodeURIComponent(state.selectedPatientId)}/encounters`, { method: 'POST', body: JSON.stringify({
        notes: document.querySelector('[name="encounter-notes"]').value,
        assessment: {
          chiefComplaint: document.querySelector('[name="encounter-chief-complaint"]').value,
          history: document.querySelector('[name="encounter-history"]').value,
          medications: document.querySelector('[name="encounter-medications"]').value,
          allergies: document.querySelector('[name="encounter-allergies"]').value,
          precautions: document.querySelector('[name="encounter-precautions"]').value,
          painScore: document.querySelector('[name="encounter-pain-score"]').value
        }
      }) });
      await rerenderFresh('Anamnese registrada e atendimento aberto.');
    } catch (error) { showMessage(error.message); }
  });

  document.querySelectorAll('[data-finalize-encounter]').forEach((button) => button.addEventListener('click', async () => {
    try {
      await api(`/api/encounters/${encodeURIComponent(button.dataset.finalizeEncounter)}/finalize`, { method: 'POST', body: '{}' });
      await rerenderFresh('Atendimento finalizado.');
    } catch (error) { showMessage(error.message); }
  }));

  document.querySelectorAll('[data-select-protocol]').forEach((button) => button.addEventListener('click', () => {
    state.selectedProtocolId = button.dataset.selectProtocol; render();
  }));

  document.querySelector('[data-create-protocol]')?.addEventListener('click', async () => {
    try {
      const result = await api('/api/protocols', { method: 'POST', body: JSON.stringify({
        title: document.querySelector('[name="protocol-title"]').value,
        changeSummary: document.querySelector('[name="protocol-summary"]').value
      }) });
      state.selectedProtocolId = result.protocol.id;
      await rerenderFresh('Protocolo criado com versão v1 imutável.');
    } catch (error) { showMessage(error.message); }
  });

  document.querySelector('[data-create-version]')?.addEventListener('click', async () => {
    try {
      await api(`/api/protocols/${encodeURIComponent(state.selectedProtocolId)}/versions`, { method: 'POST', body: JSON.stringify({ changeSummary: document.querySelector('[name="version-summary"]').value }) });
      await rerenderFresh('Nova versão criada; versões anteriores permanecem preservadas.');
    } catch (error) { showMessage(error.message); }
  });

  document.querySelector('[data-create-session]')?.addEventListener('click', async () => {
    const plannedEnergyJ = Number(document.querySelector('[name="planned-energy"]').value);
    const appliedEnergyJ = Number(document.querySelector('[name="applied-energy"]').value);
    const professionalAdjustmentReason = document.querySelector('[name="adjustment-reason"]').value.trim();
    if (plannedEnergyJ !== appliedEnergyJ && !professionalAdjustmentReason) {
      showMessage('Informe o motivo profissional quando os parâmetros aplicados diferirem dos planejados.'); return;
    }
    try {
      await api('/api/sessions', { method: 'POST', body: JSON.stringify({
        encounterId: document.querySelector('[name="session-encounter"]').value,
        protocolVersionId: document.querySelector('[name="session-protocol-version"]').value,
        plannedEnergyJ, appliedEnergyJ, professionalAdjustmentReason
      }) });
      await rerenderFresh('Sessão registrada com parâmetros planejados e aplicados separados.');
    } catch (error) { showMessage(error.message); }
  });
}

navButtons.forEach((button) => button.addEventListener('click', async () => {
  state.currentView = button.dataset.nav;
  state.selectedPatientId = null;
  state.patientWorkspace = null;
  showMessage('');
  await refreshAll();
  render();
}));

document.querySelector('[data-logout]').addEventListener('click', async () => {
  try { await api('/api/auth/logout', { method: 'POST', body: '{}' }); } catch {}
  state.auth = { setupRequired: false, authenticated: false, user: null };
  state.authError = '';
  renderAuth();
});

async function launchApp() {
  authRoot.hidden = true;
  appShell.hidden = false;
  document.querySelector('[data-auth-user]').textContent = state.auth.user?.name || state.auth.user?.email || 'Profissional';
  await refreshAll();
  render();
  document.body.dataset.appReady = 'true';
}

async function boot() {
  try {
    state.auth = await api('/api/auth/status');
    if (state.auth.authenticated) await launchApp();
    else renderAuth();
  } catch (error) {
    state.authError = `Falha ao inicializar: ${error.message}`;
    renderAuth();
  }
}

await boot();
