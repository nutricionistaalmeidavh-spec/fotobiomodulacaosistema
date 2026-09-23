import { emptyState, escapeHtml, statusBadge } from '../ui/primitives.js';

const STATUS_LABELS = Object.freeze({
  scheduled: 'Agendado',
  completed: 'Concluído',
  cancelled: 'Cancelado'
});

function localDateTime(value) {
  const raw = String(value || '');
  if (!raw) return '—';
  const [date, time = ''] = raw.split('T');
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}${time ? ` · ${time.slice(0, 5)}` : ''}`;
}

function defaultStartsAt() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
  return date.toISOString().slice(0, 16);
}

export function createAgendaView({ gateway, onOpenPatient, onChanged, onMessage }) {
  const local = { items: [], patients: [], filters: { status: 'all', from: '', to: '' } };

  function patientFor(id) {
    return local.patients.find((patient) => patient.id === id) || null;
  }

  async function load() {
    [local.items, local.patients] = await Promise.all([
      gateway.listAgenda(local.filters),
      gateway.listPatients()
    ]);
  }

  function patientOptions() {
    return local.patients.map((patient) => `<option value="${escapeHtml(patient.id)}">${escapeHtml(patient.fullName)}</option>`).join('');
  }

  function itemCard(item) {
    const patient = patientFor(item.patientId);
    const patientName = patient?.fullName || 'Paciente não encontrado';
    const sourceText = item.source === 'persisted' ? 'Persistido' : 'Somente local · não persistido';
    const sourceTone = item.source === 'persisted' ? 'success' : 'warning';
    const status = STATUS_LABELS[item.status] || item.status;
    return `<article class="card agenda-item" data-agenda-item="${escapeHtml(item.id)}">
      <div class="section-head">
        <div><span class="eyebrow">${escapeHtml(status.toUpperCase())}</span><h3>${escapeHtml(patientName)}</h3></div>
        ${statusBadge(sourceText, sourceTone)}
      </div>
      <div class="agenda-item-meta"><strong>${escapeHtml(localDateTime(item.startsAt))}</strong><span class="status-badge status-neutral">${escapeHtml(status)}</span></div>
      <p>${escapeHtml(item.note || 'Sem observação administrativa.')}</p>
      <div class="agenda-item-actions">
        <label>Status de ${escapeHtml(patientName)}<select data-agenda-status="${escapeHtml(item.id)}" aria-label="Status de ${escapeHtml(patientName)}"><option value="scheduled" ${item.status === 'scheduled' ? 'selected' : ''}>Agendado</option><option value="completed" ${item.status === 'completed' ? 'selected' : ''}>Concluído</option><option value="cancelled" ${item.status === 'cancelled' ? 'selected' : ''}>Cancelado</option></select></label>
        ${patient ? `<button type="button" class="secondary" data-open-agenda-patient="${escapeHtml(patient.id)}" aria-label="Abrir paciente ${escapeHtml(patientName)}">Abrir paciente</button>` : ''}
      </div>
    </article>`;
  }

  function agendaList() {
    if (!local.items.length) {
      return emptyState({ title: 'Nenhum item na agenda', description: 'Ajuste os filtros ou adicione um atendimento local.' });
    }
    return `<div class="agenda-list">${local.items.map(itemCard).join('')}</div>`;
  }

  function render() {
    return `<div class="page-stack agenda-view" data-agenda-view>
      <div class="page-heading"><div><span class="eyebrow">AGENDA</span><h1>Agenda</h1><p>Organização operacional de sessões e retornos. Os itens desta fase permanecem somente na memória local.</p></div><span class="status-badge status-warning">Somente local · não persistido</span></div>
      <div class="grid two-column agenda-layout">
        <section class="card">
          <div class="section-head"><div><span class="eyebrow">NOVO ITEM</span><h2>Adicionar à agenda</h2></div></div>
          <label>Paciente da agenda<select name="agenda-patient">${patientOptions()}</select></label>
          <label>Data e hora<input name="agenda-start" type="datetime-local" value="${defaultStartsAt()}"></label>
          <label>Observação da agenda<textarea name="agenda-note" rows="3" placeholder="Ex.: Retorno para reavaliação"></textarea></label>
          <div class="module-note">A agenda não determina conduta clínica e não persiste no backend nesta fase.</div>
          <div class="actions"><button type="button" class="primary" data-add-agenda>Adicionar à agenda</button></div>
        </section>
        <section class="card">
          <div class="section-head"><div><span class="eyebrow">FILTROS</span><h2>Visualização</h2></div><span class="status-badge status-info">${local.items.length} itens</span></div>
          <label>Filtrar status<select data-agenda-filter-status><option value="all" ${local.filters.status === 'all' ? 'selected' : ''}>Todos</option><option value="scheduled" ${local.filters.status === 'scheduled' ? 'selected' : ''}>Agendado</option><option value="completed" ${local.filters.status === 'completed' ? 'selected' : ''}>Concluído</option><option value="cancelled" ${local.filters.status === 'cancelled' ? 'selected' : ''}>Cancelado</option></select></label>
          <div class="form-grid"><label>Filtrar de<input data-agenda-filter-from type="date" value="${escapeHtml(local.filters.from)}"></label><label>Filtrar até<input data-agenda-filter-to type="date" value="${escapeHtml(local.filters.to)}"></label></div>
        </section>
      </div>
      <section aria-label="Itens da agenda">${agendaList()}</section>
    </div>`;
  }

  async function refresh() {
    await load();
    onChanged?.();
  }

  function bindActions(root = document) {
    root.querySelector('[data-add-agenda]')?.addEventListener('click', async () => {
      try {
        await gateway.createAgendaItem({
          patientId: root.querySelector('[name="agenda-patient"]')?.value ?? '',
          startsAt: root.querySelector('[name="agenda-start"]')?.value ?? '',
          status: 'scheduled',
          note: root.querySelector('[name="agenda-note"]')?.value ?? ''
        });
        await load();
        onMessage?.('Item adicionado somente à agenda local; nenhuma persistência foi realizada.', 'success');
        onChanged?.();
      } catch (error) {
        onMessage?.(error.message);
      }
    });

    root.querySelectorAll('[data-agenda-status]').forEach((select) => select.addEventListener('change', async (event) => {
      try {
        await gateway.updateAgendaItem(event.currentTarget.dataset.agendaStatus, { status: event.currentTarget.value });
        await load();
        onMessage?.('Status atualizado somente na agenda local.', 'success');
        onChanged?.();
      } catch (error) {
        onMessage?.(error.message);
      }
    }));

    root.querySelectorAll('[data-open-agenda-patient]').forEach((button) => button.addEventListener('click', () => onOpenPatient?.(button.dataset.openAgendaPatient)));
    root.querySelector('[data-agenda-filter-status]')?.addEventListener('change', async (event) => { local.filters.status = event.currentTarget.value; await refresh(); });
    root.querySelector('[data-agenda-filter-from]')?.addEventListener('change', async (event) => { local.filters.from = event.currentTarget.value; await refresh(); });
    root.querySelector('[data-agenda-filter-to]')?.addEventListener('change', async (event) => { local.filters.to = event.currentTarget.value; await refresh(); });
  }

  return { load, render, bindActions };
}
