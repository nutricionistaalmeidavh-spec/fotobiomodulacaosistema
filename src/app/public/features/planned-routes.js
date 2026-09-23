import { escapeHtml } from '../ui/primitives.js';

export const PLANNED_ROUTES = Object.freeze({
  settings: {
    eyebrow: 'CONFIGURAÇÕES',
    title: 'Configurações',
    description: 'Preferências locais, identidade do profissional e adapters opcionais serão organizados aqui conforme as próximas fases.',
    boundary: 'Configuração local primeiro, sem simular persistência que o backend ainda não oferece.'
  }
});

export function createPlannedRoutesView() {
  function render(route) {
    const config = PLANNED_ROUTES[route];
    if (!config) {
      return `<section class="empty-state"><div class="empty-state-mark" aria-hidden="true">○</div><h1>Módulo não encontrado</h1><p>Volte pela navegação principal.</p></section>`;
    }

    return `<div class="page-stack" data-planned-route="${escapeHtml(route)}">
      <div class="page-heading">
        <div><span class="eyebrow">${escapeHtml(config.eyebrow)}</span><h1>${escapeHtml(config.title)}</h1><p>${escapeHtml(config.description)}</p></div>
        <span class="status-badge status-neutral">Planejado</span>
      </div>
      <section class="empty-state planned-route-state">
        <div class="empty-state-mark" aria-hidden="true">○</div>
        <h2>${escapeHtml(config.title)}</h2>
        <p>${escapeHtml(config.boundary)}</p>
      </section>
    </div>`;
  }

  return { render };
}
