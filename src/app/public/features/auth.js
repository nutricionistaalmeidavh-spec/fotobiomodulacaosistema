import { escapeHtml } from '../ui/primitives.js';

export function createAuthView({ gateway, onAuthenticated, onMessage }) {
  const local = { status: { setupRequired: false, authenticated: false, user: null }, error: '', busy: false };

  async function load() {
    local.status = await gateway.getAuthStatus();
    local.error = '';
    return local.status;
  }

  function fields(mode) {
    const setup = mode === 'setup';
    return `<form class="card auth-card" data-auth-form="${mode}" novalidate>
      <span class="eyebrow">${setup ? 'CONFIGURAÇÃO INICIAL' : 'ACESSO LOCAL'}</span>
      <h1>${setup ? 'Criar administrador' : 'Entrar'}</h1>
      <p>${setup ? 'Configure a primeira conta administrativa deste ambiente local.' : 'Use sua conta local para acessar o sistema.'}</p>
      ${setup ? '<label>Nome profissional<input name="auth-name" autocomplete="name" required></label>' : ''}
      <label>E-mail<input name="auth-email" type="email" autocomplete="username" required></label>
      <label>Senha<input name="auth-password" type="password" autocomplete="current-password" required></label>
      ${local.error ? `<div class="field-message field-error" role="alert">${escapeHtml(local.error)}</div>` : ''}
      <div class="actions"><button type="submit" class="primary" ${local.busy ? 'disabled' : ''}>${local.busy ? 'Processando…' : setup ? 'Criar administrador' : 'Entrar'}</button></div>
    </form>`;
  }

  function render() {
    return `<div class="auth-shell"><div class="auth-brand"><span class="brand-mark" aria-hidden="true">PBM</span><div><strong>Fotobiomodulação</strong><small>ArtiSys · ambiente clínico local</small></div></div>${fields(local.status.setupRequired ? 'setup' : 'login')}</div>`;
  }

  function rerender(root) {
    root.innerHTML = render();
    bindActions(root);
  }

  function bindActions(root) {
    root.querySelector('[data-auth-form]')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (local.busy) return;
      const form = event.currentTarget;
      const mode = form.dataset.authForm;
      const email = form.querySelector('[name="auth-email"]')?.value ?? '';
      const password = form.querySelector('[name="auth-password"]')?.value ?? '';
      const name = form.querySelector('[name="auth-name"]')?.value ?? '';
      local.busy = true;
      local.error = '';
      rerender(root);
      try {
        const result = mode === 'setup'
          ? await gateway.setupAuth({ name, email, password })
          : await gateway.login({ email, password });
        local.busy = false;
        local.status = { setupRequired: false, authenticated: true, user: result.user };
        await onAuthenticated?.(result.user);
      } catch (error) {
        local.busy = false;
        local.error = error.message;
        onMessage?.(error.message);
        rerender(root);
      }
    });
  }

  return { load, render, bindActions };
}
