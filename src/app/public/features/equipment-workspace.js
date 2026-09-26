import { escapeHtml } from '../ui/primitives.js';

function applicatorsFor(item = {}) {
  if (Array.isArray(item.applicators)) return item.applicators;
  return item.applicator ? [item.applicator] : [];
}

export function equipmentReadiness(item = {}) {
  const applicator = applicatorsFor(item).find((candidate) => candidate?.active !== false) || {};
  const power = applicator.fixedPowerMw ?? applicator.maxPowerMw;
  const complete = Boolean(
    String(item.manufacturer || '').trim() &&
    String(item.model || '').trim() &&
    String(applicator.name || '').trim() &&
    Number.isFinite(Number(applicator.wavelengthNm)) && Number(applicator.wavelengthNm) > 0 &&
    Number.isFinite(Number(power)) && Number(power) > 0
  );
  return { complete, label: complete ? 'Dados técnicos completos' : 'Dados técnicos incompletos' };
}

function powerDescription(applicator = {}) {
  if (applicator.fixedPowerMw) return `${escapeHtml(applicator.fixedPowerMw)} mW fixa`;
  if (applicator.minPowerMw || applicator.maxPowerMw) return `${escapeHtml(applicator.minPowerMw || '—')}–${escapeHtml(applicator.maxPowerMw || '—')} mW variável`;
  return '—';
}

function applicatorList(item = {}) {
  const applicators = applicatorsFor(item).filter((candidate) => candidate?.active !== false);
  if (!applicators.length) return '<p class="muted">Nenhum aplicador cadastrado.</p>';
  return `<div class="version-list">${applicators.map((applicator) => `<article class="version-item" data-equipment-applicator>
    <header><strong>${escapeHtml(applicator.name || 'Aplicador')}</strong><span class="muted">${applicator.wavelengthNm ? `${escapeHtml(applicator.wavelengthNm)} nm` : '—'}</span></header>
    <div>Potência: ${powerDescription(applicator)} · Área: ${applicator.spotAreaCm2 ? `${escapeHtml(applicator.spotAreaCm2)} cm²` : '—'}</div>
    <div class="muted">Modos: ${escapeHtml((applicator.modes || []).join(', ') || 'não informado')}</div>
  </article>`).join('')}</div>`;
}

export function renderEquipmentWorkspace(equipment = []) {
  const cards = equipment.length ? equipment.map((item) => {
    const readiness = equipmentReadiness(item);
    const legacyApplicator = item.applicator || applicatorsFor(item)[0] || {};
    return `<article class="card equipment-card" data-equipment-card data-equipment-id="${escapeHtml(item.id || '')}">
      <div class="section-head"><div><span class="eyebrow">EQUIPAMENTO</span><h2>${escapeHtml(`${item.manufacturer || ''} ${item.model || ''}`.trim() || 'Equipamento sem identificação')}</h2></div><span class="status-badge ${readiness.complete ? 'status-success' : 'status-warning'}">${readiness.label}</span></div>
      <dl class="equipment-specs">
        <div><dt>Número de série</dt><dd>${escapeHtml(item.serialNumber || '—')}</dd></div>
        <div><dt>Aplicador</dt><dd>${escapeHtml(legacyApplicator.name || '—')}</dd></div>
        <div><dt>Comprimento de onda</dt><dd>${legacyApplicator.wavelengthNm ? `${escapeHtml(legacyApplicator.wavelengthNm)} nm` : '—'}</dd></div>
        <div><dt>Potência máxima cadastrada</dt><dd>${legacyApplicator.maxPowerMw ? `${escapeHtml(legacyApplicator.maxPowerMw)} mW` : legacyApplicator.fixedPowerMw ? `${escapeHtml(legacyApplicator.fixedPowerMw)} mW` : '—'}</dd></div>
      </dl>
      ${applicatorList(item)}
      ${item.id ? `<div class="actions"><button type="button" class="secondary" data-add-applicator="${escapeHtml(item.id)}">Adicionar aplicador</button></div>` : ''}
      <p class="module-note">Os dados técnicos descrevem o equipamento. Compatibilidade só é calculada contra uma versão de protocolo escolhida pelo profissional.</p>
    </article>`;
  }).join('') : '<section class="card"><p class="muted">Nenhum equipamento cadastrado.</p></section>';

  return `<div class="page-stack" data-equipment-workspace>
    <div class="page-heading"><div><span class="eyebrow">EQUIPAMENTOS</span><h1>Equipamentos e aplicadores</h1><p>Inventário técnico persistido para seleção explícita durante o planejamento da sessão.</p></div><button type="button" class="primary" data-new-equipment>Novo equipamento</button></div>
    <div class="equipment-grid">${cards}</div>

    <dialog data-equipment-dialog aria-label="Novo equipamento">
      <form method="dialog" data-equipment-form>
        <div class="section-head"><div><span class="eyebrow">CADASTRO</span><h2>Novo equipamento</h2></div></div>
        <div class="form-grid">
          <label>Fabricante<input name="manufacturer" required></label>
          <label>Modelo<input name="model" required></label>
          <label>Número de série<input name="serialNumber"></label>
          <label class="field-span">Observações<textarea name="notes"></textarea></label>
        </div>
        <div class="actions"><button type="button" class="ghost" data-close-equipment>Cancelar</button><button type="submit" class="primary">Salvar equipamento</button></div>
      </form>
    </dialog>

    <dialog data-applicator-dialog aria-label="Novo aplicador">
      <form method="dialog" data-applicator-form>
        <input type="hidden" name="equipmentId">
        <div class="section-head"><div><span class="eyebrow">APLICADOR</span><h2>Novo aplicador</h2></div></div>
        <div class="form-grid">
          <label>Nome do aplicador<input name="name" required></label>
          <label>Comprimento de onda (nm)<input type="number" min="1" name="wavelengthNm" required></label>
          <label>Potência fixa (mW)<input type="number" min="0" step="any" name="fixedPowerMw"></label>
          <label>Potência mínima (mW)<input type="number" min="0" step="any" name="minPowerMw"></label>
          <label>Potência máxima (mW)<input type="number" min="0" step="any" name="maxPowerMw"></label>
          <label>Área do spot (cm²)<input type="number" min="0" step="any" name="spotAreaCm2"></label>
          <label>Modo<select name="mode"><option value="continuous">continuous</option><option value="pulsed">pulsed</option></select></label>
          <label class="field-span">Limitações<textarea name="limitations"></textarea></label>
        </div>
        <p class="module-note">Use potência fixa ou faixa mínima/máxima. Em aplicadores variáveis, a potência continuará sendo escolhida explicitamente no planejamento.</p>
        <div class="actions"><button type="button" class="ghost" data-close-applicator>Cancelar</button><button type="submit" class="primary">Salvar aplicador</button></div>
      </form>
    </dialog>
  </div>`;
}

