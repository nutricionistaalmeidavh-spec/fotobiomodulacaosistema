import { dialogFrame, emptyState, escapeHtml, statusBadge } from '../ui/primitives.js';
import { bindDosimetryCalculator, renderDosimetryCalculator } from './dosimetry.js';

const TABS = Object.freeze([
  ['library', 'Biblioteca'],
  ['evidence', 'Evidências'],
  ['search', 'Busca clínica']
]);

function compact(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function numberOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function protocolVersionLabel(protocol) {
  return `v${protocol.currentVersionNumber || 1}`;
}

export function createProtocolWorkspace({ gateway, onChanged, onMessage }) {
  const local = {
    activeTab: 'library',
    protocols: [],
    evidence: [],
    evidenceLinks: new Map(),
    searchResults: [],
    protocolDialog: false,
    evidenceDialog: false,
    linkProtocolId: null
  };

  async function loadLinks(protocols = local.protocols) {
    const entries = await Promise.all(protocols.filter((p) => p.currentVersionId).map(async (protocol) => [
      protocol.currentVersionId,
      await gateway.listProtocolEvidence(protocol.currentVersionId)
    ]));
    local.evidenceLinks = new Map(entries);
  }

  async function load() {
    [local.protocols, local.evidence] = await Promise.all([
      gateway.listProtocols(),
      gateway.listEvidence()
    ]);
    await loadLinks();
  }

  function tabs() {
    return `<nav class="workspace-tabs" role="tablist" aria-label="Áreas de protocolos">${TABS.map(([id, label]) => `<button type="button" role="tab" data-protocol-tab="${id}" aria-selected="${local.activeTab === id ? 'true' : 'false'}" class="${local.activeTab === id ? 'is-active' : ''}">${label}</button>`).join('')}</nav>`;
  }

  function linkedEvidence(protocol) {
    const links = local.evidenceLinks.get(protocol.currentVersionId) || [];
    if (!links.length) return '<p class="muted">Nenhuma evidência vinculada a esta versão.</p>';
    return `<ul class="pending-list">${links.map((link) => `<li><strong>${escapeHtml(link.evidence?.title || link.evidenceId)}</strong> · ${escapeHtml(link.relationType || 'context')} ${link.note ? `— ${escapeHtml(link.note)}` : ''}</li>`).join('')}</ul>`;
  }

  function protocolCard(protocol, { linkAction = false } = {}) {
    return `<article class="card" data-protocol-card data-protocol-id="${escapeHtml(protocol.id)}">
      <div class="section-head"><div><span class="eyebrow">PROTOCOLO · ${protocolVersionLabel(protocol)}</span><h3>${escapeHtml(protocol.title)}</h3></div>${statusBadge(protocol.status || 'draft', protocol.status === 'published' ? 'success' : 'info')}</div>
      <p class="muted">Versão científica imutável em uso: ${escapeHtml(protocolVersionLabel(protocol))}</p>
      ${linkedEvidence(protocol)}
      <div class="actions">
        <button type="button" class="secondary compact-button" data-new-protocol-version="${escapeHtml(protocol.id)}">Nova versão</button>
        ${linkAction ? `<button type="button" class="secondary compact-button" data-link-evidence="${escapeHtml(protocol.id)}">Vincular evidência</button>` : ''}
      </div>
    </article>`;
  }

  function library() {
    return `<div class="page-stack">
      <section class="card">
        <div class="section-head"><div><span class="eyebrow">BIBLIOTECA</span><h2>Protocolos versionados</h2></div><button type="button" class="primary" data-new-protocol>Novo protocolo</button></div>
        <p class="muted">Protocolos profissionais são versionados. Criar uma nova versão nunca altera silenciosamente a versão histórica.</p>
      </section>
      ${renderDosimetryCalculator()}
      <section class="grid two-column">${local.protocols.length ? local.protocols.map((item) => protocolCard(item)).join('') : emptyState({ title: 'Nenhum protocolo', description: 'Cadastre o primeiro protocolo profissional.' })}</section>
    </div>`;
  }

  function evidenceCard(item) {
    return `<article class="card" data-evidence-card="${escapeHtml(item.id)}">
      <div class="section-head"><div><span class="eyebrow">${escapeHtml(item.studyType || 'EVIDÊNCIA')}</span><h3>${escapeHtml(item.title)}</h3></div>${item.publicationYear ? statusBadge(String(item.publicationYear), 'info') : ''}</div>
      ${item.authors ? `<p>${escapeHtml(item.authors)}</p>` : ''}
      ${item.abstractText ? `<p class="muted">${escapeHtml(item.abstractText)}</p>` : ''}
      <div class="muted">${[item.doi, ...(item.conditions || []), ...(item.bodyRegions || [])].filter(Boolean).map(escapeHtml).join(' · ')}</div>
    </article>`;
  }

  function evidence() {
    return `<div class="page-stack">
      <section class="card">
        <div class="section-head"><div><span class="eyebrow">EVIDÊNCIAS</span><h2>Biblioteca científica local</h2></div><button type="button" class="primary" data-new-evidence>Nova evidência</button></div>
        <p class="muted">Uma evidência pode ser vinculada a uma versão exata do protocolo. O vínculo não modifica parâmetros clínicos.</p>
      </section>
      <section class="grid two-column">${local.evidence.length ? local.evidence.map(evidenceCard).join('') : emptyState({ title: 'Nenhuma evidência', description: 'Cadastre referências científicas para consulta local.' })}</section>
      <section class="page-stack"><h2>Vínculos por protocolo</h2>${local.protocols.map((item) => protocolCard(item, { linkAction: true })).join('')}</section>
    </div>`;
  }

  function searchResult(item) {
    const indications = item.indications || [];
    const contraindications = item.contraindications || [];
    return `<article class="card" data-clinical-search-result>
      <div class="section-head"><div><span class="eyebrow">${escapeHtml(`v${item.version?.versionNumber || '—'}`)}</span><h3>${escapeHtml(item.protocol?.title || 'Protocolo')}</h3></div>${statusBadge(item.protocol?.status || 'draft', 'info')}</div>
      ${indications.length ? `<ul class="pending-list">${indications.map((indication) => `<li>${escapeHtml([indication.condition, indication.bodyRegion, indication.therapeuticGoal, indication.professionalArea].filter(Boolean).join(' · '))}</li>`).join('')}</ul>` : '<p class="muted">Sem restrição estruturada cadastrada para esta versão.</p>'}
      <h4>Contraindicações/precauções cadastradas</h4>
      ${contraindications.length ? `<ul class="pending-list">${contraindications.map((item) => `<li><strong>${escapeHtml(item.label)}</strong>${item.rationale ? ` — ${escapeHtml(item.rationale)}` : ''}</li>`).join('')}</ul>` : '<p class="muted">Nenhuma contraindicação estruturada vinculada a esta versão.</p>'}
    </article>`;
  }

  function search() {
    return `<div class="page-stack">
      <section class="card">
        <div class="section-head"><div><span class="eyebrow">BUSCA CLÍNICA</span><h2>Filtrar protocolos por contexto documentado</h2></div></div>
        <p class="muted">A busca é determinística e descritiva: o sistema <strong>não recomenda protocolo ou dose automaticamente</strong>, não ranqueia e não escolhe tratamento.</p>
        <div class="form-grid">
          <label>Texto livre<input name="clinical-search-query"></label>
          <label>Condição clínica<input name="clinical-search-condition"></label>
          <label>Sintoma<input name="clinical-search-symptom"></label>
          <label>Região corporal<input name="clinical-search-region"></label>
          <label>Objetivo terapêutico<input name="clinical-search-goal"></label>
          <label>Fase clínica<input name="clinical-search-phase"></label>
          <label>Área profissional<input name="clinical-search-professional-area"></label>
          <label>Idade<input name="clinical-search-age" type="number" min="0" max="130"></label>
          <label>Comprimento de onda (nm)<input name="clinical-search-wavelength" type="number" min="1"></label>
        </div>
        <div class="actions"><button type="button" class="primary" data-clinical-search>Buscar protocolos</button></div>
      </section>
      <section data-clinical-search-results class="page-stack">${local.searchResults.length ? local.searchResults.map(searchResult).join('') : emptyState({ title: 'Nenhum resultado carregado', description: 'Preencha os filtros e execute a busca.' })}</section>
    </div>`;
  }

  function protocolDialog() {
    if (!local.protocolDialog) return '';
    const body = `<div class="form-grid">
      <label>Título<input name="protocol-title"></label>
      <label>Resumo da versão<input name="protocol-change-summary"></label>
      <label>Condição<input name="protocol-condition"></label>
      <label>Sintoma<input name="protocol-symptom"></label>
      <label>Região corporal<input name="protocol-body-region"></label>
      <label>Objetivo terapêutico<input name="protocol-goal"></label>
      <label>Fase clínica<input name="protocol-phase"></label>
      <label>Área profissional<input name="protocol-professional-area"></label>
      <label>Idade mínima<input name="protocol-min-age" type="number" min="0" max="130"></label>
      <label>Idade máxima<input name="protocol-max-age" type="number" min="0" max="130"></label>
    </div>`;
    return dialogFrame({ title: 'Novo protocolo', description: 'Cadastre a primeira versão e seu contexto estruturado.', body, footer: '<button type="button" class="secondary" data-close-protocol-dialog>Cancelar</button><button type="button" class="primary" data-save-protocol>Salvar protocolo</button>' });
  }

  function evidenceDialog() {
    if (!local.evidenceDialog) return '';
    const body = `<div class="form-grid">
      <label>Título<input name="evidence-title"></label>
      <label>Autores<input name="evidence-authors"></label>
      <label>Ano<input name="evidence-year" type="number" min="1800" max="3000"></label>
      <label>Tipo de publicação<input name="evidence-study-type"></label>
      <label>Nível de evidência<input name="evidence-level" placeholder="Classificação descritiva"></label>
      <label>DOI<input name="evidence-doi"></label>
      <label>Condição<input name="evidence-condition"></label>
      <label>Região corporal<input name="evidence-region"></label>
      <label>Comprimento de onda (nm)<input name="evidence-wavelength" type="number" min="1"></label>
    </div><label>Resumo<textarea name="evidence-summary" rows="4"></textarea></label>`;
    return dialogFrame({ title: 'Nova evidência', description: 'Registro bibliográfico local e descritivo.', body, footer: '<button type="button" class="secondary" data-close-evidence-dialog>Cancelar</button><button type="button" class="primary" data-save-evidence>Salvar evidência</button>' });
  }

  function linkDialog() {
    if (!local.linkProtocolId) return '';
    const protocol = local.protocols.find((item) => item.id === local.linkProtocolId);
    if (!protocol) return '';
    const body = `<p>Vínculo com ${escapeHtml(protocol.title)} · ${escapeHtml(protocolVersionLabel(protocol))}</p>
      <label>Evidência<select name="link-evidence-id">${local.evidence.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.title)}</option>`).join('')}</select></label>
      <label>Nota do vínculo<textarea name="link-evidence-note" rows="3"></textarea></label>`;
    return dialogFrame({ title: 'Vincular evidência', description: 'O vínculo será gravado na versão atual exata.', body, footer: '<button type="button" class="secondary" data-close-link-dialog>Cancelar</button><button type="button" class="primary" data-confirm-link>Confirmar vínculo</button>' });
  }

  function render() {
    const panel = local.activeTab === 'evidence' ? evidence() : local.activeTab === 'search' ? search() : library();
    return `<div class="page-stack" data-protocol-workspace>
      <div class="page-heading"><div><span class="eyebrow">PROTOCOLOS</span><h1>Protocolos</h1><p>Protocolos profissionais versionados, evidências locais e busca clínica determinística.</p></div></div>
      ${tabs()}
      ${panel}
      ${protocolDialog()}${evidenceDialog()}${linkDialog()}
    </div>`;
  }

  async function refresh() {
    await load();
    onChanged?.();
  }

  function bindActions(root = document) {
    bindDosimetryCalculator(root);
    root.querySelectorAll('[data-protocol-tab]').forEach((button) => button.addEventListener('click', () => { local.activeTab = button.dataset.protocolTab; onChanged?.(); }));
    root.querySelector('[data-new-protocol]')?.addEventListener('click', () => { local.protocolDialog = true; onChanged?.(); });
    root.querySelector('[data-close-protocol-dialog]')?.addEventListener('click', () => { local.protocolDialog = false; onChanged?.(); });
    root.querySelector('[data-save-protocol]')?.addEventListener('click', async () => {
      try {
        const indication = {
          condition: compact(root.querySelector('[name="protocol-condition"]')?.value),
          symptom: compact(root.querySelector('[name="protocol-symptom"]')?.value),
          bodyRegion: compact(root.querySelector('[name="protocol-body-region"]')?.value),
          therapeuticGoal: compact(root.querySelector('[name="protocol-goal"]')?.value),
          clinicalPhase: compact(root.querySelector('[name="protocol-phase"]')?.value),
          professionalArea: compact(root.querySelector('[name="protocol-professional-area"]')?.value),
          minAgeYears: numberOrNull(root.querySelector('[name="protocol-min-age"]')?.value),
          maxAgeYears: numberOrNull(root.querySelector('[name="protocol-max-age"]')?.value)
        };
        await gateway.createProtocol({
          title: root.querySelector('[name="protocol-title"]')?.value || '',
          changeSummary: root.querySelector('[name="protocol-change-summary"]')?.value || '',
          parameters: {},
          indications: [indication]
        });
        local.protocolDialog = false;
        await refresh();
        onMessage?.('Protocolo e versão inicial registrados.', 'success');
      } catch (error) { onMessage?.(error.message); }
    });

    root.querySelector('[data-new-evidence]')?.addEventListener('click', () => { local.evidenceDialog = true; onChanged?.(); });
    root.querySelector('[data-close-evidence-dialog]')?.addEventListener('click', () => { local.evidenceDialog = false; onChanged?.(); });
    root.querySelector('[data-save-evidence]')?.addEventListener('click', async () => {
      try {
        const level = compact(root.querySelector('[name="evidence-level"]')?.value);
        const summary = compact(root.querySelector('[name="evidence-summary"]')?.value);
        await gateway.createEvidence({
          title: root.querySelector('[name="evidence-title"]')?.value || '',
          authors: compact(root.querySelector('[name="evidence-authors"]')?.value),
          publicationYear: numberOrNull(root.querySelector('[name="evidence-year"]')?.value),
          studyType: root.querySelector('[name="evidence-study-type"]')?.value || '',
          doi: compact(root.querySelector('[name="evidence-doi"]')?.value),
          abstractText: summary,
          notes: level ? `Classificação informada: ${level}` : null,
          conditions: [compact(root.querySelector('[name="evidence-condition"]')?.value)].filter(Boolean),
          bodyRegions: [compact(root.querySelector('[name="evidence-region"]')?.value)].filter(Boolean),
          wavelengthsNm: [numberOrNull(root.querySelector('[name="evidence-wavelength"]')?.value)].filter((value) => value != null)
        });
        local.evidenceDialog = false;
        await refresh();
        local.activeTab = 'evidence';
        onChanged?.();
        onMessage?.('Evidência científica registrada localmente.', 'success');
      } catch (error) { onMessage?.(error.message); }
    });

    root.querySelectorAll('[data-link-evidence]').forEach((button) => button.addEventListener('click', () => { local.linkProtocolId = button.dataset.linkEvidence; onChanged?.(); }));
    root.querySelector('[data-close-link-dialog]')?.addEventListener('click', () => { local.linkProtocolId = null; onChanged?.(); });
    root.querySelector('[data-confirm-link]')?.addEventListener('click', async () => {
      const protocol = local.protocols.find((item) => item.id === local.linkProtocolId);
      try {
        await gateway.linkEvidenceToProtocolVersion(
          protocol.currentVersionId,
          root.querySelector('[name="link-evidence-id"]')?.value,
          root.querySelector('[name="link-evidence-note"]')?.value || ''
        );
        local.linkProtocolId = null;
        await loadLinks();
        onChanged?.();
        onMessage?.('Evidência vinculada à versão exata do protocolo.', 'success');
      } catch (error) { onMessage?.(error.message); }
    });

    root.querySelectorAll('[data-new-protocol-version]').forEach((button) => button.addEventListener('click', async () => {
      const summary = window.prompt('Resumo da nova versão:');
      if (!summary) return;
      try {
        await gateway.createProtocolVersion(button.dataset.newProtocolVersion, { changeSummary: summary });
        await refresh();
        onMessage?.('Nova versão criada sem alterar a versão anterior.', 'success');
      } catch (error) { onMessage?.(error.message); }
    }));

    root.querySelector('[data-clinical-search]')?.addEventListener('click', async () => {
      try {
        local.searchResults = await gateway.searchClinicalProtocols({
          query: root.querySelector('[name="clinical-search-query"]')?.value || '',
          condition: root.querySelector('[name="clinical-search-condition"]')?.value || '',
          symptom: root.querySelector('[name="clinical-search-symptom"]')?.value || '',
          bodyRegion: root.querySelector('[name="clinical-search-region"]')?.value || '',
          therapeuticGoal: root.querySelector('[name="clinical-search-goal"]')?.value || '',
          clinicalPhase: root.querySelector('[name="clinical-search-phase"]')?.value || '',
          professionalArea: root.querySelector('[name="clinical-search-professional-area"]')?.value || '',
          ageYears: root.querySelector('[name="clinical-search-age"]')?.value || '',
          wavelengthNm: root.querySelector('[name="clinical-search-wavelength"]')?.value || ''
        });
        onChanged?.();
      } catch (error) { onMessage?.(error.message); }
    });
  }

  return { load, render, bindActions };
}
