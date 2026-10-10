import { emptyState, escapeHtml, statusBadge } from '../ui/primitives.js';

export function createDocumentsView({ gateway, patientId, onChanged, onMessage }) {
  const local = { encounters: [], documents: [] };

  async function load() {
    const [patient, documents] = await Promise.all([
      gateway.getPatient(patientId),
      gateway.listDocuments(patientId)
    ]);
    local.encounters = patient.workspace?.encounters || [];
    local.documents = documents || [];
  }

  function encounterOptions() {
    if (!local.encounters.length) return '<option value="">Nenhum atendimento disponível</option>';
    return local.encounters.map((encounter) => `<option value="${escapeHtml(encounter.id)}">${escapeHtml(String(encounter.startedAt || '').slice(0, 16).replace('T', ' ') || encounter.id)}</option>`).join('');
  }

  function documentList() {
    if (!local.documents.length) return emptyState({ title: 'Nenhum documento registrado', description: 'Gere um PDF de um atendimento clínico já registrado.' });
    return `<div class="evolution-list">${local.documents.map((document) => `<article class="card compact-card" data-document-record="${escapeHtml(document.id)}">
      <div class="section-head"><div><span class="eyebrow">DOCUMENTO</span><h3>PDF do atendimento</h3></div>${statusBadge(document.status === 'finalized' ? 'Finalizado' : 'Registrado', 'success')}</div>
      <p>${escapeHtml(document.title || 'Documento clínico')}</p>
      <div class="muted">${escapeHtml(document.createdAt || document.finalizedAt || '—')}</div>
      ${document.sha256 ? `<p class="module-note">SHA-256 ${escapeHtml(document.sha256.slice(0, 16))}…</p>` : ''}
    </article>`).join('')}</div>`;
  }

  function render() {
    return `<div class="page-stack" data-documents-view>
      <section class="card">
        <div class="section-head"><div><span class="eyebrow">DOCUMENTOS</span><h2>Documentos clínicos</h2></div>${statusBadge('Persistido', 'success')}</div>
        <p class="muted">O PDF é gerado localmente a partir de um atendimento existente e registrado com hash de integridade.</p>
        <label>Atendimento para PDF<select name="document-encounter" ${local.encounters.length ? '' : 'disabled'}>${encounterOptions()}</select></label>
        <div class="actions"><button type="button" class="primary" data-generate-encounter-pdf ${local.encounters.length ? '' : 'disabled'}>Gerar PDF do atendimento</button></div>
      </section>
      <section aria-label="Documentos do paciente">${documentList()}</section>
    </div>`;
  }

  function bindActions(root = document) {
    root.querySelector('[data-generate-encounter-pdf]')?.addEventListener('click', async () => {
      const encounterId = root.querySelector('[name="document-encounter"]')?.value || '';
      if (!encounterId) return;
      try {
        await gateway.generateEncounterPdf(encounterId);
        await load();
        onMessage?.('PDF do atendimento gerado e registrado.', 'success');
        onChanged?.();
      } catch (error) {
        onMessage?.(error.message);
      }
    });
  }

  return { load, render, bindActions };
}
