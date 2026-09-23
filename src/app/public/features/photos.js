import { emptyState, escapeHtml, statusBadge } from '../ui/primitives.js';

export const MAX_LOCAL_PHOTO_BYTES = 5 * 1024 * 1024;

export function validateLocalPhotoFile(file) {
  if (!file) throw new TypeError('Selecione um arquivo de imagem.');
  if (!String(file.type || '').startsWith('image/')) throw new TypeError('Selecione um arquivo de imagem válido.');
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

export function createPhotosView({ gateway, patientId, onChanged, onMessage }) {
  const local = { records: [] };

  async function load() {
    local.records = await gateway.listPhotos(patientId);
  }

  function photoCard(photo) {
    const sourceText = photo.source === 'persisted' ? 'Persistido' : 'Somente local · não persistido';
    const sourceTone = photo.source === 'persisted' ? 'success' : 'warning';
    const preview = photo.previewDataUrl
      ? `<img class="photo-preview" src="${escapeHtml(photo.previewDataUrl)}" alt="Foto clínica local — ${escapeHtml(photo.region)}">`
      : '<div class="photo-preview-placeholder" aria-label="Sem pré-visualização local">Sem pré-visualização</div>';
    return `<article class="card photo-card" data-photo-record="${escapeHtml(photo.id)}">
      ${preview}
      <div class="section-head"><div><span class="eyebrow">FOTO CLÍNICA</span><h3>${escapeHtml(photo.region)}</h3></div>${statusBadge(sourceText, sourceTone)}</div>
      <p>${escapeHtml(photo.observation || 'Sem observação adicional.')}</p>
      <div class="muted">${escapeHtml(photo.capturedDate || '—')}${photo.sessionId ? ` · Sessão ${escapeHtml(photo.sessionId)}` : ''}</div>
      ${photo.source === 'persisted' ? '' : '<p class="module-note">Pré-visualização local · não enviada ao backend.</p>'}
      ${photo.source === 'persisted' ? '' : `<div class="actions"><button type="button" class="secondary" aria-label="Remover foto ${escapeHtml(photo.region)}" data-remove-photo="${escapeHtml(photo.id)}">Remover foto local</button></div>`}
    </article>`;
  }

  function gallery() {
    if (!local.records.length) {
      return emptyState({
        title: 'Nenhuma foto registrada',
        description: 'Adicione uma imagem para pré-visualização local. Nesta fase, nenhum arquivo é enviado ou persistido no backend.'
      });
    }
    return `<div class="photo-grid">${local.records.map(photoCard).join('')}</div>`;
  }

  function render() {
    return `<div class="page-stack photos-workspace" data-photos-view>
      <section class="card">
        <div class="section-head"><div><span class="eyebrow">FOTOS</span><h2>Adicionar foto clínica local</h2></div><span class="status-badge status-warning">Somente local · não persistido</span></div>
        <p class="muted">A imagem permanece apenas na memória desta sessão do navegador. Não há upload externo nem armazenamento durável nesta fase.</p>
        <label>Arquivo da foto<input type="file" accept="image/*" name="photo-file"></label>
        <div class="form-grid">
          <label>Região fotografada<input name="photo-region" placeholder="Ex.: Ombro direito"></label>
          <label>Data da foto<input name="photo-date" type="date" value="${todayIso()}"></label>
        </div>
        <label>Observação da foto<textarea name="photo-observation" rows="3" placeholder="Ex.: Vista anterior"></textarea></label>
        <div class="module-note">Formatos de imagem do navegador, até 5 MiB. Pré-visualização local não equivale a upload ou persistência clínica.</div>
        <div class="actions"><button type="button" class="primary" data-add-photo>Adicionar foto local</button></div>
      </section>
      <section aria-label="Fotos clínicas locais">${gallery()}</section>
    </div>`;
  }

  function bindActions(root = document) {
    root.querySelector('[data-add-photo]')?.addEventListener('click', async () => {
      try {
        const file = root.querySelector('[name="photo-file"]')?.files?.[0];
        const previewDataUrl = await readLocalPhoto(file);
        await gateway.addPhotoMetadata(patientId, {
          capturedDate: root.querySelector('[name="photo-date"]')?.value ?? '',
          region: root.querySelector('[name="photo-region"]')?.value ?? '',
          observation: root.querySelector('[name="photo-observation"]')?.value ?? '',
          previewDataUrl
        });
        await load();
        onMessage?.('Foto adicionada somente à memória local; nenhum arquivo foi enviado ao backend.', 'success');
        onChanged?.();
      } catch (error) {
        onMessage?.(error.message);
      }
    });

    root.querySelectorAll('[data-remove-photo]').forEach((button) => button.addEventListener('click', async () => {
      const photoId = button.dataset.removePhoto;
      if (!window.confirm('Remover esta foto do estado local?')) return;
      try {
        await gateway.removePhotoMetadata(patientId, photoId);
        await load();
        onMessage?.('Foto removida do estado local.', 'success');
        onChanged?.();
      } catch (error) {
        onMessage?.(error.message);
      }
    }));
  }

  return { load, render, bindActions };
}
