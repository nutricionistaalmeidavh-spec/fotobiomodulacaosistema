import { emptyState, escapeHtml, statusBadge } from '../ui/primitives.js';

function formatMoney(cents = 0) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(cents || 0) / 100);
}

function toCents(value, label) {
  const normalized = String(value ?? '').trim().replace(',', '.');
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`${label} inválido.`);
  return Math.round(amount * 100);
}

function statusLabel(status) {
  return ({ active: 'Ativo', completed: 'Concluído', cancelled: 'Cancelado', pending: 'Pendente', paid: 'Pago' })[status] || status;
}

export function createFinanceView({ gateway, getRole = () => 'admin', onChanged, onMessage }) {
  const local = {
    activeTab: 'packages',
    patients: [],
    packages: [],
    payments: [],
    sessions: []
  };

  function patientFor(id) {
    return local.patients.find((patient) => patient.id === id) || null;
  }

  async function load() {
    const [patients, packages, payments] = await Promise.all([
      gateway.listPatients(),
      gateway.listPackages(),
      gateway.listPayments()
    ]);
    local.patients = patients;
    local.packages = packages;
    local.payments = payments;
    local.sessions = getRole() === 'admin' ? await gateway.listSessions() : [];
  }

  function patientOptions() {
    if (!local.patients.length) return '<option value="">Nenhum paciente disponível</option>';
    return local.patients.map((patient) => `<option value="${escapeHtml(patient.id)}">${escapeHtml(patient.fullName)}</option>`).join('');
  }

  function packageCard(pack) {
    const patient = patientFor(pack.patientId);
    const eligibleSessions = local.sessions.filter((session) => session.patientId === pack.patientId);
    const canConsume = getRole() === 'admin' && pack.status === 'active' && pack.remainingSessions > 0;
    const sessionOptions = eligibleSessions.length
      ? eligibleSessions.map((session) => `<option value="${escapeHtml(session.id)}">${escapeHtml(session.protocolTitle || 'Sessão PBM')} · ${escapeHtml(String(session.startedAt || '').slice(0, 10))}</option>`).join('')
      : '<option value="">Nenhuma sessão elegível</option>';
    return `<article class="card finance-card" data-finance-package="${escapeHtml(pack.id)}">
      <div class="section-head"><div><span class="eyebrow">PACOTE</span><h3>${escapeHtml(pack.name)}</h3><p class="muted">${escapeHtml(patient?.fullName || pack.patientId)}</p></div>${statusBadge(statusLabel(pack.status), pack.status === 'active' ? 'success' : 'neutral')}</div>
      <div class="grid cards finance-summary-grid">
        <div><strong>${escapeHtml(pack.totalSessions)}</strong><span>Total</span></div>
        <div><strong>${escapeHtml(pack.usedSessions)}</strong><span>Usadas</span></div>
        <div><strong>${escapeHtml(pack.remainingSessions)}</strong><span>restantes</span></div>
        <div><strong>${escapeHtml(formatMoney(pack.totalAmountCents))}</strong><span>Valor</span></div>
      </div>
      ${canConsume ? `<div class="form-grid"><label>Sessão para consumir<select data-package-session="${escapeHtml(pack.id)}" aria-label="Sessão para consumir">${sessionOptions}</select></label></div><div class="actions"><button type="button" class="secondary" data-consume-package="${escapeHtml(pack.id)}" ${eligibleSessions.length ? '' : 'disabled'}>Consumir sessão</button></div>` : getRole() === 'admin' ? '' : '<p class="module-note">Consumo de pacote por sessão clínica fica oculto para perfis sem acesso clínico; nenhum endpoint de sessão é carregado.</p>'}
    </article>`;
  }

  function packagesPanel() {
    return `<div class="grid two-column finance-layout">
      <section class="card">
        <div class="section-head"><div><span class="eyebrow">NOVO PACOTE</span><h2>Criar pacote</h2></div></div>
        <div class="form-grid">
          <label>Paciente do pacote<select name="package-patient">${patientOptions()}</select></label>
          <label>Nome do pacote<input name="package-name" placeholder="Ex.: Ciclo 10 sessões"></label>
          <label>Sessões incluídas<input name="package-sessions" type="number" min="1" value="1"></label>
          <label>Valor total (R$)<input name="package-value" inputmode="decimal" value="0"></label>
        </div>
        <div class="actions"><button type="button" class="primary" data-create-package>Criar pacote</button></div>
      </section>
      <section class="page-stack finance-list">${local.packages.length ? local.packages.map(packageCard).join('') : emptyState({ title: 'Nenhum pacote', description: 'Pacotes de tratamento registrados aparecerão aqui.' })}</section>
    </div>`;
  }

  function paymentCard(payment) {
    const patient = patientFor(payment.patientId);
    return `<article class="card finance-card" data-finance-payment="${escapeHtml(payment.id)}">
      <div class="section-head"><div><span class="eyebrow">COBRANÇA</span><h3>${escapeHtml(formatMoney(payment.amountCents))}</h3><p class="muted">${escapeHtml(patient?.fullName || payment.patientId)}</p></div>${statusBadge(statusLabel(payment.status), payment.status === 'paid' ? 'success' : 'warning')}</div>
      <dl class="equipment-specs">
        <div><dt>Forma</dt><dd>${escapeHtml(payment.paymentMethod || '—')}</dd></div>
        <div><dt>Referência</dt><dd>${escapeHtml(payment.reference || '—')}</dd></div>
        <div><dt>Status</dt><dd>${escapeHtml(statusLabel(payment.status))}</dd></div>
        <div><dt>Pago em</dt><dd>${escapeHtml(payment.paidAt ? new Date(payment.paidAt).toLocaleString('pt-BR') : '—')}</dd></div>
      </dl>
      ${payment.status === 'pending' ? `<div class="actions"><button type="button" class="secondary" data-pay-payment="${escapeHtml(payment.id)}">Marcar como pago</button></div>` : ''}
    </article>`;
  }

  function paymentsPanel() {
    return `<div class="grid two-column finance-layout">
      <section class="card">
        <div class="section-head"><div><span class="eyebrow">NOVA COBRANÇA</span><h2>Registrar cobrança</h2></div></div>
        <div class="form-grid">
          <label>Paciente da cobrança<select name="payment-patient">${patientOptions()}</select></label>
          <label>Valor (R$)<input name="payment-value" inputmode="decimal"></label>
          <label>Forma de pagamento<select name="payment-method"><option value="pix">PIX</option><option value="cash">Dinheiro</option><option value="card">Cartão</option><option value="transfer">Transferência</option><option value="other">Outro</option></select></label>
          <label>Referência<input name="payment-reference" placeholder="Ex.: COB-001"></label>
        </div>
        <div class="actions"><button type="button" class="primary" data-create-payment>Registrar cobrança</button></div>
      </section>
      <section class="page-stack finance-list">${local.payments.length ? local.payments.map(paymentCard).join('') : emptyState({ title: 'Nenhuma cobrança', description: 'Cobranças persistidas aparecerão aqui.' })}</section>
    </div>`;
  }

  function render() {
    return `<div class="page-stack finance-view" data-finance-view>
      <div class="page-heading"><div><span class="eyebrow">FINANCEIRO</span><h1>Financeiro</h1><p>Pacotes e pagamentos operacionais persistidos, separados do prontuário clínico.</p></div><span class="status-badge status-success">Persistido</span></div>
      <nav class="workspace-tabs" role="tablist" aria-label="Financeiro">
        <button type="button" role="tab" aria-selected="${local.activeTab === 'packages'}" class="${local.activeTab === 'packages' ? 'is-active' : ''}" data-finance-tab="packages">Pacotes</button>
        <button type="button" role="tab" aria-selected="${local.activeTab === 'payments'}" class="${local.activeTab === 'payments' ? 'is-active' : ''}" data-finance-tab="payments">Pagamentos</button>
      </nav>
      <section class="workspace-panel">${local.activeTab === 'packages' ? packagesPanel() : paymentsPanel()}</section>
    </div>`;
  }

  function bindActions(root = document) {
    root.querySelectorAll('[data-finance-tab]').forEach((button) => button.addEventListener('click', () => {
      local.activeTab = button.dataset.financeTab;
      onChanged?.();
    }));

    root.querySelector('[data-create-package]')?.addEventListener('click', async () => {
      try {
        await gateway.createPackage({
          patientId: root.querySelector('[name="package-patient"]')?.value || '',
          name: root.querySelector('[name="package-name"]')?.value || '',
          totalSessions: Number(root.querySelector('[name="package-sessions"]')?.value || 0),
          totalAmountCents: toCents(root.querySelector('[name="package-value"]')?.value, 'Valor do pacote')
        });
        await load();
        onMessage?.('Pacote criado.', 'success');
        onChanged?.();
      } catch (error) { onMessage?.(error.message); }
    });

    root.querySelectorAll('[data-consume-package]').forEach((button) => button.addEventListener('click', async () => {
      const packageId = button.dataset.consumePackage;
      const select = root.querySelector(`[data-package-session="${CSS.escape(packageId)}"]`);
      try {
        if (!select?.value) throw new Error('Selecione uma sessão real deste paciente.');
        await gateway.consumePackage(packageId, select.value);
        await load();
        onMessage?.('Sessão consumida do pacote.', 'success');
        onChanged?.();
      } catch (error) { onMessage?.(error.message); }
    }));

    root.querySelector('[data-create-payment]')?.addEventListener('click', async () => {
      try {
        await gateway.createPayment({
          patientId: root.querySelector('[name="payment-patient"]')?.value || '',
          amountCents: toCents(root.querySelector('[name="payment-value"]')?.value, 'Valor'),
          paymentMethod: root.querySelector('[name="payment-method"]')?.value || 'other',
          reference: root.querySelector('[name="payment-reference"]')?.value || null
        });
        await load();
        onMessage?.('Cobrança registrada.', 'success');
        onChanged?.();
      } catch (error) { onMessage?.(error.message); }
    });

    root.querySelectorAll('[data-pay-payment]').forEach((button) => button.addEventListener('click', async () => {
      try {
        await gateway.markPaymentPaid(button.dataset.payPayment);
        await load();
        onMessage?.('Pagamento marcado como pago.', 'success');
        onChanged?.();
      } catch (error) { onMessage?.(error.message); }
    }));
  }

  return { load, render, bindActions };
}
