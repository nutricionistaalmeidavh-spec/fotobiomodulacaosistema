const view = document.querySelector('#view');

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.headers || {}) }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Falha HTTP ${response.status}`);
  return payload;
}

function accountRows(accounts) {
  return accounts.map((item) => `
    <tr data-f10-account>
      <td><strong>${esc(item.name)}</strong><div class="muted">${esc(item.email)}</div></td>
      <td>${esc(item.role)}</td>
      <td>${item.active ? 'Ativa' : 'Desativada'}</td>
      <td><button class="secondary compact" data-revoke-f10="${esc(item.accountId)}">Revogar sessões</button></td>
    </tr>`).join('') || '<tr><td colspan="4">Nenhuma conta.</td></tr>';
}

function sessionRows(sessions) {
  return sessions.slice(0, 20).map((item) => `
    <tr><td>${esc(item.name || item.email)}</td><td>${esc(item.createdAt)}</td><td>${esc(item.lastSeenAt || '—')}</td><td>${item.revokedAt ? 'Revogada' : 'Ativa'}</td></tr>`).join('') || '<tr><td colspan="4">Nenhuma sessão.</td></tr>';
}

async function renderAdmin() {
  const [{ clinic }, { accounts }, { sessions }] = await Promise.all([
    api('/api/admin/clinic'), api('/api/admin/accounts'), api('/api/admin/sessions')
  ]);
  document.querySelectorAll('[data-nav]').forEach((button) => button.classList.toggle('is-active', button.dataset.nav === 'admin'));
  view.innerHTML = `
    <div class="stack" data-f10-admin>
      <section class="card">
        <div class="section-head"><div><span class="eyebrow">F10 · ADMINISTRAÇÃO</span><h2>Clínica e retenção</h2></div><span class="status">RBAC local</span></div>
        <div class="form-grid two">
          <label>Nome da clínica<input name="f10-clinic-name" value="${esc(clinic?.name || '')}"></label>
          <label>Revisar mídias após (dias)<input name="f10-retention-days" type="number" min="1" value="${esc(clinic?.mediaRetentionDays || '')}" placeholder="Sem política"></label>
        </div>
        <p class="muted">A política apenas identifica mídias para revisão; nenhum arquivo clínico é apagado automaticamente.</p>
        <div class="actions"><button data-save-clinic-f10>Salvar configurações</button></div><p class="muted" data-f10-clinic-feedback></p>
      </section>

      <section class="card">
        <div class="section-head"><div><span class="eyebrow">CONTAS</span><h2>Equipe e papéis</h2></div></div>
        <div class="form-grid four">
          <label>Nome<input name="f10-account-name"></label>
          <label>E-mail<input name="f10-account-email" type="email"></label>
          <label>Senha inicial<input name="f10-account-password" type="password"></label>
          <label>Papel<select name="f10-account-role"><option value="professional">Profissional</option><option value="reception">Recepção</option><option value="admin">Administrador</option></select></label>
        </div>
        <div class="actions"><button data-create-account-f10>Criar conta local</button></div><p class="muted" data-f10-account-feedback></p>
        <div class="table-wrap"><table><thead><tr><th>Conta</th><th>Papel</th><th>Status</th><th></th></tr></thead><tbody>${accountRows(accounts)}</tbody></table></div>
      </section>

      <section class="card">
        <div class="section-head"><div><span class="eyebrow">SESSÕES AUTENTICADAS</span><h2>Sessões locais</h2></div></div>
        <div class="table-wrap"><table><thead><tr><th>Conta</th><th>Criada</th><th>Último acesso</th><th>Status</th></tr></thead><tbody>${sessionRows(sessions)}</tbody></table></div>
      </section>

      <div class="grid two-column">
        <section class="card">
          <span class="eyebrow">INTEGRIDADE</span><h2>Verificação operacional</h2>
          <p>Valida SQLite, cadeia de auditoria e referências operacionais.</p>
          <button data-check-integrity-f10>Verificar integridade</button>
          <div class="module-note" data-f10-integrity>Verificação ainda não executada.</div>
        </section>
        <section class="card">
          <span class="eyebrow">BACKUP</span><h2>Snapshot local verificado</h2>
          <p>Cria snapshot consistente do SQLite e manifesto SHA-256.</p>
          <button data-create-backup-f10>Criar backup</button>
          <div class="module-note" data-f10-backup>Nenhum backup criado nesta tela.</div>
        </section>
      </div>

      <section class="card">
        <span class="eyebrow">RESTAURAÇÃO CONTROLADA</span><h2>Validar destino antes da restauração</h2>
        <div class="form-grid two"><label>Pasta do backup<input name="f10-restore-backup"></label><label>Arquivo de destino<input name="f10-restore-destination"></label></div>
        <div class="actions"><button data-preview-restore-f10>Validar restauração</button></div>
        <p class="muted" data-f10-restore-feedback>A validação não substitui o banco aberto.</p>
      </section>
    </div>`;

  view.querySelector('[data-save-clinic-f10]').addEventListener('click', async () => {
    const retention = view.querySelector('[name="f10-retention-days"]').value;
    try {
      await api('/api/admin/clinic', { method: 'PATCH', body: JSON.stringify({ name: view.querySelector('[name="f10-clinic-name"]').value, mediaRetentionDays: retention ? Number(retention) : null }) });
      view.querySelector('[data-f10-clinic-feedback]').textContent = 'Configurações salvas.';
    } catch (error) { view.querySelector('[data-f10-clinic-feedback]').textContent = error.message; }
  });

  view.querySelector('[data-create-account-f10]').addEventListener('click', async () => {
    const feedback = view.querySelector('[data-f10-account-feedback]');
    try {
      await api('/api/admin/accounts', { method: 'POST', body: JSON.stringify({
        name: view.querySelector('[name="f10-account-name"]').value,
        email: view.querySelector('[name="f10-account-email"]').value,
        password: view.querySelector('[name="f10-account-password"]').value,
        role: view.querySelector('[name="f10-account-role"]').value
      }) });
      feedback.textContent = 'Conta criada.';
      await renderAdmin();
    } catch (error) { feedback.textContent = error.message; }
  });

  for (const button of view.querySelectorAll('[data-revoke-f10]')) {
    button.addEventListener('click', async () => {
      await api(`/api/admin/accounts/${encodeURIComponent(button.dataset.revokeF10)}/revoke-sessions`, { method: 'POST', body: '{}' });
      await renderAdmin();
    });
  }

  view.querySelector('[data-check-integrity-f10]').addEventListener('click', async () => {
    const output = view.querySelector('[data-f10-integrity]');
    try {
      const { integrity } = await api('/api/admin/integrity');
      output.textContent = integrity.valid ? 'Integridade OK — SQLite, auditoria e referências válidas.' : `Revisar integridade: ${esc(integrity.sqlite)}`;
    } catch (error) { output.textContent = error.message; }
  });

  view.querySelector('[data-create-backup-f10]').addEventListener('click', async () => {
    const output = view.querySelector('[data-f10-backup]');
    try {
      const { backup } = await api('/api/admin/backups', { method: 'POST', body: '{}' });
      output.textContent = `Backup verificado: ${backup.backupPath}`;
      view.querySelector('[name="f10-restore-backup"]').value = backup.backupPath;
    } catch (error) { output.textContent = error.message; }
  });

  view.querySelector('[data-preview-restore-f10]').addEventListener('click', async () => {
    const output = view.querySelector('[data-f10-restore-feedback]');
    try {
      const { preview } = await api('/api/admin/restore-preview', { method: 'POST', body: JSON.stringify({
        backupPath: view.querySelector('[name="f10-restore-backup"]').value,
        destinationPath: view.querySelector('[name="f10-restore-destination"]').value
      }) });
      output.textContent = `Backup íntegro. Destino preparado: ${preview.destinationPath}. Nenhum arquivo foi sobrescrito.`;
    } catch (error) { output.textContent = error.message; }
  });
}

document.addEventListener('click', (event) => {
  const button = event.target.closest?.('[data-nav="admin"]');
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  renderAdmin().catch((error) => { if (view) view.innerHTML = `<section class="card"><p>${esc(error.message)}</p></section>`; });
}, true);
