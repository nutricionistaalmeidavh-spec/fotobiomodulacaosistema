const view = document.querySelector('#view');
const operationalViews = new Set(['agenda', 'finance', 'reports']);

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

function setActive(name) {
  for (const button of document.querySelectorAll('[data-nav]')) button.classList.toggle('is-active', button.dataset.nav === name);
}

function money(cents) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(cents || 0) / 100);
}

function patientOptions(patients) {
  return patients.map((patient) => `<option value="${esc(patient.id)}">${esc(patient.fullName)}</option>`).join('');
}

function paymentRow(item, patients) {
  const patient = patients.find((entry) => entry.id === item.patientId);
  return `<tr data-f9-payment data-payment-id="${esc(item.id)}">
    <td>${esc(patient?.fullName || item.patientId)}</td>
    <td>${money(item.amountCents)}</td>
    <td>${esc(item.paymentMethod)}</td>
    <td>${esc(item.status)}</td>
    <td>${item.status === 'pending' ? `<button class="secondary compact" data-pay-f9="${esc(item.id)}">Marcar pago</button>` : ''}</td>
  </tr>`;
}

function bindPayButton(button) {
  if (!button || button.dataset.boundF9 === 'true') return;
  button.dataset.boundF9 = 'true';
  button.addEventListener('click', async () => {
    await api(`/api/payments/${encodeURIComponent(button.dataset.payF9)}/pay`, { method: 'POST', body: '{}' });
    await renderFinance();
  });
}

async function renderAgenda() {
  const [{ patients = [] }, { appointments = [] }] = await Promise.all([api('/api/patients'), api('/api/appointments')]);
  view.innerHTML = `
    <section class="card" data-f9-agenda>
      <div class="section-head"><div><span class="eyebrow">F9 · AGENDA</span><h2>Agenda clínica</h2></div><span class="status">Operação local</span></div>
      <p class="muted">Agendar ou concluir um compromisso não cria sessão PBM automaticamente.</p>
      <div class="form-grid three">
        <label>Paciente<select name="f9-appointment-patient">${patientOptions(patients)}</select></label>
        <label>Início<input name="f9-appointment-start" type="datetime-local"></label>
        <label>Fim<input name="f9-appointment-end" type="datetime-local"></label>
        <label>Tipo<select name="f9-appointment-type"><option value="evaluation">Avaliação</option><option value="session">Sessão</option><option value="return">Retorno</option><option value="other">Outro</option></select></label>
        <label>Repetições<input name="f9-recurrence-count" type="number" min="1" value="1"></label>
        <label>Intervalo (dias)<input name="f9-recurrence-days" type="number" min="1" value="7"></label>
      </div>
      <label>Observação<input name="f9-appointment-notes"></label>
      <div class="actions"><button data-create-appointment-f9>Agendar</button></div>
      <p class="muted" data-f9-agenda-feedback></p>
      <div class="table-wrap"><table><thead><tr><th>Data</th><th>Paciente</th><th>Tipo</th><th>Status</th><th>Ação</th></tr></thead><tbody>
        ${appointments.map((item) => {
          const patient = patients.find((entry) => entry.id === item.patientId);
          return `<tr data-f9-appointment><td>${esc(new Date(item.startsAt).toLocaleString('pt-BR'))}</td><td>${esc(patient?.fullName || item.patientId)}</td><td>${esc(item.appointmentType)}</td><td>${esc(item.status)}</td><td>${item.status === 'scheduled' ? `<button class="secondary compact" data-confirm-appointment-f9="${esc(item.id)}">Confirmar</button>` : ''}</td></tr>`;
        }).join('') || '<tr><td colspan="5">Nenhum compromisso registrado.</td></tr>'}
      </tbody></table></div>
    </section>`;

  view.querySelector('[data-create-appointment-f9]')?.addEventListener('click', async () => {
    const feedback = view.querySelector('[data-f9-agenda-feedback]');
    try {
      const start = view.querySelector('[name="f9-appointment-start"]').value;
      const end = view.querySelector('[name="f9-appointment-end"]').value;
      const count = Number(view.querySelector('[name="f9-recurrence-count"]').value || 1);
      await api('/api/appointments', { method: 'POST', body: JSON.stringify({
        patientId: view.querySelector('[name="f9-appointment-patient"]').value,
        startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString(),
        appointmentType: view.querySelector('[name="f9-appointment-type"]').value,
        recurrence: count > 1 ? { count, intervalDays: Number(view.querySelector('[name="f9-recurrence-days"]').value || 7) } : undefined,
        notes: view.querySelector('[name="f9-appointment-notes"]').value
      }) });
      await renderAgenda();
    } catch (error) { feedback.textContent = error.message; }
  });

  for (const button of view.querySelectorAll('[data-confirm-appointment-f9]')) {
    button.addEventListener('click', async () => {
      await api(`/api/appointments/${encodeURIComponent(button.dataset.confirmAppointmentF9)}`, { method: 'PATCH', body: JSON.stringify({ status: 'confirmed' }) });
      await renderAgenda();
    });
  }
}

