import { escapeHtml } from '../ui/primitives.js';
import { bindDosimetryCalculator, renderDosimetryCalculator } from './dosimetry.js';

export function createF0Views({ state, api, showMessage, rerenderFresh }) {
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
    return `<div class="page-stack"><div class="page-heading"><div><span class="eyebrow">EQUIPAMENTOS</span><h1>Equipamentos e aplicadores</h1><p>Inventário técnico local preparado para compatibilidade e dosimetria nas próximas fases.</p></div><span class="status-badge status-info">Estrutura F0</span></div>
      <section class="card">
        <div class="table-wrap"><table><thead><tr><th>Equipamento</th><th>Aplicador</th><th>Comprimento de onda</th><th>Potência máx.</th></tr></thead><tbody>${state.equipment.map((item) => `<tr><td><strong>${escapeHtml(item.manufacturer)} ${escapeHtml(item.model)}</strong><div class="muted">${escapeHtml(item.serialNumber || '')}</div></td><td>${escapeHtml(item.applicator?.name || '—')}</td><td>${item.applicator?.wavelengthNm ? `${escapeHtml(item.applicator.wavelengthNm)} nm` : '—'}</td><td>${item.applicator?.maxPowerMw ? `${escapeHtml(item.applicator.maxPowerMw)} mW` : '—'}</td></tr>`).join('')}</tbody></table></div>
      </section>
    </div>`;
  }

  function sessions() {
    const versions = state.protocols.flatMap((protocol) => (protocol.versions || []).map((version) => ({ protocol, version })));
    return `<div class="page-stack"><div class="page-heading"><div><span class="eyebrow">SESSÕES F0</span><h1>Registro rastreável de aplicação</h1><p>O registro realizado permanece separado do que foi planejado.</p></div><span class="status-badge status-warning">Planejado ≠ aplicado</span></div>
      <div class="grid two-column sessions-layout">
        <section class="card"><span class="eyebrow">REGISTRO RASTREÁVEL</span><h2>Nova sessão</h2>
          <label>Versão do protocolo<select name="session-protocol-version">${versions.map(({ protocol, version }) => `<option value="${escapeHtml(version.id)}">${escapeHtml(protocol.title)} · v${version.versionNumber}</option>`).join('')}</select></label>
          <div class="form-grid"><label>Energia planejada (J)<input type="number" min="0.01" step="0.1" name="planned-energy" value="4"></label><label>Energia aplicada (J)<input type="number" min="0.01" step="0.1" name="applied-energy" value="4"></label></div>
          <label>Motivo profissional do ajuste<input name="adjustment-reason" placeholder="Obrigatório se aplicado ≠ planejado"></label>
          <div class="actions"><button type="button" class="primary" data-create-session>Registrar sessão</button></div>
        </section>
        <section class="card"><div class="section-head"><div><span class="eyebrow">HISTÓRICO</span><h2>Sessões registradas</h2></div></div>
          <div class="version-list">${state.sessions.length ? state.sessions.map((session) => `<div class="version-item"><header><strong>${escapeHtml(session.protocolTitle || 'Sem protocolo')} · v${escapeHtml(session.protocolVersionNumber || '—')}</strong><span class="muted">${escapeHtml(session.status)}</span></header><div>Planejado: ${escapeHtml(session.plannedParameters.energyJ)} J · Aplicado: ${escapeHtml(session.appliedParameters.energyJ)} J</div>${session.professionalAdjustmentReason ? `<div><strong>Justificativa:</strong> ${escapeHtml(session.professionalAdjustmentReason)}</div>` : ''}</div>`).join('') : '<p class="muted">Nenhuma sessão registrada ainda.</p>'}</div>
        </section>
      </div>
    </div>`;
  }

  function audit() {
    return `<div class="page-stack"><div class="page-heading"><div><span class="eyebrow">AUDITORIA</span><h1>Trilha clínica append-only</h1><p>Eventos críticos permanecem encadeados e verificáveis.</p></div><span class="status-badge ${state.audit.valid ? 'status-success' : 'status-danger'}">${state.audit.valid ? 'Cadeia íntegra' : 'Integridade comprometida'}</span></div>
      <section class="card"><div class="section-head"><div><h2>Auditoria append-only</h2><p>Eventos são encadeados por SHA-256. UPDATE e DELETE permanecem bloqueados no banco.</p></div></div>
        <div class="audit-list">${state.audit.events.length ? state.audit.events.slice().reverse().map((event) => `<article class="audit-item"><header><strong>${escapeHtml(event.action)}</strong><span class="muted">${escapeHtml(event.createdAt)}</span></header><div>${escapeHtml(event.entityType)} · <span class="code">${escapeHtml(event.entityId)}</span></div><div class="code">hash ${escapeHtml(event.eventHash)}</div></article>`).join('') : '<p class="muted">Ações auditáveis aparecerão aqui.</p>'}</div>
      </section>
    </div>`;
  }

  function bindActions(root = document) {
    bindDosimetryCalculator(root);
    root.querySelectorAll('[data-select-protocol]').forEach((button) => button.addEventListener('click', () => {
      state.selectedProtocolId = button.dataset.selectProtocol;
      root.dispatchEvent(new CustomEvent('pbm:rerender'));
    }));

    root.querySelector('[data-create-protocol]')?.addEventListener('click', async () => {
      showMessage('');
      const title = root.querySelector('[name="protocol-title"]')?.value ?? '';
      const changeSummary = root.querySelector('[name="protocol-summary"]')?.value ?? '';
      try {
        const result = await api('/api/protocols', { method: 'POST', body: JSON.stringify({ title, changeSummary }) });
        state.selectedProtocolId = result.protocol.id;
        await rerenderFresh('Protocolo criado com versão v1 imutável.');
      } catch (error) { showMessage(error.message); }
    });

    root.querySelector('[data-create-version]')?.addEventListener('click', async () => {
      showMessage('');
      const changeSummary = root.querySelector('[name="version-summary"]')?.value ?? '';
      try {
        await api(`/api/protocols/${encodeURIComponent(state.selectedProtocolId)}/versions`, { method: 'POST', body: JSON.stringify({ changeSummary }) });
        await rerenderFresh('Nova versão criada; versões anteriores permanecem preservadas.');
      } catch (error) { showMessage(error.message); }
    });

    root.querySelector('[data-create-session]')?.addEventListener('click', async () => {
      showMessage('');
      const protocolVersionId = root.querySelector('[name="session-protocol-version"]')?.value ?? '';
      const plannedEnergyJ = Number(root.querySelector('[name="planned-energy"]')?.value);
      const appliedEnergyJ = Number(root.querySelector('[name="applied-energy"]')?.value);
      const professionalAdjustmentReason = (root.querySelector('[name="adjustment-reason"]')?.value ?? '').trim();
      if (plannedEnergyJ !== appliedEnergyJ && !professionalAdjustmentReason) {
        showMessage('Informe o motivo profissional quando os parâmetros aplicados diferirem dos planejados.');
        return;
      }
      try {
        await api('/api/sessions', { method: 'POST', body: JSON.stringify({ protocolVersionId, plannedEnergyJ, appliedEnergyJ, professionalAdjustmentReason }) });
        await rerenderFresh('Sessão registrada com parâmetros planejados e aplicados separados.');
      } catch (error) { showMessage(error.message); }
    });
  }

  return { templates: { protocols, equipment, sessions, audit }, bindActions };
}
