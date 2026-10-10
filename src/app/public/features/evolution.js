import { emptyState, escapeHtml, statusBadge } from '../ui/primitives.js';

const METRIC_LABELS = Object.freeze({
  vas_pain: 'VAS dor',
  functional_numeric: 'Funcional numérico',
  edema: 'Edema',
  rom: 'Amplitude de movimento',
  text: 'Evolução textual'
});

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function numericRecords(records) {
  return records
    .filter((record) => Number.isFinite(Number(record.metricValue)))
    .map((record) => ({ ...record, metricValue: Number(record.metricValue) }))
    .sort((a, b) => String(a.measuredAt || '').localeCompare(String(b.measuredAt || '')));
}

function chart(records) {
  const points = numericRecords(records);
  if (points.length < 2) return '<p class="muted">Registre pelo menos dois desfechos numéricos para visualizar a série descritiva.</p>';
  const values = points.map((item) => item.metricValue);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const coords = points.map((item, index) => {
    const x = 20 + (index * 260) / Math.max(1, points.length - 1);
    const y = 110 - ((item.metricValue - min) / span) * 80;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return `<div class="outcome-chart" aria-label="Série longitudinal descritiva">
    <svg viewBox="0 0 300 130" role="img" aria-label="Gráfico descritivo dos valores registrados"><polyline points="${coords}" fill="none" stroke="currentColor" stroke-width="3"></polyline>${points.map((item, index) => {
      const [x, y] = coords.split(' ')[index].split(',');
      return `<circle cx="${x}" cy="${y}" r="4" fill="currentColor"><title>${escapeHtml(String(item.metricValue))} ${escapeHtml(item.metricUnit || '')}</title></circle>`;
    }).join('')}</svg>
    <p class="module-note">Visualização descritiva dos registros. O sistema não atribui causalidade, eficácia ou prognóstico.</p>
  </div>`;
}

export function createEvolutionView({ gateway, patientId, onChanged, onMessage }) {
  const local = { records: [], metricFilter: '' };

  async function load() {
    local.records = await gateway.listOutcomes(patientId, local.metricFilter ? { metricType: local.metricFilter } : {});
  }

  function recordCard(record) {
    const value = record.metricValue == null ? '' : `${record.metricValue}${record.metricUnit ? ` ${record.metricUnit}` : ''}`;
    return `<article class="card evolution-record" data-evolution-record>
      <div class="section-head"><div><span class="eyebrow">${escapeHtml(METRIC_LABELS[record.metricType] || record.metricType || 'REGISTRO')}</span><h3>${escapeHtml(value || record.narrative || 'Registro clínico')}</h3></div>${statusBadge('Persistido', 'success')}</div>
      ${record.narrative ? `<p>${escapeHtml(record.narrative)}</p>` : ''}
      <div class="muted">${escapeHtml(String(record.measuredAt || '').slice(0, 10) || '—')}${record.baselineGroup ? ` · Grupo ${escapeHtml(record.baselineGroup)}` : ''}</div>
    </article>`;
  }

  function renderList() {
    if (!local.records.length) return emptyState({ title: 'Nenhuma evolução encontrada', description: 'Registre um desfecho clínico tipado para iniciar o acompanhamento longitudinal.' });
    return `<div class="evolution-list">${local.records.map(recordCard).join('')}</div>`;
  }

  function render() {
    return `<div class="page-stack evolution-workspace" data-evolution-view>
      <div class="grid two-column">
        <section class="card">
          <div class="section-head"><div><span class="eyebrow">NOVO REGISTRO</span><h2>Registrar evolução</h2></div>${statusBadge('Persistido', 'success')}</div>
          <p class="muted">Desfecho longitudinal registrado pelo profissional. O software apenas armazena e exibe os dados informados.</p>
          <div class="form-grid">
            <label>Tipo de desfecho<select name="outcome-type"><option value="vas_pain">VAS dor</option><option value="functional_numeric">Funcional numérico</option><option value="edema">Edema</option><option value="rom">Amplitude de movimento</option><option value="text">Texto</option></select></label>
            <label>Data<input name="outcome-date" type="date" value="${todayIso()}"></label>
            <label>Valor<input name="outcome-value" type="number" step="any" placeholder="Deixe vazio para texto"></label>
            <label>Unidade<input name="outcome-unit" placeholder="Ex.: cm, pontos, deg"></label>
            <label>Grupo de linha de base<input name="outcome-baseline" placeholder="Opcional"></label>
          </div>
          <label>Narrativa<textarea name="outcome-narrative" rows="4" placeholder="Contexto registrado pelo profissional"></textarea></label>
          <div class="actions"><button type="button" class="primary" data-add-outcome>Registrar evolução</button></div>
        </section>
        <section class="card">
          <div class="section-head"><div><span class="eyebrow">SÉRIE</span><h2>Acompanhamento longitudinal</h2></div><span class="status-badge status-info">${local.records.length} registros</span></div>
          <label>Filtrar tipo<select data-outcome-filter><option value="" ${local.metricFilter === '' ? 'selected' : ''}>Todos</option>${Object.entries(METRIC_LABELS).map(([value, label]) => `<option value="${value}" ${local.metricFilter === value ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select></label>
          ${chart(local.records)}
        </section>
      </div>
      <section aria-label="Registros de evolução">${renderList()}</section>
    </div>`;
  }

  function bindActions(root = document) {
    root.querySelector('[data-add-outcome]')?.addEventListener('click', async () => {
      try {
        const metricType = root.querySelector('[name="outcome-type"]')?.value || 'text';
        const metricValue = root.querySelector('[name="outcome-value"]')?.value ?? '';
        const metricUnit = root.querySelector('[name="outcome-unit"]')?.value ?? '';
        const narrative = root.querySelector('[name="outcome-narrative"]')?.value ?? '';
        await gateway.addEvolution(patientId, {
          metricType,
          metricValue,
          metricUnit,
          narrative,
          baselineGroup: root.querySelector('[name="outcome-baseline"]')?.value ?? '',
          measuredAt: root.querySelector('[name="outcome-date"]')?.value ?? ''
        });
        await load();
        onMessage?.('Evolução registrada no acompanhamento longitudinal.', 'success');
        onChanged?.();
      } catch (error) {
        onMessage?.(error.message);
      }
    });

    root.querySelector('[data-outcome-filter]')?.addEventListener('change', async (event) => {
      local.metricFilter = event.currentTarget.value;
      await load();
      onChanged?.();
    });
  }

  return { load, render, bindActions };
}
