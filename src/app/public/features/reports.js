import { emptyState, escapeHtml } from '../ui/primitives.js';

function money(cents = 0) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(Number(cents || 0) / 100).replace(/\u00a0/g, ' ');
}

function metric(label, value, key) {
  return `<article class="card metric-card" data-report-metric="${escapeHtml(key)}"><span class="eyebrow">${escapeHtml(label)}</span><div class="metric">${escapeHtml(value)}</div></article>`;
}

export function createReportsView({ gateway, onChanged }) {
  const local = { report: null, from: '', to: '', error: '' };

  async function load() {
    local.error = '';
    if (local.from && local.to && local.to < local.from) {
      local.error = 'Período inválido: a data final deve ser igual ou posterior à data inicial.';
      return;
    }
    try {
      local.report = await gateway.getOperationalReport({
        from: local.from || undefined,
        to: local.to || undefined
      });
    } catch (error) {
      local.error = error.message;
    }
  }

  function render() {
    const report = local.report;
    const finance = report?.finance || {};
    const appointments = report?.appointments || {};
    return `<div class="page-stack reports-view" data-reports-view>
      <div class="page-heading">
        <div><span class="eyebrow">RELATÓRIOS</span><h1>Relatórios operacionais</h1>
          <p>Movimentações e indicadores descritivos registrados pela clínica.</p></div>
        <span class="status-badge status-info">Dados do banco local</span>
      </div>
      <section class="card report-filters">
        <div class="section-head"><div><span class="eyebrow">PERÍODO</span><h2>Filtrar dados</h2></div></div>
        <div class="form-grid">
          <label>Período de<input type="date" data-report-from aria-label="Período de" value="${escapeHtml(local.from)}"></label>
          <label>Período até<input type="date" data-report-to aria-label="Período até" value="${escapeHtml(local.to)}"></label>
        </div>
        ${local.error ? `<div class="field-message field-error" role="alert">${escapeHtml(local.error)}</div>` : ''}
        <div class="actions"><button type="button" class="primary" data-apply-report-period>Aplicar período</button></div>
        <p class="module-note">Indicadores administrativos e quantitativos, sem interpretação terapêutica automática.</p>
      </section>
      ${report ? `
      <div class="grid cards report-metrics">
        ${metric('Sessões no período', report.pbmSessions ?? 0, 'sessions')}
        ${metric('Pacientes atendidos', report.patientsAttended ?? 0, 'patients-attended')}
        ${metric('Agendamentos', appointments.total ?? 0, 'appointments')}
        ${metric('Protocolos usados', report.protocolsUsed ?? 0, 'protocols-used')}
        ${metric('Desfechos registrados', report.outcomesRecorded ?? 0, 'outcomes')}
        ${metric('Receita recebida', money(finance.receivedCents), 'received-cents')}
        ${metric('Receita pendente', money(finance.pendingCents), 'pending-cents')}
      </div>
      <section class="card">
        <div class="section-head"><div><span class="eyebrow">AGENDA</span><h2>Agendamentos por situação</h2></div></div>
        ${Object.keys(appointments.byStatus || {}).length
          ? `<dl class="equipment-specs">${Object.entries(appointments.byStatus).map(([status, count]) => `<div><dt>${escapeHtml(status)}</dt><dd>${escapeHtml(count)}</dd></div>`).join('')}</dl>`
          : emptyState({ title: 'Sem agendamentos no período', description: 'Nenhum agendamento registrado com os filtros selecionados.' })}
      </section>`
      : emptyState({ title: 'Relatório indisponível', description: 'Confira o período e tente novamente.' })}
    </div>`;
  }

  function bindActions(root = document) {
    root.querySelector('[data-apply-report-period]')?.addEventListener('click', async () => {
      local.from = root.querySelector('[data-report-from]')?.value ?? '';
      local.to = root.querySelector('[data-report-to]')?.value ?? '';
      await load();
      onChanged?.();
    });
  }

  return { load, render, bindActions };
}
