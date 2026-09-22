export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

export function statusBadge(label, tone = 'neutral') {
  return `<span class="status-badge status-${escapeHtml(tone)}">${escapeHtml(label)}</span>`;
}

export function emptyState({ title, description, actionLabel = '', action = '' }) {
  return `<div class="empty-state" data-empty-state>
    <div class="empty-state-mark" aria-hidden="true">○</div>
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(description)}</p>
    ${actionLabel && action ? `<button type="button" class="secondary" ${action}>${escapeHtml(actionLabel)}</button>` : ''}
  </div>`;
}

export function fieldMessage(message, kind = 'error') {
  return message ? `<small class="field-message field-${escapeHtml(kind)}">${escapeHtml(message)}</small>` : '';
}

export function dialogFrame({ title, description = '', body = '', footer = '', testId = '' }) {
  const titleId = `dialog-title-${String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'dialog'}`;
  return `<div class="dialog-backdrop" data-dialog-backdrop>
    <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="${titleId}" ${testId ? `data-testid="${escapeHtml(testId)}"` : ''}>
      <header class="dialog-head">
        <div><h2 id="${titleId}">${escapeHtml(title)}</h2>${description ? `<p>${escapeHtml(description)}</p>` : ''}</div>
        <button type="button" class="icon-button" data-dialog-close aria-label="Fechar">×</button>
      </header>
      <div class="dialog-body">${body}</div>
      ${footer ? `<footer class="dialog-footer">${footer}</footer>` : ''}
    </section>
  </div>`;
}
