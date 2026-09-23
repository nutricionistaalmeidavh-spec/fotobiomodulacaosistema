const view = document.querySelector('#view');

function ensurePhaseHistory() {
  if (!view) return;
  const auditCard = view.querySelector('.dashboard-audit');
  if (!auditCard || view.querySelector('[data-f4-phase-history]')) return;
  auditCard.insertAdjacentHTML('beforebegin', `
    <section class="card" data-f4-phase-history>
      <div class="section-head">
        <div>
          <span class="eyebrow">MARCO ANTERIOR</span>
          <h2>F3 concluída</h2>
        </div>
        <span class="status">Preservada</span>
      </div>
      <p>Equipamentos, aplicadores e adaptação determinística permanecem ativos enquanto a F4 fecha o MVP clínico.</p>
    </section>
  `);
}

new MutationObserver(ensurePhaseHistory).observe(view, { childList: true, subtree: true });
ensurePhaseHistory();