export function bindEquipmentWorkspace(root = document, { gateway, onChanged, onMessage } = {}) {
  const workspace = root.querySelector('[data-equipment-workspace]');
  if (!workspace || !gateway) return;
  const equipmentDialog = workspace.querySelector('[data-equipment-dialog]');
  const applicatorDialog = workspace.querySelector('[data-applicator-dialog]');

  workspace.querySelector('[data-new-equipment]')?.addEventListener('click', () => equipmentDialog?.showModal());
  workspace.querySelector('[data-close-equipment]')?.addEventListener('click', () => equipmentDialog?.close());
  workspace.querySelector('[data-close-applicator]')?.addEventListener('click', () => applicatorDialog?.close());
  workspace.querySelectorAll('[data-add-applicator]').forEach((button) => button.addEventListener('click', () => {
    const input = applicatorDialog?.querySelector('[name="equipmentId"]');
    if (input) input.value = button.dataset.addApplicator;
    applicatorDialog?.showModal();
  }));

  workspace.querySelector('[data-equipment-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await gateway.createEquipment({
        manufacturer: data.get('manufacturer'),
        model: data.get('model'),
        serialNumber: data.get('serialNumber'),
        notes: data.get('notes')
      });
      equipmentDialog?.close();
      form.reset();
      onMessage?.('Equipamento cadastrado.', 'success');
      await onChanged?.();
    } catch (error) {
      onMessage?.(error.message);
    }
  });

  workspace.querySelector('[data-applicator-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const numberOrNull = (name) => data.get(name) === '' ? null : Number(data.get(name));
    try {
      await gateway.createApplicator(data.get('equipmentId'), {
        name: data.get('name'),
        wavelengthNm: Number(data.get('wavelengthNm')),
        fixedPowerMw: numberOrNull('fixedPowerMw'),
        minPowerMw: numberOrNull('minPowerMw'),
        maxPowerMw: numberOrNull('maxPowerMw'),
        spotAreaCm2: numberOrNull('spotAreaCm2'),
        modes: [data.get('mode')],
        limitations: data.get('limitations')
      });
      applicatorDialog?.close();
      form.reset();
      onMessage?.('Aplicador cadastrado.', 'success');
      await onChanged?.();
    } catch (error) {
      onMessage?.(error.message);
    }
  });
}
