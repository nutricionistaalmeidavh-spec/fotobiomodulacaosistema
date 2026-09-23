const view = document.querySelector('#view');
let mounted = false;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Falha na biblioteca científica.');
  return payload;
}

function splitCsv(value) {
  return String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
}

function splitNumbers(value) {
  return splitCsv(value).map(Number).filter((item) => Number.isFinite(item) && item > 0);
}

function currentSection() {
  return view?.querySelector('[data-f6-evidence]');
}

function renderEvidence(items) {
  const section = currentSection();
  if (!section) return;
  const list = section.querySelector('[data-f6-evidence-list]');
  const select = section.querySelector('[name="f6-link-evidence"]');
  if (!list || !select) return;

  list.innerHTML = items.length ? items.map((item) => `
    <article class="f6-evidence-item" data-f6-evidence-item data-evidence-id="${escapeHtml(item.id)}">
      <strong>${escapeHtml(item.title)}</strong>
      <span>${escapeHtml(item.studyType)}${item.publicationYear ? ` · ${escapeHtml(item.publicationYear)}` : ''}</span>
      <small>${escapeHtml([
        item.authors,
        item.sourceName,
        item.doi ? `DOI ${item.doi}` : null,
        item.conditions?.length ? `Condições: ${item.conditions.join(', ')}` : null,
        item.bodyRegions?.length ? `Regiões: ${item.bodyRegions.join(', ')}` : null,
        item.wavelengthsNm?.length ? `${item.wavelengthsNm.join(', ')} nm` : null
      ].filter(Boolean).join(' · '))}</small>
    </article>
  `).join('') : '<p class="empty-state">Nenhuma referência encontrada.</p>';

  const selected = select.value;
  select.innerHTML = '<option value="">Selecione uma evidência</option>' + items.map((item) =>
    `<option value="${escapeHtml(item.id)}">${escapeHtml(item.title)}</option>`
  ).join('');
  if (items.some((item) => item.id === selected)) select.value = selected;
}

async function refreshEvidence() {
  const section = currentSection();
  if (!section) return;
  const query = section.querySelector('[name="f6-search"]')?.value.trim() || '';
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  const payload = await api(`/api/evidence${params.size ? `?${params}` : ''}`);
  renderEvidence(payload.evidence || []);
}

async function refreshProtocols() {
  const section = currentSection();
  if (!section) return;
  const select = section.querySelector('[name="f6-link-version"]');
  const payload = await api('/api/protocols');
  const versions = (payload.protocols || []).flatMap((protocol) =>
    (protocol.versions || []).map((version) => ({
      id: version.id,
      label: `${protocol.title} · v${version.versionNumber}`
    }))
  );
  select.innerHTML = '<option value="">Selecione uma versão de protocolo</option>' + versions.map((item) =>
    `<option value="${escapeHtml(item.id)}">${escapeHtml(item.label)}</option>`
  ).join('');
}

async function refreshLinked() {
  const section = currentSection();
  if (!section) return;
  const versionId = section.querySelector('[name="f6-link-version"]')?.value || '';
  const list = section.querySelector('[data-f6-linked-list]');
  if (!versionId) {
    list.innerHTML = '<p class="empty-state">Selecione uma versão para ver as evidências vinculadas.</p>';
    return;
  }
  const payload = await api(`/api/protocol-versions/${encodeURIComponent(versionId)}/evidence`);
  const items = payload.evidence || [];
  list.innerHTML = items.length ? items.map((item) => `
    <article class="f6-linked-item" data-f6-linked-item>
      <strong>${escapeHtml(item.evidence?.title || item.evidenceId)}</strong>
      <span>${escapeHtml(item.relationType)}</span>
      <small>${escapeHtml(item.note || 'Vínculo documental sem alteração do protocolo.')}</small>
    </article>
  `).join('') : '<p class="empty-state">Nenhuma evidência vinculada a esta versão.</p>';
}

