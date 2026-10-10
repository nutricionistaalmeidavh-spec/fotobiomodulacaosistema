import { emptyState, escapeHtml } from '../ui/primitives.js';

function formatMoney(cents = 0) {
  const value = Number(cents ?? 0);
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(Number.isFinite(value) ? value / 100 : 0);
}

function metric(label, value, key) {
  return `<article class="card metric-card" data-report-metric="${escapeHtml(key)}">
    <span class="eyebrow">${escapeHtml(label)}</span>
    <div class="metric">${escapeHtml(value)}</div>
  </article>`;
}

function dateBoundary(value, endOfDay = false) {
  if (!value) return undefined;
  return `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`;
}

export function createReportsView({ gateway, onChanged }) {
  const local = { report: null, from: '', to: '', error: '' };

  async function load() {
    local.error = '';
    try {
      if (local.from && local.to && local.from > local.to) {
        throw new Error('A data final deve ser igual ou posterior à data inicial.');
      }
      local.report = await gateway.getOperationalReport({
        from: dateBoundary(local.from),
        to: dateBoundary(local.to, true)
      });
    } catch (error) {
      local.report = null;
      local.error = error.message || 'Não foi possível carregar os dados do período.';
    }
  }

  function operationalDetails(report) {
    const byStatus = report.appointments?.byStatus || {};
    return `<section class="card" aria-label="Atividade operacional">
      <div class="section-head">
        <div><span class="eyebrow">ROTINA DA CLÍNICA</span><h2>Atendimentos e registros</h2></div>
      </div>
      <div class="grid cards report-metrics">
        ${metric('Agendamentos no período', report.appointments?.total ?? 0, 'appointments')}
        ${metric('Agendamentos a confirmar', (byStatus.scheduled || 0) + (byStatus.confirmed || 0), 'appointments-open')}
        ${metric('Versões de protocolo utilizadas', report.protocolsUsed ?? 0, 'protocols-used')}
        ${metric('Registros de evolução', report.outcomesRecorded ?? 0, 'outcomes')}
      </div>
    </section>`;
  }

  function render() {
    const report = local.report;
    return `<div class="page-stack reports-view" data-reports-view>
      <div class="page-heading">
        <div><span class="eyebrow">RELATÓRIOS</span><h1>Relatórios operacionais</h1>
          <p>Indicadores administrativos e financeiros registrados na clínica. A interpretação clínica permanece responsabilidade profissional.</p></div>
        <span class="status-badge status-info">Dados persistidos</span>
      </div>
      <section class="card report-filters">
        <div class="section-head"><div><span class="eyebrow">PERÍODO</span><h2>Filtrar dados</h2></div></div>
        <div class="form-grid">
          <label>Período de<input type="date" data-report-from aria-label="Período de" value="${escapeHtml(local.from)}"></label>
          <label>Período até<input type="date" data-report-to aria-label="Período até" value="${escapeHtml(local.to)}"></label>
        </div>
        ${local.error ? `<div class="field-message field-error" role="alert">${escapeHtml(local.error)}</div>` : ''}
        <div class="actions"><button type="button" class="primary" data-apply-report-period>Aplicar período</button></div>
      </section>
      ${!report ? emptyState({
        title: 'Relatório indisponível',
        description: 'Corrija o período informado ou tente carregar os registros novamente.'
      }) : `
        <section class="grid cards report-metrics" aria-label="Indicadores gerais">
          ${metric('Sessões PBM registradas', report.pbmSessions ?? 0, 'sessions')}
          ${metric('Pacientes com agendamento', report.patientsAttended ?? 0, 'patients-attended')}
          ${metric('Recebimentos no período', formatMoney(report.finance?.receivedCents), 'received-cents')}
          ${metric('Cobranças pendentes', formatMoney(report.finance?.pendingCents), 'pending-cents')}
        </section>
        ${operationalDetails(report)}
        <section class="card report-basis">
          <span class="eyebrow">ORIGEM DOS DADOS</span>
          <p>Totais calculados pelo banco clínico local. Pagamentos são informados pela equipe; esta tela não executa movimentações bancárias.</p>
        </section>
      `}
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
