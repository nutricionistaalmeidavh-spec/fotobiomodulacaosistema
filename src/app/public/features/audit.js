import { emptyState, escapeHtml } from '../ui/primitives.js';

export function filterAuditEvents(events = [], filters = {}) {
  let result = events.slice();
  if (filters.action && filters.action !== 'all') result = result.filter((event) => event.action === filters.action);
  if (filters.entityType && filters.entityType !== 'all') result = result.filter((event) => event.entityType === filters.entityType);
  result.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  if ((filters.order || 'desc') === 'desc') result.reverse();
  return result;
}

export function createAuditView({ gateway, onChanged, onMessage }) {
  const local = {
    audit: { valid: true, events: [], source: 'persisted' },
    filters: { action: 'all', entityType: 'all', order: 'desc' }
  };

  async function load() {
    local.audit = await gateway.getAuditState();
  }

  function options(values, selected) {
    return values.map((value) => `<option value="${escapeHtml(value)}" ${selected === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('');
  }

  function renderEvents() {
    const events = filterAuditEvents(local.audit.events || [], local.filters);
    if (!events.length) {
      return emptyState({ title: 'Nenhum evento de auditoria encontrado', description: 'Ajuste os filtros para visualizar novamente a trilha persistida.' });
    }
    return `<div class="audit-list">${events.map((event) => `<article class="audit-item" data-audit-event>
      <header><strong>${escapeHtml(event.action)}</strong><span class="muted">${escapeHtml(event.createdAt)}</span></header>
      <div>${escapeHtml(event.entityType)} · <span class="code">${escapeHtml(event.entityId)}</span></div>
      <div class="code">hash ${escapeHtml(event.eventHash)}</div>
    </article>`).join('')}</div>`;
  }

  function render() {
    const actions = [...new Set((local.audit.events || []).map((event) => event.action))].sort();
    const entities = [...new Set((local.audit.events || []).map((event) => event.entityType))].sort();
    return `<div class="page-stack audit-view" data-audit-view>
      <div class="page-heading">
        <div><span class="eyebrow">AUDITORIA</span><h1>Auditoria clínica</h1><p>Trilha F0 persistida, append-only e encadeada por SHA-256.</p></div>
        <span class="status-badge ${local.audit.valid ? 'status-success' : 'status-danger'}">${local.audit.valid ? 'Cadeia íntegra' : 'Integridade comprometida'}</span>
      </div>
      <section class="card audit-toolbar">
        <div class="section-head"><div><span class="eyebrow">FILTROS</span><h2>Eventos persistidos</h2></div><span class="status-badge status-info">Persistido · backend F0</span></div>
        <div class="form-grid">
          <label>Filtrar ação<select data-audit-action><option value="all">Todas</option>${options(actions, local.filters.action)}</select></label>
          <label>Filtrar entidade<select data-audit-entity><option value="all">Todas</option>${options(entities, local.filters.entityType)}</select></label>
        </div>
        <label>Ordenação<select data-audit-order><option value="desc" ${local.filters.order === 'desc' ? 'selected' : ''}>Mais recentes primeiro</option><option value="asc" ${local.filters.order === 'asc' ? 'selected' : ''}>Mais antigos primeiro</option></select></label>
        <p class="module-note">Esta superfície usa exclusivamente a cadeia persistida F0; nenhum evento local é apresentado como auditoria clínica.</p>
      </section>
      <section class="card"><div class="section-head"><div><h2>Auditoria append-only</h2><p>UPDATE e DELETE dos eventos continuam bloqueados no banco.</p></div></div>${renderEvents()}</section>
    </div>`;
  }

  function bindActions(root = document) {
    root.querySelector('[data-audit-action]')?.addEventListener('change', (event) => { local.filters.action = event.currentTarget.value; onChanged?.(); });
    root.querySelector('[data-audit-entity]')?.addEventListener('change', (event) => { local.filters.entityType = event.currentTarget.value; onChanged?.(); });
    root.querySelector('[data-audit-order]')?.addEventListener('change', (event) => { local.filters.order = event.currentTarget.value; onChanged?.(); });
  }

  return { load, render, bindActions };
}
