import { assertUiProvider } from '../data/contracts.js';
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

export function createPatientsView({ provider, onOpenPatient, onChanged, onMessage }) {
  assertUiProvider(provider);
  const local = { query: '', status: 'all', dialogOpen: false, error: '' };

  function patientRows(patients) {
    return patients.map((patient) => `<tr data-patient-row>
      <td data-label="Paciente">
        <button type="button" class="row-link" data-open-patient="${escapeHtml(patient.id)}">${escapeHtml(patient.fullName)}</button>
        <div class="muted patient-secondary">${escapeHtml(patient.email || patient.phone || 'Sem contato informado')}</div>
      </td>
      <td data-label="Status">${statusBadge(patient.status === 'active' ? 'Ativo' : 'Inativo', patient.status === 'active' ? 'success' : 'neutral')}</td>
      <td data-label="Observação">${escapeHtml(patient.notes || '—')}</td>
      <td data-label="Ação"><button type="button" class="secondary compact-button" data-open-patient="${escapeHtml(patient.id)}">Abrir</button></td>
    </tr>`).join('');
  }

  function createDialog() {
    if (!local.dialogOpen) return '';
    const body = `<form data-patient-form novalidate>
      <label for="patient-name">Nome <span aria-hidden="true">*</span>
        <input id="patient-name" name="patient-name" autocomplete="name" aria-required="true" aria-invalid="${local.error ? 'true' : 'false'}">
        ${fieldMessage(local.error)}
      </label>
      <div class="form-grid">
        <label for="patient-email">E-mail<input id="patient-email" name="patient-email" type="email" autocomplete="email"></label>
        <label for="patient-phone">Telefone<input id="patient-phone" name="patient-phone" autocomplete="tel"></label>
      </div>
      <label for="patient-notes">Observações<textarea id="patient-notes" name="patient-notes" placeholder="Notas administrativas ou contexto inicial"></textarea></label>
    </form>`;
    const footer = `<button type="button" class="secondary" data-patient-cancel>Cancelar</button><button type="button" class="primary" data-patient-save>Salvar paciente</button>`;
    return dialogFrame({
      title: 'Novo paciente',
      description: 'Cadastro local de interface. Ainda não persiste no backend clínico.',
      body,
      footer,
      testId: 'patient-create-dialog'
    });
  }

  function render() {
    const allPatients = provider.listPatients();
    const patients = filterPatients(allPatients, local.query, local.status);
    const content = patients.length
      ? `<div class="table-wrap patient-table-wrap"><table class="patient-table"><thead><tr><th>Paciente</th><th>Status</th><th>Observação</th><th>Ação</th></tr></thead><tbody>${patientRows(patients)}</tbody></table></div>`
      : emptyState({
          title: 'Nenhum paciente encontrado',
          description: 'Ajuste os filtros ou limpe a busca para visualizar novamente os pacientes.',
          actionLabel: 'Limpar busca',
          action: 'data-clear-patient-search'
        });

    return `<div class="page-stack" data-patients-view>
      <div class="page-heading">
        <div><span class="eyebrow">PACIENTES</span><h1>Pacientes</h1><p>Busca, cadastro local e acesso ao contexto clínico sem depender da persistência F1.</p></div>
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

  function rerender() {
    onChanged?.();
  }

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
    local.error = '';
    rerender();
  }

  function bindActions(root = document) {
    root.querySelector('[data-patient-search]')?.addEventListener('input', (event) => {
      const cursor = event.currentTarget.selectionStart ?? event.currentTarget.value.length;
      local.query = event.currentTarget.value;
      rerender();
      focusSearch(root, cursor);
    });
    root.querySelector('[data-patient-status]')?.addEventListener('change', (event) => {
      local.status = event.currentTarget.value;
      rerender();
    });
    root.querySelector('[data-clear-patient-search]')?.addEventListener('click', () => {
      local.query = '';
      local.status = 'all';
      rerender();
      focusSearch(root, 0);
    });
    root.querySelector('[data-new-patient]')?.addEventListener('click', () => {
      local.dialogOpen = true;
      local.error = '';
      rerender();
      root.querySelector('[name="patient-name"]')?.focus();
    });
    root.querySelectorAll('[data-open-patient]').forEach((button) => button.addEventListener('click', () => {
      onOpenPatient?.(button.dataset.openPatient);
    }));
    root.querySelector('[data-dialog-close]')?.addEventListener('click', closeDialog);
    root.querySelector('[data-patient-cancel]')?.addEventListener('click', closeDialog);
    root.querySelector('[data-dialog-backdrop]')?.addEventListener('mousedown', (event) => {
      if (event.target === event.currentTarget) closeDialog();
    });
    root.querySelector('[data-patient-save]')?.addEventListener('click', () => {
      const fullName = root.querySelector('[name="patient-name"]')?.value ?? '';
      if (!fullName.trim()) {
        local.error = 'Informe o nome do paciente.';
        rerender();
        root.querySelector('[name="patient-name"]')?.focus();
        return;
      }
      const created = provider.createPatient({
        fullName,
        email: root.querySelector('[name="patient-email"]')?.value ?? '',
        phone: root.querySelector('[name="patient-phone"]')?.value ?? '',
        notes: root.querySelector('[name="patient-notes"]')?.value ?? ''
      });
      local.dialogOpen = false;
      local.error = '';
      local.query = '';
      local.status = 'all';
      onMessage?.(`Paciente ${created.fullName} adicionado somente ao ambiente de interface.`, 'success');
      rerender();
    });
  }

  return { render, bindActions };
}
