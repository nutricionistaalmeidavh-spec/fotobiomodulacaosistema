import { emptyState, escapeHtml, statusBadge } from '../ui/primitives.js';

const ROLE_LABEL = { admin: 'Administrador', professional: 'Profissional', reception: 'Recepção' };

export function createSettingsView({ gateway, onChanged, onMessage }) {
  const local = { clinic: null, accounts: [], integrity: null, backup: null, busy: false };

  async function load() {
    const [clinic, accounts, integrity] = await Promise.all([
      gateway.getClinic(), gateway.listAccounts(), gateway.verifyOperationalIntegrity()
    ]);
    local.clinic = clinic;
    local.accounts = accounts;
    local.integrity = integrity;
  }

  function render() {
    if (!local.clinic) return emptyState({
      title: 'Configurações indisponíveis',
      description: 'Tente reabrir o módulo para carregar os registros da clínica.'
    });
    const integrity = local.integrity?.valid === true;
    return `<div class="page-stack settings-view" data-settings-view>
      <div class="page-heading">
        <div><span class="eyebrow">ADMINISTRAÇÃO</span><h1>Configurações</h1>
          <p>Contas locais, integridade e proteção dos registros. Estas operações ficam restritas ao administrador.</p></div>
        ${statusBadge(integrity ? 'Integridade verificada' : 'Verificação necessária', integrity ? 'success' : 'warning')}
      </div>
      <div class="grid two-column settings-grid">
        <section class="card">
          <div class="section-head"><div><span class="eyebrow">CLÍNICA</span><h2>Identificação</h2></div></div>
          <label>Nome da clínica<input name="clinic-name" value="${escapeHtml(local.clinic.name || '')}"></label>
          <label>Prazo de retenção de mídias (dias)<input type="number" min="1" name="retention-days" value="${escapeHtml(local.clinic.mediaRetentionDays ?? '')}" placeholder="Não configurado"></label>
          <p class="module-note">O prazo apenas sinaliza registros para revisão; nenhum arquivo é excluído automaticamente.</p>
          <div class="actions"><button type="button" class="primary" data-save-clinic>Salvar clínica</button></div>
        </section>
        <section class="card">
          <div class="section-head"><div><span class="eyebrow">PROTEÇÃO DOS DADOS</span><h2>Integridade e backup</h2></div></div>
          <p>SQLite: ${escapeHtml(local.integrity?.sqlite || 'Não verificado')} · Auditoria: ${local.integrity?.audit?.valid ? 'íntegra' : 'verificar'}.</p>
          <p class="module-note">O backup é criado no armazenamento local configurado. Guarde uma cópia externa protegida e valide a restauração antes do uso clínico.</p>
          <div class="actions"><button type="button" class="secondary" data-check-integrity>Verificar integridade</button>
            <button type="button" class="primary" data-create-backup>Criar backup</button></div>
          ${local.backup ? `<p class="field-message field-success" role="status">Backup verificado: ${escapeHtml(String(local.backup.manifest?.files?.length ?? 0))} arquivos.</p>` : ''}
        </section>
        <section class="card span-all">
          <div class="section-head"><div><span class="eyebrow">CONTAS LOCAIS</span><h2>Profissionais e equipe</h2></div>
            <span class="status-badge status-info">${local.accounts.length} contas</span></div>
          <div class="settings-accounts">${local.accounts.map((account) => `
            <div class="settings-account">
              <div><strong>${escapeHtml(account.name || account.email)}</strong><div class="muted">${escapeHtml(account.email || '')}</div></div>
              ${statusBadge(account.active ? (ROLE_LABEL[account.role] || account.role) : 'Desativada', account.active ? 'success' : 'neutral')}
            </div>`).join('')}</div>
          <h3>Criar conta</h3>
          <div class="form-grid">
            <label>Nome<input name="new-account-name" autocomplete="off"></label>
            <label>E-mail<input name="new-account-email" type="email" autocomplete="off"></label>
            <label>Senha inicial<input name="new-account-password" type="password" autocomplete="new-password" minlength="8"></label>
            <label>Permissão<select name="new-account-role">
              <option value="professional">Profissional</option><option value="reception">Recepção</option><option value="admin">Administrador</option>
            </select></label>
          </div>
          <div class="actions"><button type="button" class="primary" data-create-account>Criar conta</button></div>
        </section>
      </div>
    </div>`;
  }

  function bindActions(root = document) {
    const commit = async (button, action, successMessage) => {
      if (local.busy) return;
      local.busy = true;
      if (button) button.disabled = true;
      try {
        await action();
        await load();
        onMessage?.(successMessage, 'success');
        onChanged?.();
      } catch (error) {
        onMessage?.(error.message);
      } finally {
        local.busy = false;
        if (button?.isConnected) button.disabled = false;
      }
    };
    root.querySelector('[data-save-clinic]')?.addEventListener('click', (event) => commit(event.currentTarget,
      () => gateway.updateClinic({
        name: root.querySelector('[name="clinic-name"]').value,
        mediaRetentionDays: root.querySelector('[name="retention-days"]').value || null
      }), 'Clínica atualizada.'));
    root.querySelector('[data-check-integrity]')?.addEventListener('click', (event) => commit(event.currentTarget,
      async () => {
        local.integrity = await gateway.verifyOperationalIntegrity();
        if (!local.integrity.valid) throw new Error('Integridade não confirmada: verifique banco e auditoria.');
      }, 'Integridade verificada.'));
    root.querySelector('[data-create-backup]')?.addEventListener('click', (event) => commit(event.currentTarget,
      async () => {
        local.backup = await gateway.createAdminBackup();
        if (!local.backup?.verification?.valid) throw new Error('O backup não passou na verificação.');
      }, 'Backup local criado e verificado.'));
    root.querySelector('[data-create-account]')?.addEventListener('click', (event) => commit(event.currentTarget,
      async () => {
        const name = root.querySelector('[name="new-account-name"]').value.trim();
        const email = root.querySelector('[name="new-account-email"]').value.trim();
        const password = root.querySelector('[name="new-account-password"]').value;
        const role = root.querySelector('[name="new-account-role"]').value;
        if (!name || !email || password.length < 8) throw new Error('Informe nome, e-mail e uma senha de pelo menos 8 caracteres.');
        await gateway.createAccount({ name, email, password, role });
      }, 'Conta criada com acesso controlado.'));
  }

  return { load, render, bindActions };
}
