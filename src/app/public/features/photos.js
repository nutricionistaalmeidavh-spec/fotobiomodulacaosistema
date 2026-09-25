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

function dataUrlPayload(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('Não foi possível preparar a imagem para armazenamento local.');
  return { mimeType: match[1], dataBase64: match[2] };
}

export function createPhotosView({ gateway, patientId, onChanged, onMessage }) {
  const local = { records: [] };

  async function load() {
    local.records = await gateway.listPhotos(patientId);
  }

  function photoCard(photo) {
    return `<article class="card photo-card" data-photo-record="${escapeHtml(photo.id)}">
      <div class="photo-preview-placeholder" aria-label="Imagem armazenada localmente">Imagem clínica armazenada</div>
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

  function render() {
    return `<div class="page-stack photos-workspace" data-photos-view>
      <section class="card">
        <div class="section-head"><div><span class="eyebrow">FOTOS</span><h2>Adicionar foto clínica</h2></div>${statusBadge('Armazenamento local', 'success')}</div>
        <p class="muted">A imagem é armazenada no diretório clínico local do sistema; nenhum upload externo é realizado.</p>
        <label>Arquivo da foto<input type="file" accept="image/*" name="photo-file"></label>
        <div class="form-grid">
          <label>Região fotografada<input name="photo-region" placeholder="Ex.: Ombro direito"></label>
          <label>Data da foto<input name="photo-date" type="date" value="${todayIso()}"></label>
        </div>
        <label>Observação da foto<textarea name="photo-observation" rows="3" placeholder="Ex.: Vista anterior"></textarea></label>
        <div class="module-note">Imagens até 5 MiB. O sistema valida formato, tamanho e registra hash de integridade.</div>
        <div class="actions"><button type="button" class="primary" data-add-photo>Enviar foto</button></div>
      </section>
      <section aria-label="Fotos clínicas">${gallery()}</section>
    </div>`;
  }

  function bindActions(root = document) {
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
