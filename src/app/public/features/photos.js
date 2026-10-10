import { emptyState, escapeHtml, statusBadge } from '../ui/primitives.js';

export const MAX_LOCAL_PHOTO_BYTES = 5 * 1024 * 1024;

export function validateLocalPhotoFile(file) {
  if (!file) throw new TypeError('Selecione um arquivo de imagem.');
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(String(file.type || '').toLowerCase())) throw new TypeError('Use uma imagem PNG, JPEG ou WebP.');
  if (!Number.isFinite(Number(file.size)) || Number(file.size) < 0) throw new TypeError('O tamanho do arquivo de imagem é inválido.');
  if (Number(file.size) > MAX_LOCAL_PHOTO_BYTES) throw new TypeError('A imagem local deve ter no máximo 5 MiB.');
  return file;
}

export function readLocalPhoto(file) {
  validateLocalPhotoFile(file);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem local.'));
    reader.readAsDataURL(file);
  });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function dataUrlPayload(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('Não foi possível preparar a imagem para armazenamento local.');
  return { mimeType: match[1], dataBase64: match[2] };
}

export function createPhotosView({ gateway, patientId, onChanged, onMessage }) {
  const local = { records: [], beforeId: null, afterId: null };

  async function load() {
    local.records = await gateway.listPhotos(patientId);
    if (!local.records.some((item) => item.id === local.beforeId)) local.beforeId = local.records.at(-1)?.id || null;
    if (!local.records.some((item) => item.id === local.afterId)) local.afterId = local.records[0]?.id || null;
  }

  function photoSource(photo) {
    return photo.storageUrl || photo.previewDataUrl || '';
  }

  function photoCard(photo) {
    return `<article class="card photo-card" data-photo-record="${escapeHtml(photo.id)}">
      ${photoSource(photo) ? `<img class="photo-preview" src="${escapeHtml(photoSource(photo))}" alt="Imagem clínica de ${escapeHtml(photo.region)} em ${escapeHtml(photo.capturedDate || 'data não informada')}" loading="lazy" decoding="async">` : '<div class="photo-preview-placeholder">Pré-visualização indisponível</div>'}
      <div class="section-head"><div><span class="eyebrow">FOTO CLÍNICA</span><h3>${escapeHtml(photo.region)}</h3></div>${statusBadge('Persistido', 'success')}</div>
      <p>${escapeHtml(photo.observation || 'Sem observação adicional.')}</p>
      <div class="muted">${escapeHtml(photo.capturedDate || '—')}${photo.byteSize ? ` · ${escapeHtml(String(photo.byteSize))} bytes` : ''}</div>
      <p class="module-note">Arquivo local com metadados de integridade${photo.sha256 ? ` · SHA-256 ${escapeHtml(photo.sha256.slice(0, 12))}…` : ''}.</p>
    </article>`;
  }

  function gallery() {
    if (!local.records.length) return emptyState({ title: 'Nenhuma foto registrada', description: 'Adicione uma imagem clínica; o arquivo será armazenado localmente com metadados de integridade.' });
    return `<div class="photo-grid">${local.records.map(photoCard).join('')}</div>`;
  }

  function comparison() {
    if (local.records.length < 2) return '';
    const before = local.records.find((item) => item.id === local.beforeId) || local.records.at(-1);
    const after = local.records.find((item) => item.id === local.afterId) || local.records[0];
    const options = (selected) => local.records.map((photo) =>
      `<option value="${escapeHtml(photo.id)}" ${photo.id === selected ? 'selected' : ''}>${escapeHtml(photo.capturedDate || 'Sem data')} · ${escapeHtml(photo.region || 'Região')}</option>`
    ).join('');
    const figure = (photo, label) => `<figure class="photo-comparison-item">
      ${photoSource(photo) ? `<img src="${escapeHtml(photoSource(photo))}" alt="${escapeHtml(label)}: ${escapeHtml(photo.region)} em ${escapeHtml(photo.capturedDate || 'data não informada')}" loading="lazy">` : '<div class="photo-preview-placeholder">Imagem indisponível</div>'}
      <figcaption><strong>${label}</strong> · ${escapeHtml(photo.capturedDate || 'Sem data')} · ${escapeHtml(photo.region || '')}</figcaption>
    </figure>`;
    return `<section class="card" aria-label="Comparação de fotografias">
      <div class="section-head"><div><span class="eyebrow">EVOLUÇÃO VISUAL</span><h2>Comparar fotos</h2></div></div>
      <p class="muted">Comparação descritiva. Não é uma avaliação automática de eficácia terapêutica.</p>
      <div class="form-grid">
        <label>Foto anterior<select data-photo-before>${options(before.id)}</select></label>
        <label>Foto posterior<select data-photo-after>${options(after.id)}</select></label>
      </div>
      <div class="photo-comparison">${figure(before, 'Anterior')}${figure(after, 'Posterior')}</div>
    </section>`;
  }

  function render() {
    return `<div class="page-stack photos-workspace" data-photos-view>
      <section class="card">
        <div class="section-head"><div><span class="eyebrow">FOTOS</span><h2>Adicionar foto clínica</h2></div>${statusBadge('Armazenamento local', 'success')}</div>
        <p class="muted">A imagem é armazenada no diretório clínico local do sistema; nenhum upload externo é realizado.</p>
        <label>Arquivo da foto<input type="file" accept="image/png,image/jpeg,image/webp" name="photo-file"></label>
        <div class="form-grid">
          <label>Região fotografada<input name="photo-region" placeholder="Ex.: Ombro direito"></label>
          <label>Data da foto<input name="photo-date" type="date" value="${todayIso()}"></label>
        </div>
        <label>Observação da foto<textarea name="photo-observation" rows="3" placeholder="Ex.: Vista anterior"></textarea></label>
        <div class="module-note">Imagens até 5 MiB. O sistema valida formato, tamanho e registra hash de integridade.</div>
        <div class="actions"><button type="button" class="primary" data-add-photo>Enviar foto</button></div>
      </section>
      ${comparison()}
      <section aria-label="Fotos clínicas">${gallery()}</section>
    </div>`;
  }

  function bindActions(root = document) {
    root.querySelector('[data-photo-before]')?.addEventListener('change', (event) => { local.beforeId = event.currentTarget.value; onChanged?.(); });
    root.querySelector('[data-photo-after]')?.addEventListener('change', (event) => { local.afterId = event.currentTarget.value; onChanged?.(); });
    root.querySelector('[data-add-photo]')?.addEventListener('click', async () => {
      try {
        const file = root.querySelector('[name="photo-file"]')?.files?.[0];
        const dataUrl = await readLocalPhoto(file);
        const encoded = dataUrlPayload(dataUrl);
        await gateway.addPhotoMetadata(patientId, {
          capturedDate: root.querySelector('[name="photo-date"]')?.value ?? '',
          region: root.querySelector('[name="photo-region"]')?.value ?? '',
          observation: root.querySelector('[name="photo-observation"]')?.value ?? '',
          originalFilename: file.name,
          mimeType: encoded.mimeType,
          dataBase64: encoded.dataBase64
        });
        await load();
        onMessage?.('Foto clínica armazenada localmente com integridade registrada.', 'success');
        onChanged?.();
      } catch (error) {
        onMessage?.(error.message);
      }
    });
  }

  return { load, render, bindActions };
}
