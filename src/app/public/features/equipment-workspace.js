import { escapeHtml } from '../ui/primitives.js';

export function equipmentReadiness(item = {}) {
  const applicator = item.applicator || {};
  const complete = Boolean(
    String(item.manufacturer || '').trim() &&
    String(item.model || '').trim() &&
    String(applicator.name || '').trim() &&
    Number.isFinite(Number(applicator.wavelengthNm)) && Number(applicator.wavelengthNm) > 0 &&
    Number.isFinite(Number(applicator.maxPowerMw)) && Number(applicator.maxPowerMw) > 0
  );
  return { complete, label: complete ? 'Dados técnicos completos' : 'Dados técnicos incompletos' };
}

export function renderEquipmentWorkspace(equipment = []) {
  const cards = equipment.length ? equipment.map((item) => {
    const readiness = equipmentReadiness(item);
    const applicator = item.applicator || {};
    return `<article class="card equipment-card" data-equipment-card>
      <div class="section-head"><div><span class="eyebrow">EQUIPAMENTO</span><h2>${escapeHtml(`${item.manufacturer || ''} ${item.model || ''}`.trim() || 'Equipamento sem identificação')}</h2></div><span class="status-badge ${readiness.complete ? 'status-success' : 'status-warning'}">${readiness.label}</span></div>
      <dl class="equipment-specs">
        <div><dt>Número de série</dt><dd>${escapeHtml(item.serialNumber || '—')}</dd></div>
        <div><dt>Aplicador</dt><dd data-equipment-applicator>${escapeHtml(applicator.name || '—')}</dd></div>
        <div><dt>Comprimento de onda</dt><dd>${applicator.wavelengthNm ? `${escapeHtml(applicator.wavelengthNm)} nm` : '—'}</dd></div>
        <div><dt>Potência máxima cadastrada</dt><dd>${applicator.maxPowerMw ? `${escapeHtml(applicator.maxPowerMw)} mW` : '—'}</dd></div>
      </dl>
      <p class="module-note">A interface apenas exibe os dados técnicos cadastrados. Não infere indicação, compatibilidade clínica ou adequação a um tratamento.</p>
    </article>`;
  }).join('') : '<section class="card"><p class="muted">Nenhum equipamento cadastrado no inventário F0.</p></section>';

  return `<div class="page-stack" data-equipment-workspace>
    <div class="page-heading"><div><span class="eyebrow">EQUIPAMENTOS</span><h1>Equipamentos e aplicadores</h1><p>Inventário técnico real do backend F0, organizado para consulta de especificações cadastradas.</p></div><span class="status-badge status-info">Dados técnicos</span></div>
    <div class="equipment-grid">${cards}</div>
  </div>`;
}
