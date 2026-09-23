import { emptyState, escapeHtml, statusBadge } from '../ui/primitives.js';

const CATEGORY_LABELS = Object.freeze({
  assessment: 'Avaliação',
  session: 'Sessão',
  'follow-up': 'Retorno',
  note: 'Nota'
});

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function createEvolutionView({ gateway, patientId, onChanged, onMessage }) {
  const local = {
    records: [],
    filters: { category: 'all', from: '', to: '' }
  };

  async function load() {
    local.records = await gateway.listEvolution(patientId, local.filters);
  }

  function recordCard(record) {
    const sourceText = record.source === 'persisted' ? 'Persistido' : 'Somente local · não persistido';
    const sourceTone = record.source === 'persisted' ? 'success' : 'warning';
    return `<article class="card evolution-record" data-evolution-record>
      <div class="section-head"><div><span class="eyebrow">${escapeHtml(CATEGORY_LABELS[record.category] || record.category || 'REGISTRO')}</span><h3>${escapeHtml(record.title)}</h3></div>${statusBadge(sourceText, sourceTone)}</div>
      <p>${escapeHtml(record.notes || 'Sem observação adicional.')}</p>
      <div class="muted">${escapeHtml(record.date || '—')}${record.sessionId ? ` · Sessão ${escapeHtml(record.sessionId)}` : ''}${record.protocolVersionId ? ` · Protocolo ${escapeHtml(record.protocolVersionId)}` : ''}</div>
    </article>`;
  }

  function renderList() {
    if (!local.records.length) {
      return emptyState({
        title: 'Nenhuma evolução encontrada',
        description: 'Ajuste os filtros ou adicione um registro descritivo de evolução.'
      });
    }
    return `<div class="evolution-list">${local.records.map(recordCard).join('')}</div>`;
  }

  function render() {
    return `<div class="page-stack evolution-workspace" data-evolution-view>
      <div class="grid two-column">
        <section class="card">
          <div class="section-head"><div><span class="eyebrow">NOVO REGISTRO</span><h2>Adicionar evolução</h2></div><span class="status-badge status-warning">Somente local · não persistido</span></div>
          <p class="muted">Registro descritivo. O software não interpreta resposta clínica nem calcula eficácia.</p>
          <label>Título da evolução<input name="evolution-title" placeholder="Ex.: Reavaliação funcional"></label>
          <div class="form-grid">
            <label>Data da evolução<input name="evolution-date" type="date" value="${todayIso()}"></label>
            <label>Categoria da evolução<select name="evolution-category"><option value="assessment">Avaliação</option><option value="session">Sessão</option><option value="follow-up">Retorno</option><option value="note">Nota</option></select></label>
          </div>
          <label>Observações da evolução<textarea name="evolution-notes" rows="4" placeholder="Descreva achados ou contexto sem interpretação automática"></textarea></label>
          <div class="actions"><button type="button" class="primary" data-add-evolution>Adicionar evolução</button></div>
        </section>
        <section class="card">
          <div class="section-head"><div><span class="eyebrow">FILTROS</span><h2>Linha do tempo</h2></div><span class="status-badge status-info">${local.records.length} registros</span></div>
          <label>Filtrar categoria<select data-evolution-filter-category><option value="all" ${local.filters.category === 'all' ? 'selected' : ''}>Todas</option><option value="assessment" ${local.filters.category === 'assessment' ? 'selected' : ''}>Avaliação</option><option value="session" ${local.filters.category === 'session' ? 'selected' : ''}>Sessão</option><option value="follow-up" ${local.filters.category === 'follow-up' ? 'selected' : ''}>Retorno</option><option value="note" ${local.filters.category === 'note' ? 'selected' : ''}>Nota</option></select></label>
          <div class="form-grid"><label>Filtrar de<input data-evolution-filter-from type="date" value="${escapeHtml(local.filters.from)}"></label><label>Filtrar até<input data-evolution-filter-to type="date" value="${escapeHtml(local.filters.to)}"></label></div>
          <p class="module-note">Registros locais são identificados em texto e nunca apresentados como persistidos.</p>
        </section>
      </div>
      <section aria-label="Registros de evolução">${renderList()}</section>
    </div>`;
  }

  async function refresh(root) {
    await load();
    onChanged?.();
    root.querySelector('[data-evolution-view]')?.focus?.();
  }

  function bindActions(root = document) {
    root.querySelector('[data-add-evolution]')?.addEventListener('click', async () => {
      try {
        await gateway.addEvolution(patientId, {
          title: root.querySelector('[name="evolution-title"]')?.value ?? '',
          date: root.querySelector('[name="evolution-date"]')?.value ?? '',
          category: root.querySelector('[name="evolution-category"]')?.value ?? 'note',
          notes: root.querySelector('[name="evolution-notes"]')?.value ?? ''
        });
        await load();
        onMessage?.('Evolução adicionada somente ao estado local; nenhuma persistência clínica foi realizada.', 'success');
        onChanged?.();
      } catch (error) {
        onMessage?.(error.message);
      }
    });

    root.querySelector('[data-evolution-filter-category]')?.addEventListener('change', async (event) => {
      local.filters.category = event.currentTarget.value;
      await refresh(root);
    });
    root.querySelector('[data-evolution-filter-from]')?.addEventListener('change', async (event) => {
      local.filters.from = event.currentTarget.value;
      await refresh(root);
    });
    root.querySelector('[data-evolution-filter-to]')?.addEventListener('change', async (event) => {
      local.filters.to = event.currentTarget.value;
      await refresh(root);
    });
  }

  return { load, render, bindActions };
}