async function renderFinance() {
  const [{ patients = [] }, { packages = [] }, { payments = [] }, { sessions = [] }] = await Promise.all([
    api('/api/patients'), api('/api/packages'), api('/api/payments'), api('/api/sessions')
  ]);
  view.innerHTML = `
    <div class="grid two-column" data-f9-finance>
      <section class="card">
        <span class="eyebrow">F9 · PACOTES</span><h2>Pacote de tratamento</h2>
        <label>Paciente<select name="f9-package-patient">${patientOptions(patients)}</select></label>
        <label>Nome<input name="f9-package-name" placeholder="Ex.: 10 sessões"></label>
        <div class="form-grid two"><label>Sessões<input name="f9-package-sessions" type="number" min="1" value="1"></label><label>Valor total (R$)<input name="f9-package-value" type="number" min="0" step="0.01"></label></div>
        <div class="actions"><button data-create-package-f9>Criar pacote</button></div><p class="muted" data-f9-package-feedback></p>
      </section>
      <section class="card">
        <span class="eyebrow">F9 · PAGAMENTOS</span><h2>Registrar cobrança</h2>
        <label>Paciente<select name="f9-payment-patient">${patientOptions(patients)}</select></label>
        <label>Pacote opcional<select name="f9-payment-package"><option value="">Sem pacote</option>${packages.map((item) => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('')}</select></label>
        <div class="form-grid two"><label>Valor (R$)<input name="f9-payment-value" type="number" min="0.01" step="0.01"></label><label>Forma<input name="f9-payment-method" value="pix"></label></div>
        <label>Vencimento<input name="f9-payment-due" type="datetime-local"></label>
        <div class="actions"><button data-create-payment-f9>Registrar cobrança</button></div><p class="muted" data-f9-payment-feedback></p>
      </section>
      <section class="card wide">
        <div class="section-head"><div><span class="eyebrow">PACOTES ATIVOS</span><h2>Consumo explícito de sessões</h2></div></div>
        <div class="form-grid two"><label>Pacote<select name="f9-consume-package">${packages.map((item) => `<option value="${esc(item.id)}">${esc(item.name)} · ${item.remainingSessions} restante(s)</option>`).join('')}</select></label><label>Sessão real<select name="f9-consume-session">${sessions.map((item) => `<option value="${esc(item.id)}">${esc(item.id)}</option>`).join('')}</select></label></div>
        <button data-consume-package-f9>Consumir sessão no pacote</button><p class="muted" data-f9-consume-feedback></p>
      </section>
      <section class="card wide"><h2>Pagamentos</h2><div class="table-wrap"><table><thead><tr><th>Paciente</th><th>Valor</th><th>Forma</th><th>Status</th><th></th></tr></thead><tbody data-f9-payments>
        ${payments.map((item) => paymentRow(item, patients)).join('') || '<tr data-f9-empty-payments><td colspan="5">Nenhum pagamento.</td></tr>'}
      </tbody></table></div></section>
    </div>`;

  view.querySelector('[data-create-package-f9]')?.addEventListener('click', async () => {
    const feedback = view.querySelector('[data-f9-package-feedback]');
    try {
      const { package: createdPackage } = await api('/api/packages', { method: 'POST', body: JSON.stringify({
        patientId: view.querySelector('[name="f9-package-patient"]').value,
        name: view.querySelector('[name="f9-package-name"]').value,
        totalSessions: Number(view.querySelector('[name="f9-package-sessions"]').value),
        totalAmountCents: Math.round(Number(view.querySelector('[name="f9-package-value"]').value || 0) * 100)
      }) });
      const paymentPackage = view.querySelector('[name="f9-payment-package"]');
      const consumePackage = view.querySelector('[name="f9-consume-package"]');
      paymentPackage.add(new Option(createdPackage.name, createdPackage.id));
      consumePackage.add(new Option(`${createdPackage.name} · ${createdPackage.remainingSessions} restante(s)`, createdPackage.id));
      feedback.textContent = 'Pacote criado.';
    } catch (error) { feedback.textContent = error.message; }
  });

  view.querySelector('[data-create-payment-f9]')?.addEventListener('click', async () => {
    const feedback = view.querySelector('[data-f9-payment-feedback]');
    try {
      const due = view.querySelector('[name="f9-payment-due"]').value;
      const { payment } = await api('/api/payments', { method: 'POST', body: JSON.stringify({
        patientId: view.querySelector('[name="f9-payment-patient"]').value,
        packageId: view.querySelector('[name="f9-payment-package"]').value || null,
        amountCents: Math.round(Number(view.querySelector('[name="f9-payment-value"]').value) * 100),
        paymentMethod: view.querySelector('[name="f9-payment-method"]').value,
        dueAt: due ? new Date(due).toISOString() : null
      }) });
      const tbody = view.querySelector('[data-f9-payments]');
      tbody.querySelector('[data-f9-empty-payments]')?.remove();
      tbody.insertAdjacentHTML('afterbegin', paymentRow(payment, patients));
      bindPayButton(tbody.querySelector(`[data-payment-id="${payment.id}"] [data-pay-f9]`));
      feedback.textContent = 'Cobrança registrada.';
    } catch (error) { feedback.textContent = error.message; }
  });

  view.querySelector('[data-consume-package-f9]')?.addEventListener('click', async () => {
    const feedback = view.querySelector('[data-f9-consume-feedback]');
    try {
      const packageId = view.querySelector('[name="f9-consume-package"]').value;
      const treatmentSessionId = view.querySelector('[name="f9-consume-session"]').value;
      await api(`/api/packages/${encodeURIComponent(packageId)}/consume`, { method: 'POST', body: JSON.stringify({ treatmentSessionId }) });
      await renderFinance();
    } catch (error) { feedback.textContent = error.message; }
  });

  for (const button of view.querySelectorAll('[data-pay-f9]')) bindPayButton(button);
}

