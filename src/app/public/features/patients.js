import { dialogFrame, emptyState, escapeHtml, fieldMessage, statusBadge } from '../ui/primitives.js';

function normalizeSearch(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

export function filterPatients(patients, query = '', status = 'all') {
  const normalizedQuery = normalizeSearch(query);
  return patients.filter((patient) => {
    const statusMatches = status === 'all' || patient.status === status;
    if (!statusMatches) return false;
    if (!normalizedQuery) return true;
    const haystack = normalizeSearch([
      patient.fullName,
      patient.email,
      patient.phone,
      patient.notes
    ].filter(Boolean).join(' '));
    return haystack.includes(normalizedQuery);
  });
}

export function createPatientsView({ gateway, onOpenPatient, onChanged, onMessage, canOpenPatient = () => true }) {
  const local = { patients: [], query: '', status: 'all', dialogOpen: false, error: '', editingPatient: null };

  async function load() {
    local.patients = await gateway.listPatients();
  }

  function contact(patient) {
    return [patient.email, patient.phone].filter(Boolean).join(' · ') || 'Sem contato informado';
  }

  function patientRows(patients) {
    const clinicalAccess = canOpenPatient();
    return patients.map((patient) => `<tr data-patient-row data-patient-id="${escapeHtml(patient.id)}">
      <td data-label="Paciente">
        ${clinicalAccess
          ? `<button type="button" class="row-link" data-open-patient="${escapeHtml(patient.id)}">${escapeHtml(patient.fullName)}</button>`
          : `<strong>${escapeHtml(patient.fullName)}</strong>`}
        <div class="muted patient-secondary">${escapeHtml(contact(patient))}</div>
      </td>
      <td data-label="Status">${statusBadge(patient.status === 'active' ? 'Ativo' : 'Inativo', patient.status === 'active' ? 'success' : 'neutral')}</td>
      <td data-label="Observação">${escapeHtml(patient.notes || '—')}</td>
      <td data-label="Ação"><div class="actions">${clinicalAccess ? `<button type="button" class="secondary compact-button" data-open-patient="${escapeHtml(patient.id)}" aria-label="Abrir prontuário de ${escapeHtml(patient.fullName)}">Abrir</button>` : ''}<button type="button" class="secondary compact-button" data-edit-patient="${escapeHtml(patient.id)}" aria-label="Editar cadastro de ${escapeHtml(patient.fullName)}">Editar</button></div></td>
    </tr>`).join('');
  }

  function createDialog() {
    if (!local.dialogOpen) return '';
    const patient = local.editingPatient || {};
    const editing = Boolean(local.editingPatient);
    const body = `<form data-patient-form novalidate>
      <label for="patient-name">Nome <span aria-hidden="true">*</span>
        <input id="patient-name" name="patient-name" autocomplete="name" aria-required="true" aria-invalid="${local.error ? 'true' : 'false'}" value="${escapeHtml(patient.fullName || '')}">
        ${fieldMessage(local.error)}
      </label>
      <div class="form-grid">
        <label for="patient-email">E-mail<input id="patient-email" name="patient-email" type="email" autocomplete="email" value="${escapeHtml(patient.email || '')}"></label>
        <label for="patient-phone">Telefone<input id="patient-phone" name="patient-phone" autocomplete="tel" value="${escapeHtml(patient.phone || '')}"></label>
        <label for="patient-birth-date">Nascimento<input id="patient-birth-date" name="patient-birth-date" type="date" value="${escapeHtml(patient.birthDate || '')}"></label>
        <label for="patient-document">Documento<input id="patient-document" name="patient-document" value="${escapeHtml(patient.documentNumber || '')}"></label>
        <label for="patient-emergency">Contato de emergência<input id="patient-emergency" name="patient-emergency" value="${escapeHtml(patient.emergencyContact || '')}"></label>
      </div>
      <label for="patient-notes">Observações<textarea id="patient-notes" name="patient-notes" placeholder="Notas administrativas ou contexto inicial">${escapeHtml(patient.notes || '')}</textarea></label>
    </form>`;
    const footer = `<button type="button" class="secondary" data-patient-cancel>Cancelar</button><button type="button" class="primary" data-patient-save>${editing ? 'Salvar alterações' : 'Salvar paciente'}</button>`;
    return dialogFrame({
      title: editing ? 'Editar paciente' : 'Novo paciente',
      description: editing ? 'Atualize os dados demográficos e administrativos do cadastro.' : 'O cadastro é persistido localmente no banco clínico.',
      body,
      footer,
      testId: 'patient-create-dialog'
    });
  }

  function render() {
    const allPatients = local.patients;
    const patients = filterPatients(allPatients, local.query, local.status);
    const content = patients.length
      ? `<div class="table-wrap patient-table-wrap"><table class="patient-table"><thead><tr><th>Paciente</th><th>Status</th><th>Observação</th><th>Ação</th></tr></thead><tbody>${patientRows(patients)}</tbody></table></div>`
      : emptyState({ title: 'Nenhum paciente encontrado', description: 'Ajuste os filtros ou limpe a busca para visualizar novamente os pacientes.', actionLabel: 'Limpar busca', action: 'data-clear-patient-search' });

    return `<div class="page-stack" data-patients-view>
      <div class="page-heading">
        <div><span class="eyebrow">PACIENTES</span><h1>Pacientes</h1><p>Cadastro administrativo persistido. O acesso ao prontuário clínico depende da permissão do perfil.</p></div>
        <button type="button" class="primary" data-new-patient>Novo paciente</button>
      </div>
      <section class="card patient-directory">
        <div class="patient-toolbar">
          <label class="search-control" for="patient-search"><span class="visually-hidden">Buscar pacientes</span><input id="patient-search" type="search" aria-label="Buscar pacientes" placeholder="Buscar por nome, contato ou observação" value="${escapeHtml(local.query)}" data-patient-search></label>
          <label class="status-filter" for="patient-status"><span>Status</span><select id="patient-status" aria-label="Filtrar status" data-patient-status><option value="all" ${local.status === 'all' ? 'selected' : ''}>Todos</option><option value="active" ${local.status === 'active' ? 'selected' : ''}>Ativos</option><option value="inactive" ${local.status === 'inactive' ? 'selected' : ''}>Inativos</option></select></label>
          <span class="status-badge status-info">${patients.length} de ${allPatients.length}</span>
        </div>
        ${content}
      </section>
      ${createDialog()}
    </div>`;
  }

  function rerender() { onChanged?.(); }

  function focusSearch(root, cursor = local.query.length) {
    const nextSearch = root.querySelector('[data-patient-search]');
    if (!nextSearch) return;
    nextSearch.focus();
    if (typeof nextSearch.setSelectionRange === 'function') {
      const safeCursor = Math.max(0, Math.min(Number(cursor) || 0, nextSearch.value.length));
      nextSearch.setSelectionRange(safeCursor, safeCursor);
    }
  }

  function closeDialog() {
    local.dialogOpen = false;
    local.editingPatient = null;
    local.error = '';
    rerender();
  }

  function openEdit(patientId) {
    local.editingPatient = local.patients.find((patient) => patient.id === patientId) || null;
    local.dialogOpen = Boolean(local.editingPatient);
    local.error = '';
    rerender();
  }

  function formPayload(root) {
    return {
      fullName: root.querySelector('[name="patient-name"]')?.value ?? '',
      email: root.querySelector('[name="patient-email"]')?.value ?? '',
      phone: root.querySelector('[name="patient-phone"]')?.value ?? '',
      birthDate: root.querySelector('[name="patient-birth-date"]')?.value ?? '',
      documentNumber: root.querySelector('[name="patient-document"]')?.value ?? '',
      emergencyContact: root.querySelector('[name="patient-emergency"]')?.value ?? '',
      notes: root.querySelector('[name="patient-notes"]')?.value ?? ''
    };
  }

  function bindActions(root = document) {
    root.querySelector('[data-patient-search]')?.addEventListener('input', (event) => {
      const cursor = event.currentTarget.selectionStart ?? event.currentTarget.value.length;
      local.query = event.currentTarget.value;
      rerender();
      focusSearch(root, cursor);
    });
    root.querySelector('[data-patient-status]')?.addEventListener('change', (event) => { local.status = event.currentTarget.value; rerender(); });
    root.querySelector('[data-clear-patient-search]')?.addEventListener('click', () => { local.query = ''; local.status = 'all'; rerender(); focusSearch(root, 0); });
    root.querySelector('[data-new-patient]')?.addEventListener('click', () => { local.dialogOpen = true; local.editingPatient = null; local.error = ''; rerender(); });
    root.querySelectorAll('[data-open-patient]').forEach((button) => button.addEventListener('click', () => onOpenPatient?.(button.dataset.openPatient)));
    root.querySelectorAll('[data-edit-patient]').forEach((button) => button.addEventListener('click', () => openEdit(button.dataset.editPatient)));
    root.querySelector('[data-dialog-close]')?.addEventListener('click', closeDialog);
    root.querySelector('[data-patient-cancel]')?.addEventListener('click', closeDialog);
    root.querySelector('[data-dialog-backdrop]')?.addEventListener('mousedown', (event) => { if (event.target === event.currentTarget) closeDialog(); });
    root.querySelector('[data-patient-save]')?.addEventListener('click', async () => {
      const payload = formPayload(root);
      if (!payload.fullName.trim()) {
        local.error = 'Informe o nome do paciente.';
        rerender();
        return;
      }
      try {
        const editing = local.editingPatient;
        const saved = editing ? await gateway.updatePatient(editing.id, payload) : await gateway.createPatient(payload);
        await load();
        local.dialogOpen = false;
        local.editingPatient = null;
        local.error = '';
        local.query = '';
        local.status = 'all';
        onMessage?.(editing ? `Cadastro de ${saved.fullName} atualizado.` : `Paciente ${saved.fullName} cadastrado.`, 'success');
        rerender();
      } catch (error) {
        local.error = error.message;
        rerender();
      }
    });
  }

  return { load, render, bindActions };
}