async function createEvidence() {
  const section = currentSection();
  if (!section) return;
  const feedback = section.querySelector('[data-f6-feedback]');
  const button = section.querySelector('[data-create-evidence-f6]');
  if (button.disabled) return;
  button.disabled = true;
  feedback.textContent = 'Salvando referência…';
  try {
    const publicationYearRaw = section.querySelector('[name="f6-year"]').value;
    await api('/api/evidence', {
      method: 'POST',
      body: JSON.stringify({
        title: section.querySelector('[name="f6-title"]').value.trim(),
        authors: section.querySelector('[name="f6-authors"]').value.trim() || null,
        publicationYear: publicationYearRaw ? Number(publicationYearRaw) : null,
        sourceName: section.querySelector('[name="f6-source"]').value.trim() || null,
        studyType: section.querySelector('[name="f6-study-type"]').value,
        doi: section.querySelector('[name="f6-doi"]').value.trim() || null,
        url: section.querySelector('[name="f6-url"]').value.trim() || null,
        abstractText: section.querySelector('[name="f6-abstract"]').value.trim() || null,
        conditions: splitCsv(section.querySelector('[name="f6-conditions"]').value),
        bodyRegions: splitCsv(section.querySelector('[name="f6-regions"]').value),
        wavelengthsNm: splitNumbers(section.querySelector('[name="f6-wavelengths"]').value)
      })
    });
    feedback.textContent = 'Referência científica registrada.';
    section.querySelector('[name="f6-title"]').value = '';
    section.querySelector('[name="f6-doi"]').value = '';
    await refreshEvidence();
  } catch (error) {
    feedback.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

async function linkEvidence() {
  const section = currentSection();
  if (!section) return;
  const feedback = section.querySelector('[data-f6-link-feedback]');
  const versionId = section.querySelector('[name="f6-link-version"]').value;
  const evidenceId = section.querySelector('[name="f6-link-evidence"]').value;
  if (!versionId || !evidenceId) {
    feedback.textContent = 'Selecione a versão e a evidência.';
    return;
  }
  try {
    await api(`/api/protocol-versions/${encodeURIComponent(versionId)}/evidence`, {
      method: 'POST',
      body: JSON.stringify({
        evidenceId,
        relationType: section.querySelector('[name="f6-link-relation"]').value,
        note: section.querySelector('[name="f6-link-note"]').value.trim() || null
      })
    });
    feedback.textContent = 'Evidência vinculada à versão exata do protocolo.';
    await refreshLinked();
  } catch (error) {
    feedback.textContent = error.message;
  }
}

function mount() {
  if (!view) return;
  const protocolSurface = view.querySelector('[data-protocol-filters], [data-f3-adaptation]');
  if (!protocolSurface) {
    mounted = false;
    return;
  }
  if (view.querySelector('[data-f6-evidence]')) return;
  mounted = true;

  const section = document.createElement('section');
  section.className = 'card f6-evidence';
  section.dataset.f6Evidence = '';
  section.innerHTML = `
    <div class="section-head">
      <div>
        <span class="eyebrow">F6 · BIBLIOTECA CIENTÍFICA</span>
        <h2>Evidências vinculadas ao protocolo</h2>
      </div>
      <span class="status">Referência documental</span>
    </div>
    <p class="muted">Cadastre e pesquise fontes locais. O vínculo é feito com uma versão exata do protocolo e não modifica parâmetros nem recomenda dose.</p>
    <div class="f6-grid">
      <div class="f6-panel">
        <h3>Nova referência</h3>
        <label>Título<input name="f6-title" required placeholder="Título da publicação"></label>
        <div class="form-grid two">
          <label>Autores<input name="f6-authors"></label>
          <label>Ano<input name="f6-year" type="number" min="1800" max="3000"></label>
          <label>Fonte/periódico<input name="f6-source"></label>
          <label>Tipo de estudo
            <select name="f6-study-type">
              <option value="systematic_review">Revisão sistemática</option>
              <option value="randomized_trial">Ensaio randomizado</option>
              <option value="clinical_trial">Ensaio clínico</option>
              <option value="observational">Observacional</option>
              <option value="guideline">Diretriz</option>
              <option value="other">Outro</option>
            </select>
          </label>
          <label>DOI<input name="f6-doi"></label>
          <label>URL<input name="f6-url" type="url"></label>
        </div>
        <label>Resumo<textarea name="f6-abstract" rows="3"></textarea></label>
        <div class="form-grid three">
          <label>Condições<input name="f6-conditions" placeholder="cervicalgia, tendinopatia"></label>
          <label>Regiões<input name="f6-regions" placeholder="cervical, ombro"></label>
          <label>Comprimentos de onda (nm)<input name="f6-wavelengths" placeholder="660, 808"></label>
        </div>
        <button type="button" data-create-evidence-f6>Registrar referência</button>
        <p class="f6-feedback" data-f6-feedback></p>
      </div>
      <div class="f6-panel">
        <h3>Pesquisar biblioteca</h3>
        <div class="f6-actions">
          <label>Busca<input name="f6-search" placeholder="Título, DOI, condição, região…"></label>
          <button type="button" class="secondary" data-search-evidence-f6>Pesquisar</button>
        </div>
        <div class="f6-evidence-list" data-f6-evidence-list></div>
      </div>
    </div>
    <div class="f6-panel" style="margin-top:1rem">
      <h3>Vincular à versão do protocolo</h3>
      <div class="form-grid three">
        <label>Versão<select name="f6-link-version"></select></label>
        <label>Evidência<select name="f6-link-evidence"></select></label>
        <label>Relação
          <select name="f6-link-relation">
            <option value="context">Contexto</option>
            <option value="supports">Suporte documental</option>
            <option value="contradicts">Evidência divergente</option>
          </select>
        </label>
      </div>
      <label>Nota<input name="f6-link-note" placeholder="Contexto do vínculo"></label>
      <button type="button" data-link-evidence-f6>Vincular evidência</button>
      <p class="f6-feedback" data-f6-link-feedback></p>
      <div class="f6-linked-list" data-f6-linked-list></div>
    </div>
  `;
  view.append(section);
  section.querySelector('[data-create-evidence-f6]').addEventListener('click', createEvidence);
  section.querySelector('[data-search-evidence-f6]').addEventListener('click', refreshEvidence);
  section.querySelector('[name="f6-link-version"]').addEventListener('change', refreshLinked);
  section.querySelector('[data-link-evidence-f6]').addEventListener('click', linkEvidence);
  Promise.all([refreshEvidence(), refreshProtocols()]).then(refreshLinked).catch((error) => {
    const feedback = section.querySelector('[data-f6-feedback]');
    if (feedback) feedback.textContent = error.message;
  });
}

if (view) {
  new MutationObserver(() => {
    if (!mounted || !view.querySelector('[data-f6-evidence]')) queueMicrotask(mount);
  }).observe(view, { childList: true, subtree: true });
  queueMicrotask(mount);
}
