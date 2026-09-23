import { emptyState, escapeHtml } from '../ui/primitives.js';

function metric(label, value, key) {
  return `<article class="card metric-card" data-report-metric="${escapeHtml(key)}"><span class="eyebrow">${escapeHtml(label)}</span><div class="metric">${escapeHtml(value)}</div></article>`;
}

export function createReportsView({ gateway, onChanged, onMessage }) {
  const local = {
    report: { sessionCount: 0, activePatientCount: 0, pendingFollowUpCount: 0, divergenceCount: 0, protocolUsage: [], basis: {} },
    filters: { from: '', to: '' },
    error: ''
  };

  async function load() {
    try {
      local.report = await gateway.getOperationalReport(local.filters);
      local.error = '';
    } catch (error) {
      local.error = error.message;
      throw error;
    }
  }

  function protocolUsage() {
    if (!local.report.protocolUsage?.length) {
      return emptyState({ title: 'Nenhum protocolo no período', description: 'Não há sessões com protocolo disponível para o período selecionado.' });
    }
    return `<div class="version-list">${local.report.protocolUsage.map((item) => `<article class="version-item report-protocol-row"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.count)} sessão${item.count === 1 ? '' : 'ões'}</span></article>`).join('')}</div>`;
  }

  function render() {
    return `<div class="page-stack reports-view" data-reports-view>
      <div class="page-heading">
        <div><span class="eyebrow">RELATÓRIOS</span><h1>Relatórios operacionais</h1><p>Indicadores descritivos da operação. Este módulo não calcula eficácia, não classifica tratamento e não produz recomendação clínica.</p></div>
        <span class="status-badge status-info">Dados derivados pelo gateway</span>
      </div>
      <section class="card report-filters">
        <div class="section-head"><div><span class="eyebrow">PERÍODO</span><h2>Filtrar dados</h2></div></div>
        <div class="form-grid">
          <label>Período de<input type="date" data-report-from value="${escapeHtml(local.filters.from)}"></label>
          <label>Período até<input type="date" data-report-to value="${escapeHtml(local.filters.to)}"></label>
        </div>
        ${local.error ? `<div class="field-message" role="alert">${escapeHtml(local.error)}</div>` : ''}
        <div class="actions"><button type="button" class="primary" data-apply-report-period>Aplicar período</button></div>
        <p class="module-note">Relatório operacional e descritivo; não constitui avaliação de eficácia nem recomendação de tratamento.</p>
      </section>
      <div class="grid cards report-metrics">
        ${metric('Sessões no período', local.report.sessionCount, 'sessions')}
        ${metric('Pacientes ativos', local.report.activePatientCount, 'active-patients')}
        ${metric('Retornos pendentes', local.report.pendingFollowUpCount, 'pending-followups')}
        ${metric('Divergências planejado × aplicado', local.report.divergenceCount, 'divergences')}
      </div>
      <section class="card">
        <div class="section-head"><div><span class="eyebrow">PROTOCOLOS</span><h2>Uso por protocolo</h2></div><span class="status-badge status-neutral">Sessões persistidas F0</span></div>
        ${protocolUsage()}
      </section>
      <section class="card report-basis">
        <span class="eyebrow">ORIGEM DOS DADOS</span>
        <p>Pacientes: <strong>local</strong> · Sessões: <strong>persistido</strong> · Protocolos: <strong>persistido</strong>. O backend futuro pode substituir cada adapter sem alterar esta tela.</p>
      </section>
    </div>`;
  }

  function bindActions(root = document) {
    root.querySelector('[data-apply-report-period]')?.addEventListener('click', async () => {
      local.filters.from = root.querySelector('[data-report-from]')?.value ?? '';
      local.filters.to = root.querySelector('[data-report-to]')?.value ?? '';
      try {
        await load();
        onChanged?.();
      } catch (error) {
        onMessage?.(error.message);
        onChanged?.();
      }
    });
  }

  return { load, render, bindActions };
}
