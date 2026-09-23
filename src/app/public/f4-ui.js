const view = document.querySelector('#view');
const nativeFetch = window.fetch.bind(window);
let currentPatientId = null;
let backupStatus = '';
let enhancing = false;
let phaseSyncing = false;

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function requestUrl(input) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.pathname + input.search;
  return input?.url || '';
}

window.fetch = async (input, init) => {
  const url = requestUrl(input);
  const workspaceMatch = url.match(/\/api\/patients\/([^/?]+)\/workspace(?:\?|$)/);
  if (workspaceMatch) currentPatientId = decodeURIComponent(workspaceMatch[1]);
  const response = await nativeFetch(input, init);
  if (url.endsWith('/api/status') && response.ok) {
    response.clone().json().then(setPhaseBadge).catch(() => {});
  }
  return response;
};

async function api(url, options = {}) {
  const response = await nativeFetch(url, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Falha HTTP ${response.status}`);
  return payload;
}

function setPhaseBadge(status) {
  const badge = document.querySelector('[data-phase-badge]');
  if (!badge || !status) return;
  const text = status.phase === 'F4' && status.milestone === 'MVP'
    ? 'F4 · MVP'
    : `${status.phase || 'F4'} concluída`;
  if (badge.textContent !== text) badge.textContent = text;
}

async function syncPhaseBadge() {
  if (phaseSyncing || !document.body.hasAttribute('data-app-ready')) return;
  phaseSyncing = true;
  try { setPhaseBadge(await api('/api/status')); } catch {}
  finally { phaseSyncing = false; }
}

function ensurePhaseHistory() {
  if (!view) return;
  const auditCard = view.querySelector('.dashboard-audit');
  if (!auditCard || view.querySelector('[data-f4-phase-history]')) return;
  auditCard.insertAdjacentHTML('beforebegin', `
    <section class="card" data-f4-phase-history>
      <div class="section-head">
        <div>
          <span class="eyebrow">MARCO ANTERIOR</span>
          <h2>F3 concluída</h2>
        </div>
        <span class="status">Preservada</span>
      </div>
      <p>Equipamentos, aplicadores e adaptação determinística permanecem ativos enquanto a F4 fecha o MVP clínico.</p>
    </section>
  `);
}

function latestEncounter(workspace) {
  return workspace.encounters?.find((item) => item.status === 'open') || workspace.encounters?.[0] || null;
}

function listTemplate(items, renderItem, emptyText) {
  if (!items?.length) return `<p class="muted">${esc(emptyText)}</p>`;
  return items.map(renderItem).join('');
}

function toolsTemplate(workspace) {
  const encounter = latestEncounter(workspace);
  const sessions = workspace.sessions || [];
  const pointOptions = sessions.map((session) => `
    <option value="${esc(session.id)}">Sessão PBM · ${esc(session.protocolTitle || 'Sem protocolo')} · ${esc(session.startedAt || '')}</option>
  `).join('');
  const consentHistory = listTemplate(workspace.consents, (item) => `
    <div class="version-item"><strong>${esc(item.consentType)}</strong> · ${esc(item.version)} · ${esc(item.status)}<div class="muted">${esc(item.createdAt)}</div></div>
  `, 'Nenhum consentimento registrado.');
  const pointHistory = listTemplate(workspace.applicationPoints, (item) => `
    <div class="version-item"><strong>#${esc(item.sequenceNumber)} · ${esc(item.anatomicalLabel || item.bodyRegion || 'Ponto')}</strong><div>${esc(item.bodyRegion || '—')} · ${esc(item.parameters?.energyJ ?? '—')} J</div></div>
  `, 'Nenhum ponto de aplicação registrado.');
  const mediaHistory = listTemplate(workspace.media, (item) => `
    <div class="version-item"><strong>${esc(item.originalFilename || 'Imagem clínica')}</strong><div>${esc(item.caption || 'Sem legenda')} · ${esc(item.mimeType || '')}</div><div class="code">sha256 ${esc(item.sha256 || '')}</div></div>
  `, 'Nenhuma mídia clínica registrada.');
  const outcomeHistory = listTemplate(workspace.basicOutcomes, (item) => `
    <div class="version-item"><strong>${esc(item.metricType)}</strong><div>${esc(item.narrative || '')}</div><div class="muted">${esc(item.measuredAt)}</div></div>
  `, 'Nenhuma evolução básica registrada.');
  const documentHistory = listTemplate(workspace.documents, (item) => `
    <div class="version-item"><strong>${esc(item.documentType)}</strong> · ${esc(item.status)}<div>${esc(item.title)}</div><div class="code">sha256 ${esc(item.sha256 || '')}</div></div>
  `, 'Nenhum documento finalizado.');

  return `
    <div class="section-head">
      <div><span class="eyebrow">F4 · MVP CLÍNICO</span><h2>Consentimento, aplicação e documentação</h2></div>
      <span class="status">Local · auditável</span>
    </div>

    <div class="grid two-column">
      <div>
        <h3>Consentimento</h3>
        <div class="form-grid">
          <label>Tipo<input name="consent-type" value="pbm_clinical"></label>
          <label>Versão<input name="consent-version" value="1.0"></label>
        </div>
        <div class="actions"><button class="primary" data-accept-consent-f4>Aceitar consentimento</button></div>
        <div class="version-list" data-f4-consent-history>${consentHistory}</div>
      </div>

      <div>
        <h3>Pontos de aplicação</h3>
        <label>Sessão<select name="point-session" ${sessions.length ? '' : 'disabled'}>${pointOptions}</select></label>
        <div class="form-grid">
          <label>Sequência<input type="number" min="1" step="1" name="point-sequence" value="1"></label>
          <label>Região corporal<input name="point-body-region"></label>
          <label>Referência anatômica<input name="point-anatomical-label"></label>
          <label>Energia no ponto (J)<input type="number" min="0.01" step="0.1" name="point-energy" value="4"></label>
        </div>
        <div class="actions"><button class="primary" data-add-application-point-f4 ${sessions.length ? '' : 'disabled'}>Registrar ponto</button></div>
        <div class="version-list" data-f4-application-points>${pointHistory}</div>
      </div>

      <div>
        <h3>Mídia clínica</h3>
        <label>Imagem<input type="file" accept="image/png,image/jpeg,image/webp" name="clinical-image"></label>
        <label>Legenda<input name="clinical-image-caption"></label>
        <div class="actions"><button class="primary" data-upload-media-f4>Salvar imagem local</button></div>
        <div class="version-list" data-f4-media-list>${mediaHistory}</div>
      </div>

      <div>
        <h3>Evolução básica</h3>
        <label>Registro clínico<textarea name="basic-outcome-narrative"></textarea></label>
        <div class="actions"><button class="primary" data-record-basic-outcome-f4>Registrar evolução</button></div>
        <div class="version-list" data-f4-outcomes>${outcomeHistory}</div>
      </div>
    </div>

    <div class="grid two-column">
      <div>
        <h3>Documento do atendimento</h3>
        <p class="muted">Gera um PDF local finalizado, com SHA-256 e linha imutável no prontuário.</p>
        <div class="actions"><button class="primary" data-generate-pdf-f4 ${encounter ? '' : 'disabled'}>Gerar PDF</button></div>
        <div class="version-list" data-f4-documents>${documentHistory}</div>
      </div>
      <div>
        <h3>Backup local</h3>
        <p class="muted">Cria snapshot SQLite consistente, copia ativos clínicos e verifica o manifesto por SHA-256.</p>
        <div class="actions"><button class="secondary" data-create-backup-f4>Criar backup local</button></div>
        <div class="module-note" data-f4-backup-status>${esc(backupStatus || 'Nenhum backup criado nesta sessão.')}</div>
      </div>
    </div>
  `;
}

function fileToBase64(file) {
  return file.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunk = 0x8000;
    for (let index = 0; index < bytes.length; index += chunk) {
      binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + chunk, bytes.length)));
    }
    return btoa(binary);
  });
}

async function refreshTools() {
  if (!currentPatientId) return;
  const workspaceElement = view?.querySelector('[data-patient-workspace]');
  if (!workspaceElement) return;
  const workspace = await api(`/api/patients/${encodeURIComponent(currentPatientId)}/workspace`);
  let section = workspaceElement.querySelector('[data-f4-clinical-tools]');
  if (!section) {
    section = document.createElement('section');
    section.className = 'card';
    section.dataset.f4ClinicalTools = '';
    workspaceElement.append(section);
  }
  section.innerHTML = toolsTemplate(workspace);
  bindTools(section, workspace);
}

function bindTools(section, workspace) {
  const encounter = latestEncounter(workspace);
  const latestSession = workspace.sessions?.[0] || null;

  section.querySelector('[data-accept-consent-f4]')?.addEventListener('click', async () => {
    try {
      await api(`/api/patients/${encodeURIComponent(currentPatientId)}/consents`, {
        method: 'POST',
        body: JSON.stringify({
          consentType: section.querySelector('[name="consent-type"]').value,
          version: section.querySelector('[name="consent-version"]').value,
          evidence: { source: 'local_workspace', capturedBy: 'professional' }
        })
      });
      await refreshTools();
    } catch (error) { backupStatus = error.message; await refreshTools(); }
  });

  section.querySelector('[data-add-application-point-f4]')?.addEventListener('click', async () => {
    try {
      const sessionId = section.querySelector('[name="point-session"]').value;
      const energyJ = Number(section.querySelector('[name="point-energy"]').value);
      await api(`/api/sessions/${encodeURIComponent(sessionId)}/application-points`, {
        method: 'POST',
        body: JSON.stringify({
          sequenceNumber: Number(section.querySelector('[name="point-sequence"]').value),
          bodyRegion: section.querySelector('[name="point-body-region"]').value,
          anatomicalLabel: section.querySelector('[name="point-anatomical-label"]').value,
          parameters: Number.isFinite(energyJ) && energyJ > 0 ? { energyJ } : {}
        })
      });
      await refreshTools();
    } catch (error) { backupStatus = error.message; await refreshTools(); }
  });

  section.querySelector('[data-upload-media-f4]')?.addEventListener('click', async () => {
    try {
      const input = section.querySelector('[name="clinical-image"]');
      const file = input.files?.[0];
      if (!file) throw new Error('Selecione uma imagem clínica.');
      await api(`/api/patients/${encodeURIComponent(currentPatientId)}/media`, {
        method: 'POST',
        body: JSON.stringify({
          encounterId: encounter?.id || null,
          treatmentSessionId: latestSession?.id || null,
          originalFilename: file.name,
          mimeType: file.type,
          dataBase64: await fileToBase64(file),
          caption: section.querySelector('[name="clinical-image-caption"]').value,
          capturedAt: new Date().toISOString()
        })
      });
      await refreshTools();
    } catch (error) { backupStatus = error.message; await refreshTools(); }
  });

  section.querySelector('[data-record-basic-outcome-f4]')?.addEventListener('click', async () => {
    try {
      await api(`/api/patients/${encodeURIComponent(currentPatientId)}/basic-outcomes`, {
        method: 'POST',
        body: JSON.stringify({
          encounterId: encounter?.id || null,
          treatmentSessionId: latestSession?.id || null,
          metricType: 'clinical_note',
          narrative: section.querySelector('[name="basic-outcome-narrative"]').value
        })
      });
      await refreshTools();
    } catch (error) { backupStatus = error.message; await refreshTools(); }
  });

  section.querySelector('[data-generate-pdf-f4]')?.addEventListener('click', async () => {
    try {
      if (!encounter) throw new Error('Registre um atendimento antes de gerar o PDF.');
      await api(`/api/encounters/${encodeURIComponent(encounter.id)}/pdf`, { method: 'POST', body: '{}' });
      await refreshTools();
    } catch (error) { backupStatus = error.message; await refreshTools(); }
  });

  section.querySelector('[data-create-backup-f4]')?.addEventListener('click', async () => {
    try {
      const created = await api('/api/backup', { method: 'POST', body: '{}' });
      const verified = await api('/api/backup/verify', {
        method: 'POST',
        body: JSON.stringify({ backupPath: created.backup.backupPath })
      });
      backupStatus = verified.verification.valid
        ? `Backup verificado · ${created.backup.manifest.files.length} arquivos`
        : `Backup com falhas · ${verified.verification.errors.join('; ')}`;
      await refreshTools();
    } catch (error) { backupStatus = error.message; await refreshTools(); }
  });
}

async function enhanceWorkspace() {
  if (enhancing || !currentPatientId || !view?.querySelector('[data-patient-workspace]')) return;
  if (view.querySelector('[data-f4-clinical-tools]')) return;
  enhancing = true;
  try { await refreshTools(); } catch {}
  finally { enhancing = false; }
}

const observer = new MutationObserver(() => {
  ensurePhaseHistory();
  syncPhaseBadge();
  enhanceWorkspace();
});
observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-app-ready'] });

ensurePhaseHistory();
syncPhaseBadge();
enhanceWorkspace();
