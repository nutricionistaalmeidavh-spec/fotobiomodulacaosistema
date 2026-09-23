const view = document.querySelector('#view');
let mountScheduled = false;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function api(url) {
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Falha na busca clínica avançada.');
  return payload;
}

function section() {
  return view?.querySelector('[data-f8-engine]');
}

function renderResults(results) {
  const root = section();
  if (!root) return;
  const list = root.querySelector('[data-f8-results]');
  list.innerHTML = results.length ? results.map((item) => {
    const contraindications = item.contraindications || [];
    const compatibility = item.equipmentCompatibility;
    return `
      <article class="version-item" data-f8-result>
        <header>
          <div>
            <strong>${escapeHtml(item.protocol?.title || 'Protocolo')}</strong>
            <div class="muted">Versão ${escapeHtml(item.version?.versionNumber || '—')} · decisão clínica do profissional</div>
          </div>
          ${compatibility ? `<span class="status ${compatibility.compatible ? '' : 'warning'}">${compatibility.compatible ? 'Equipamento compatível' : 'Revisar equipamento'}</span>` : ''}
        </header>
        <div class="timeline-body">
          ${(item.indications || []).map((indication) => `<p><strong>${escapeHtml(indication.condition || indication.symptom || 'Indicação')}</strong> · ${escapeHtml(indication.bodyRegion || 'região não informada')} · ${escapeHtml(indication.therapeuticGoal || 'objetivo não informado')}</p>`).join('')}
          <div>
            <strong>Contraindicações e precauções</strong>
            ${contraindications.length ? `<ul>${contraindications.map((entry) => `<li><label><input type="checkbox"> <strong>${escapeHtml(entry.severity)}</strong> — ${escapeHtml(entry.label)}${entry.rationale ? `: ${escapeHtml(entry.rationale)}` : ''}</label></li>`).join('')}</ul>` : '<p class="muted">Nenhuma contraindicação cadastrada nesta versão. Confirme clinicamente antes da aplicação.</p>'}
          </div>
          ${compatibility?.warnings?.length ? `<p class="module-note"><strong>Avisos do equipamento:</strong> ${escapeHtml(compatibility.warnings.join(' · '))}</p>` : ''}
        </div>
      </article>`;
  }).join('') : '<p class="empty-state">Nenhum protocolo corresponde aos filtros informados.</p>';
}

async function search() {
  const root = section();
  if (!root) return;
  const feedback = root.querySelector('[data-f8-feedback]');
  const params = new URLSearchParams();
  const fields = [
    ['f8-query', 'query'],
    ['f8-condition', 'condition'],
    ['f8-symptom', 'symptom'],
    ['f8-region', 'bodyRegion'],
    ['f8-goal', 'therapeuticGoal'],
    ['f8-phase', 'clinicalPhase'],
    ['f8-age', 'ageYears'],
    ['f8-professional-area', 'professionalArea'],
    ['f8-wavelength', 'wavelengthNm']
  ];
  for (const [name, key] of fields) {
    const value = root.querySelector(`[name="${name}"]`)?.value.trim();
    if (value) params.set(key, value);
  }
  feedback.textContent = 'Buscando nos dados clínicos estruturados…';
  try {
    const payload = await api(`/api/clinical-engine/protocols${params.size ? `?${params}` : ''}`);
    renderResults(payload.results || []);
    feedback.textContent = `${payload.results?.length || 0} protocolo(s) encontrado(s).`;
  } catch (error) {
    feedback.textContent = error.message;
  }
}

function mount() {
  if (!view) return;
  const protocolSurface = view.querySelector('[data-protocol-filters], [data-f3-adaptation], [data-f6-evidence]');
  if (!protocolSurface || view.querySelector('[data-f8-engine]')) return;

  const panel = document.createElement('section');
  panel.className = 'card';
  panel.dataset.f8Engine = '';
  panel.innerHTML = `
    <div class="section-head">
      <div>
        <span class="eyebrow">F8 · MOTOR CLÍNICO AVANÇADO</span>
        <h2>Busca clínica avançada</h2>
      </div>
      <span class="status">Determinística e local</span>
    </div>
    <p class="muted">Filtre os protocolos estruturados e revise contraindicações e compatibilidade. O sistema não recomenda automaticamente protocolo ou dose; a decisão permanece do profissional.</p>
    <div class="form-grid three">
      <label>Busca<input name="f8-query" placeholder="Condição, sintoma, região…"></label>
      <label>Condição<input name="f8-condition"></label>
      <label>Sintoma<input name="f8-symptom"></label>
      <label>Região<input name="f8-region"></label>
      <label>Objetivo<input name="f8-goal"></label>
      <label>Fase clínica<input name="f8-phase"></label>
      <label>Idade<input name="f8-age" type="number" min="0" max="130"></label>
      <label>Área profissional<input name="f8-professional-area" placeholder="Ex.: fisioterapia"></label>
      <label>Comprimento de onda (nm)<input name="f8-wavelength" type="number" min="1"></label>
    </div>
    <div class="actions"><button type="button" data-search-f8>Buscar protocolos</button></div>
    <p class="muted" data-f8-feedback></p>
    <div class="stack" data-f8-results></div>
  `;
  view.append(panel);
  panel.querySelector('[data-search-f8]').addEventListener('click', search);
  search().catch(() => {});
}

function scheduleMount() {
  if (mountScheduled) return;
  mountScheduled = true;
  queueMicrotask(() => {
    mountScheduled = false;
    mount();
  });
}

if (view) {
  new MutationObserver(scheduleMount).observe(view, { childList: true, subtree: true });
  scheduleMount();
}
