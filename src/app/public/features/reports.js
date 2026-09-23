import { emptyState, escapeHtml } from '../ui/primitives.js';

function metric(label, value, key) {
  return `<article class="card metric-card" data-report-metric="${escapeHtml(key)}"><span class="eyebrow">${escapeHtml(label)}</span><div class="metric">${escapeHtml(value)}</div></article>`;
}

export function createReportsView({ gateway, onChanged }) {
  const local = {
    report: { sessionCount: 0, activePatientCount: 0, pendingFollowUpCount: 0, divergenceCount: 0, protocolUsage: [] },
    from: '',
    to: '',
    error: ''
  };

  async function load() {
    local.error = '';
    try {
      local.report = await gateway.getOperationalReport({
        from: local.from || undefined,
        to: local.to || undefined
      });
    } catch (error) {
      local.report = null;
      local.error = error.message;
    }
  }

  function protocolUsage() {
    if (!local.report?.protocolUsage?.length) {
      return emptyState({ title: 'Nenhum protocolo no período', description: 'Não há sessões com protocolo disponível para o período selecionado.' });
    }
    return `<div class="version-list">${local.report.protocolUsage.map((item) => `<article class="version-item report-protocol-row"><strong>${escapeHtml(item.protocol)}</strong><span>${escapeHtml(item.count)} sessão${item.count === 1 ? '' : 'ões'}</span></article>`).join('')}</div>`;
  }

  function render() {
    const report = local.report || { sessionCount: 0, activePatientCount: 0, pendingFollowUpCount: 0, divergenceCount: 0, protocolUsage: [] };
    return `<div class="page-stack reports-view" data-reports-view>
      <div class="page-heading">
        <div><span class="eyebrow">RELATÓRIOS</span><h1>Relatórios operacionais</h1><p>Indicadores descritivos da operação. Este módulo não calcula eficácia, não classifica tratamento e não produz recomendação clínica.</p></div>
        <span class="status-badge status-info">Dados derivados pelo gateway</span>
      </div>
      <section class="card report-filters">
        <div class="section-head"><div><span class="eyebrow">PERÍODO</span><h2>Filtrar dados</h2></div></div>
        <div class="form-grid">
          <label>Período de<input type="date" data-report-from aria-label="Período de" value="${escapeHtml(local.from)}"></label>
          <label>Período até<input type="date" data-report-to aria-label="Período até" value="${escapeHtml(local.to)}"></label>
        </div>
        ${local.error ? `<div class="field-message field-error" role="alert">${escapeHtml(local.error)}</div>` : ''}
        <div class="actions"><button type="button" class="primary" data-apply-report-period>Aplicar período</button></div>
        <p class="module-note">Relatório operacional e descritivo; não constitui avaliação de eficácia nem recomendação clínica.</p>
      </section>
      <div class="grid cards report-metrics">
        ${metric('Sessões no período', report.sessionCount, 'sessions')}
        ${metric('Pacientes ativos', report.activePatientCount, 'active-patients')}
        ${metric('Retornos pendentes', report.pendingFollowUpCount, 'pending-followups')}
        ${metric('Divergências planejado × aplicado', report.divergenceCount, 'divergences')}
      </div>
      <section class="card">
        <div class="section-head"><div><span class="eyebrow">PROTOCOLOS</span><h2>Uso por protocolo</h2></div><span class="status-badge status-neutral">Sessões persistidas F0</span></div>
        ${protocolUsage()}
      </section>
      <section class="card report-basis">
        <span class="eyebrow">ORIGEM DOS DADOS</span>
        <p>Pacientes: <strong>local</strong> · Sessões: <strong>persistido</strong> · Protocolos: <strong>persistido</strong>. Um adapter futuro pode substituir a fonte sem reescrever esta tela.</p>
      </section>
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
