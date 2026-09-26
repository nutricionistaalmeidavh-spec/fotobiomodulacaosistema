import { escapeHtml } from '../ui/primitives.js';
import { bindDosimetryCalculator, renderDosimetryCalculator } from './dosimetry.js';
import { bindEquipmentWorkspace, renderEquipmentWorkspace } from './equipment-workspace.js';
import { bindTreatmentWorkflow, renderAdaptationPreview, renderTreatmentWorkflow } from './treatment-workflow.js';

export function createF0Views({ state, gateway, showMessage, rerenderFresh }) {
  function protocolCard(protocol) {
    const versions = protocol.versions || [];
    return `<article class="version-item" data-protocol-id="${escapeHtml(protocol.id)}">
      <header><div><strong>${escapeHtml(protocol.title)}</strong><div class="muted">Versão atual: v${escapeHtml(protocol.currentVersionNumber)}</div></div><button type="button" class="secondary" data-select-protocol="${escapeHtml(protocol.id)}">Abrir</button></header>
      <div class="version-list version-list-nested">${versions.map((version) => `<div><strong>v${escapeHtml(version.versionNumber)}</strong> — ${escapeHtml(version.changeSummary)} <span class="muted">(${escapeHtml(version.sourceType)})</span></div>`).join('')}</div>
    </article>`;
  }

  function protocols() {
    const selected = state.protocols.find((item) => item.id === state.selectedProtocolId) || state.protocols[0];
    return `<div class="page-stack">
      <div class="page-heading"><div><span class="eyebrow">PROTOCOLOS</span><h1>Biblioteca clínica versionada</h1><p>Versões antigas permanecem preservadas. Uma alteração gera um novo snapshot rastreável.</p></div><span class="status-badge status-success">Versionamento imutável</span></div>
      <div class="grid two-column">
        <section class="card"><span class="eyebrow">NOVO PROTOCOLO</span><h2>Registrar protocolo</h2>
          <label>Título<input name="protocol-title" placeholder="Ex.: Dor cervical"></label>
          <label>Resumo da versão inicial<input name="protocol-summary" placeholder="O que esta versão representa"></label>
          <div class="actions"><button type="button" class="primary" data-create-protocol>Criar protocolo + v1</button></div>
        </section>
        <section class="card"><span class="eyebrow">NOVA VERSÃO</span><h2>${selected ? escapeHtml(selected.title) : 'Selecione um protocolo'}</h2>
          <p class="muted">A versão anterior não é alterada. Uma nova linha é criada e mantida no histórico.</p>
          <label>Resumo da alteração<input name="version-summary" placeholder="Ex.: Ajuste documental"></label>
          <div class="actions"><button type="button" class="primary" data-create-version ${selected ? '' : 'disabled'}>Criar nova versão</button></div>
        </section>
        ${renderDosimetryCalculator()}
        <section class="card span-all"><div class="section-head"><div><span class="eyebrow">BIBLIOTECA</span><h2>Protocolos versionados</h2></div><span class="status-badge status-info">${state.protocols.length} cadastrados</span></div>
          <div class="version-list">${state.protocols.map(protocolCard).join('')}</div>
        </section>
      </div>
    </div>`;
  }

  function equipment() {
    return renderEquipmentWorkspace(state.equipment);
  }

  function sessions() {
    return renderTreatmentWorkflow({
      protocols: state.protocols,
      sessions: state.sessions,
      equipment: state.equipment,
      openEncounters: state.openEncounters,
      bodyMapCatalog: state.bodyMapCatalog,
      bodyMapPoints: state.bodyMapPoints
    });
  }

  function readNumber(root, name) {
    const value = root.querySelector(`[name="${name}"]`)?.value ?? '';
    return value === '' ? null : Number(value);
  }

  function validateBodyMapDraft(root) {
    const regionId = root.querySelector('[name="body-region"]')?.value || '';
    if (!regionId) return null;
    const view = root.querySelector('[name="body-view"]')?.value || '';
    const laterality = root.querySelector('[name="body-laterality"]')?.value || '';
    const x = readNumber(root, 'body-x');
    const y = readNumber(root, 'body-y');
    const region = state.bodyMapCatalog.find((item) => item.id === regionId);
    if (!region || !region.views?.includes(view)) throw new Error('A vista selecionada não é válida para a região corporal.');
    if (!['left', 'right', 'midline', 'bilateral'].includes(laterality)) throw new Error('Selecione uma lateralidade válida.');
    if (![x, y].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)) throw new Error('As coordenadas do mapa corporal devem ficar entre 0 e 1.');
    return {
      sequenceNumber: 1,
      regionId,
      view,
      laterality,
      x,
      y,
      anatomicalLabel: (root.querySelector('[name="body-label"]')?.value || '').trim() || region.label,
      parameters: { appliedEnergyJ: readNumber(root, 'applied-energy') }
    };
  }

  function bindActions(root = document) {
    bindDosimetryCalculator(root);
    bindTreatmentWorkflow(root, { equipment: state.equipment });
    bindEquipmentWorkspace(root, {
      gateway,
      onMessage: showMessage,
      onChanged: () => rerenderFresh()
    });

    root.querySelectorAll('[data-select-protocol]').forEach((button) => button.addEventListener('click', () => {
      state.selectedProtocolId = button.dataset.selectProtocol;
      root.dispatchEvent(new CustomEvent('pbm:rerender'));
    }));

    root.querySelector('[data-create-protocol]')?.addEventListener('click', async () => {
      showMessage('');
      const title = root.querySelector('[name="protocol-title"]')?.value ?? '';
      const changeSummary = root.querySelector('[name="protocol-summary"]')?.value ?? '';
      try {
        const protocol = await gateway.createProtocol({ title, changeSummary });
        state.selectedProtocolId = protocol.id;
        await rerenderFresh('Protocolo criado com versão v1 imutável.');
      } catch (error) { showMessage(error.message); }
    });

    root.querySelector('[data-create-version]')?.addEventListener('click', async () => {
      showMessage('');
      const changeSummary = root.querySelector('[name="version-summary"]')?.value ?? '';
      try {
        await gateway.createProtocolVersion(state.selectedProtocolId, { changeSummary });
        await rerenderFresh('Nova versão criada; versões anteriores permanecem preservadas.');
      } catch (error) { showMessage(error.message); }
    });

    root.querySelector('[data-preview-adaptation]')?.addEventListener('click', async () => {
      showMessage('');
      const protocolVersionId = root.querySelector('[name="session-protocol-version"]')?.value || '';
      const applicatorId = root.querySelector('[name="session-applicator"]')?.value || '';
      const selectedPowerMw = readNumber(root, 'selected-power');
      const target = root.querySelector('[data-adaptation-preview]');
      if (!protocolVersionId || !applicatorId) {
        if (target) target.innerHTML = '<div class="field-message field-error">Selecione protocolo, equipamento e aplicador.</div>';
        return;
      }
      try {
        const adaptation = await gateway.adaptProtocolVersion(protocolVersionId, applicatorId, selectedPowerMw);
        if (target) target.innerHTML = renderAdaptationPreview(adaptation);
      } catch (error) {
        if (target) target.innerHTML = `<div class="field-message field-error">${escapeHtml(error.message)}</div>`;
      }
    });

    root.querySelector('[data-create-session]')?.addEventListener('click', async () => {
      showMessage('');
      const encounterId = root.querySelector('[name="session-encounter"]')?.value ?? '';
      const protocolVersionId = root.querySelector('[name="session-protocol-version"]')?.value ?? '';
      const equipmentId = root.querySelector('[name="session-equipment"]')?.value ?? '';
      const applicatorId = root.querySelector('[name="session-applicator"]')?.value ?? '';
      const plannedEnergyJ = Number(root.querySelector('[name="planned-energy"]')?.value);
      const appliedEnergyJ = Number(root.querySelector('[name="applied-energy"]')?.value);
      const professionalAdjustmentReason = (root.querySelector('[name="adjustment-reason"]')?.value ?? '').trim();
      if (!encounterId || !protocolVersionId || !equipmentId || !applicatorId) {
        showMessage('Selecione atendimento, protocolo, equipamento e aplicador antes de registrar.');
        return;
      }
      if (plannedEnergyJ !== appliedEnergyJ && !professionalAdjustmentReason) {
        showMessage('Informe o motivo profissional quando os parâmetros aplicados diferirem dos planejados.');
        return;
      }
      try {
        const point = validateBodyMapDraft(root);
        const session = await gateway.createSession({
          encounterId,
          protocolVersionId,
          equipmentId,
          applicatorId,
          plannedEnergyJ,
          appliedEnergyJ,
          professionalAdjustmentReason
        });
        if (point) await gateway.recordBodyMapPoint(session.id, point);
        await rerenderFresh('Sessão registrada com parâmetros planejados e aplicados separados.');
      } catch (error) { showMessage(error.message); }
    });
  }

  return { templates: { protocols, equipment, sessions }, bindActions };
}