async function renderReports() {
  view.innerHTML = `
    <section class="card" data-f9-reports>
      <div class="section-head"><div><span class="eyebrow">F9 · RELATÓRIOS</span><h2>Resumo operacional</h2></div><span class="status">Descritivo</span></div>
      <p class="muted">Os indicadores descrevem registros existentes; não projetam receita nem inferem eficácia clínica.</p>
      <div class="form-grid two"><label>De<input name="f9-report-from" type="date"></label><label>Até<input name="f9-report-to" type="date"></label></div>
      <div class="actions"><button data-load-report-f9>Gerar relatório</button></div><p class="muted" data-f9-report-feedback></p>
      <div class="grid cards" data-f9-report-output></div>
    </section>`;
  view.querySelector('[data-load-report-f9]').addEventListener('click', async () => {
    const fromValue = view.querySelector('[name="f9-report-from"]').value;
    const toValue = view.querySelector('[name="f9-report-to"]').value;
    const params = new URLSearchParams();
    if (fromValue) params.set('from', `${fromValue}T00:00:00.000Z`);
    if (toValue) params.set('to', `${toValue}T23:59:59.999Z`);
    try {
      const { report } = await api(`/api/reports/operations${params.size ? `?${params}` : ''}`);
      view.querySelector('[data-f9-report-output]').innerHTML = `
        <article class="card"><span class="eyebrow">PACIENTES</span><div class="metric">${report.patientsAttended}</div><strong>atendidos/agendados</strong></article>
        <article class="card"><span class="eyebrow">SESSÕES PBM</span><div class="metric">${report.pbmSessions}</div><strong>registros no período</strong></article>
        <article class="card"><span class="eyebrow">RECEBIDO</span><div class="metric">${money(report.finance.receivedCents)}</div><strong>pagamentos quitados</strong></article>
        <article class="card"><span class="eyebrow">PENDENTE</span><div class="metric">${money(report.finance.pendingCents)}</div><strong>cobranças pendentes</strong></article>`;
      view.querySelector('[data-f9-report-feedback]').textContent = 'Relatório atualizado.';
    } catch (error) { view.querySelector('[data-f9-report-feedback]').textContent = error.message; }
  });
}

async function renderOperational(name) {
  setActive(name);
  if (name === 'agenda') return renderAgenda();
  if (name === 'finance') return renderFinance();
  return renderReports();
}

document.addEventListener('click', (event) => {
  const button = event.target.closest?.('[data-nav]');
  if (!button || !operationalViews.has(button.dataset.nav)) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  renderOperational(button.dataset.nav).catch((error) => { if (view) view.innerHTML = `<section class="card"><p>${esc(error.message)}</p></section>`; });
}, true);
