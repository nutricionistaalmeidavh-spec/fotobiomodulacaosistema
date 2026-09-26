import { emptyState, escapeHtml, statusBadge } from '../ui/primitives.js';

const STATUS_LABELS = Object.freeze({
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  missed: 'Faltou',
  cancelled: 'Cancelado'
});

const TYPE_LABELS = Object.freeze({
  session: 'Sessão',
  return: 'Retorno',
  evaluation: 'Avaliação',
  other: 'Outro'
});

function localDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function inputDateTime(date = new Date()) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

function defaultWindow() {
  const start = new Date();
  start.setSeconds(0, 0);
  start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return { start: inputDateTime(start), end: inputDateTime(end) };
}

function toIso(value, label) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw new Error(`${label} inválida.`);
  return date.toISOString();
}

export function createAgendaView({ gateway, onOpenPatient, onChanged, onMessage }) {
  const defaults = defaultWindow();
  const local = {
    items: [],
    patients: [],
    filters: { status: 'all', from: '', to: '' },
    draft: { start: defaults.start, end: defaults.end }
  };

  function patientFor(id) {
    return local.patients.find((patient) => patient.id === id) || null;
  }

  async function load() {
    const filters = {};
    if (local.filters.status !== 'all') filters.status = local.filters.status;
    if (local.filters.from) filters.from = local.filters.from;
    if (local.filters.to) filters.to = local.filters.to;
    [local.items, local.patients] = await Promise.all([
      gateway.listAgenda(filters),
      gateway.listPatients()
    ]);
  }

  function patientOptions() {
    if (!local.patients.length) return '<option value="">Nenhum paciente ativo</option>';
    return local.patients.map((patient) => `<option value="${escapeHtml(patient.id)}">${escapeHtml(patient.fullName)}</option>`).join('');
  }

  function itemCard(item) {
    const patient = patientFor(item.patientId);
    const patientName = patient?.fullName || 'Paciente não encontrado';
    const status = STATUS_LABELS[item.status] || item.status;
    return `<article class="card agenda-item" data-agenda-item="${escapeHtml(item.id)}">
      <div class="section-head">
        <div><span class="eyebrow">${escapeHtml((TYPE_LABELS[item.appointmentType] || item.appointmentType || 'ATENDIMENTO').toUpperCase())}</span><h3>${escapeHtml(patientName)}</h3></div>
        ${statusBadge('Persistido', 'success')}
      </div>
      <div class="agenda-item-meta"><strong>${escapeHtml(localDateTime(item.startsAt))} → ${escapeHtml(localDateTime(item.endsAt))}</strong><span class="status-badge status-neutral">${escapeHtml(status)}</span></div>
      <p>${escapeHtml(item.note || item.notes || 'Sem observação administrativa.')}</p>
      ${item.recurrenceSeriesId ? '<p class="muted">Parte de uma série recorrente.</p>' : ''}
      <div class="agenda-item-actions">
        <label>Status de ${escapeHtml(patientName)}<select data-agenda-status="${escapeHtml(item.id)}" aria-label="Status de ${escapeHtml(patientName)}">
          <option value="scheduled" ${item.status === 'scheduled' ? 'selected' : ''}>Agendado</option>
          <option value="confirmed" ${item.status === 'confirmed' ? 'selected' : ''}>Confirmado</option>
          <option value="completed" ${item.status === 'completed' ? 'selected' : ''}>Concluído</option>
          <option value="missed" ${item.status === 'missed' ? 'selected' : ''}>Faltou</option>
          <option value="cancelled" ${item.status === 'cancelled' ? 'selected' : ''}>Cancelado</option>
        </select></label>
        ${patient ? `<button type="button" class="secondary" data-open-agenda-patient="${escapeHtml(patient.id)}" aria-label="Abrir paciente ${escapeHtml(patientName)}">Abrir paciente</button>` : ''}
      </div>
    </article>`;
  }

  function agendaList() {
    if (!local.items.length) {
      return emptyState({ title: 'Nenhum item na agenda', description: 'Ajuste os filtros ou registre um atendimento.' });
    }
    return `<div class="agenda-list">${local.items.map(itemCard).join('')}</div>`;
  }

  function render() {
    return `<div class="page-stack agenda-view" data-agenda-view>
      <div class="page-heading"><div><span class="eyebrow">AGENDA</span><h1>Agenda</h1><p>Agendamentos operacionais persistidos, independentes das sessões clínicas de fotobiomodulação.</p></div><span class="status-badge status-success">Persistido</span></div>
      <div class="grid two-column agenda-layout">
        <section class="card">
          <div class="section-head"><div><span class="eyebrow">NOVO AGENDAMENTO</span><h2>Adicionar à agenda</h2></div></div>
          <div class="form-grid">
            <label>Paciente da agenda<select name="agenda-patient">${patientOptions()}</select></label>
            <label>Tipo de atendimento<select name="agenda-type"><option value="return">Retorno</option><option value="session">Sessão</option><option value="evaluation">Avaliação</option><option value="other">Outro</option></select></label>
            <label>Data e hora inicial<input name="agenda-start" type="datetime-local" value="${escapeHtml(local.draft.start)}"></label>
            <label>Data e hora final<input name="agenda-end" type="datetime-local" value="${escapeHtml(local.draft.end)}"></label>
            <label>Repetições<input name="agenda-count" type="number" min="1" max="104" value="1"></label>
            <label>Intervalo (dias)<input name="agenda-interval" type="number" min="1" value="7"></label>
            <label class="field-span">Observação da agenda<textarea name="agenda-note" rows="3" placeholder="Ex.: Retorno para reavaliação"></textarea></label>
          </div>
          <div class="module-note">Concluir um agendamento não cria automaticamente uma sessão clínica PBM.</div>
          <div class="actions"><button type="button" class="primary" data-add-agenda>Agendar</button></div>
        </section>
        <section class="card">
          <div class="section-head"><div><span class="eyebrow">FILTROS</span><h2>Visualização</h2></div><span class="status-badge status-info">${local.items.length} itens</span></div>
          <label>Filtrar status<select data-agenda-filter-status><option value="all" ${local.filters.status === 'all' ? 'selected' : ''}>Todos</option><option value="scheduled" ${local.filters.status === 'scheduled' ? 'selected' : ''}>Agendado</option><option value="confirmed" ${local.filters.status === 'confirmed' ? 'selected' : ''}>Confirmado</option><option value="completed" ${local.filters.status === 'completed' ? 'selected' : ''}>Concluído</option><option value="missed" ${local.filters.status === 'missed' ? 'selected' : ''}>Faltou</option><option value="cancelled" ${local.filters.status === 'cancelled' ? 'selected' : ''}>Cancelado</option></select></label>
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
        const startValue = root.querySelector('[name="agenda-start"]')?.value ?? '';
        const endValue = root.querySelector('[name="agenda-end"]')?.value ?? '';
        const count = Number(root.querySelector('[name="agenda-count"]')?.value ?? 1);
        const intervalDays = Number(root.querySelector('[name="agenda-interval"]')?.value ?? 7);
        local.draft.start = startValue;
        local.draft.end = endValue;
        await gateway.createAgendaItem({
          patientId: root.querySelector('[name="agenda-patient"]')?.value ?? '',
          startsAt: toIso(startValue, 'Data inicial'),
          endsAt: toIso(endValue, 'Data final'),
          appointmentType: root.querySelector('[name="agenda-type"]')?.value ?? 'other',
          notes: root.querySelector('[name="agenda-note"]')?.value ?? '',
          recurrence: count > 1 ? { count, intervalDays } : null
        });
        await load();
        onMessage?.(count > 1 ? `${count} agendamentos recorrentes registrados.` : 'Agendamento registrado.', 'success');
        onChanged?.();
      } catch (error) {
        onMessage?.(error.message);
      }
    });

    root.querySelectorAll('[data-agenda-status]').forEach((select) => select.addEventListener('change', async (event) => {
      try {
        await gateway.updateAgendaItem(event.currentTarget.dataset.agendaStatus, { status: event.currentTarget.value });
        await load();
        onMessage?.('Status do agendamento atualizado.', 'success');
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
