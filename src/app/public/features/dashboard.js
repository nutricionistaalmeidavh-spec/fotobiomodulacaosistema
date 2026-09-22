import { assertUiProvider } from '../data/contracts.js';
import { escapeHtml } from '../ui/primitives.js';

export function createDashboardView({ provider, onNavigate, getFoundation }) {
  assertUiProvider(provider);

  function metricCard(label, value, helper) {
    return `<article class="card metric-card"><span class="eyebrow">${escapeHtml(label)}</span><div class="metric">${escapeHtml(value)}</div><p>${escapeHtml(helper)}</p></article>`;
  }

  function render() {
    const snapshot = provider.getDashboard();
    const foundation = getFoundation?.() || {};
    return `<div class="page-stack" data-dashboard-view>
      <div class="page-heading">
        <div><span class="eyebrow">DASHBOARD</span><h1>Hoje na clínica</h1><p>Resumo operacional para orientar a rotina sem depender do backend clínico ainda em evolução.</p></div>
        <span class="status-badge status-success">UI paralela · fixtures locais</span>
      </div>
      <div class="grid cards dashboard-metrics">
        ${metricCard('Sessões hoje', snapshot.sessionsToday, 'Aplicações previstas no dia')}
        ${metricCard('Pacientes ativos', snapshot.activePatients, 'Em acompanhamento no ciclo atual')}
        ${metricCard('Retornos pendentes', snapshot.pendingFollowUps, 'Itens que pedem acompanhamento')}
        ${metricCard('Protocolos recentes', snapshot.recentProtocols, 'Protocolos acessados ou revisados')}
      </div>
      <div class="grid dashboard-main-grid">
        <section class="card">
          <div class="section-head"><div><span class="eyebrow">AÇÕES RÁPIDAS</span><h2>Próximos passos</h2></div></div>
          <div class="quick-actions">
            <button type="button" class="quick-action" data-dashboard-nav="patients"><strong>Ver pacientes</strong><span>Buscar, cadastrar e abrir o workspace clínico.</span></button>
            <button type="button" class="quick-action" data-dashboard-nav="agenda"><strong>Abrir agenda</strong><span>Preparar o fluxo de sessões e retornos.</span></button>
            <button type="button" class="quick-action" data-dashboard-nav="protocols"><strong>Revisar protocolos</strong><span>Acessar a biblioteca versionada F0.</span></button>
          </div>
        </section>
        <section class="card">
          <div class="section-head"><div><span class="eyebrow">ATIVIDADE RECENTE</span><h2>Movimentações</h2></div></div>
          <div class="timeline-list">${snapshot.recentActivity.map((item, index) => `<article class="timeline-row"><span class="timeline-dot" aria-hidden="true"></span><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.detail)}</p></div><time>${escapeHtml(item.meta)}</time>${index === snapshot.recentActivity.length - 1 ? '' : '<span class="timeline-line" aria-hidden="true"></span>'}</article>`).join('')}</div>
        </section>
      </div>
      <section class="card foundation-strip">
        <div><span class="eyebrow">FUNDAÇÃO CLÍNICA</span><h2>F0 concluída</h2><p>Backend local preservado durante a construção paralela da experiência de UI.</p></div>
        <div class="foundation-badges">
          <span class="status-badge status-info">${escapeHtml(foundation.tableCount ?? 19)} tabelas</span>
          <span class="status-badge status-success">Versionamento imutável</span>
          <span class="status-badge status-warning">Planejado ≠ aplicado</span>
          <span class="status-badge status-neutral">Auditoria append-only</span>
        </div>
      </section>
    </div>`;
  }

  function bindActions(root = document) {
    root.querySelectorAll('[data-dashboard-nav]').forEach((button) => button.addEventListener('click', () => onNavigate?.(button.dataset.dashboardNav)));
  }

  return { render, bindActions };
}
