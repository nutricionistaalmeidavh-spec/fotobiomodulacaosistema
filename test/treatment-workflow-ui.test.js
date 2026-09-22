import test from 'node:test';
import assert from 'node:assert/strict';
import { TREATMENT_STAGES, renderTreatmentWorkflow } from '../src/app/public/features/treatment-workflow.js';

test('guided treatment workflow exposes the five approved clinical stages', () => {
  assert.deepEqual(TREATMENT_STAGES.map((stage) => stage.id), ['planning', 'safety', 'application', 'record', 'evolution']);
});

test('workflow keeps planned and applied inputs separate and retains professional adjustment field', () => {
  const html = renderTreatmentWorkflow({
    protocols: [{ title: 'Protocolo teste', versions: [{ id: 'pv1', versionNumber: 1 }] }],
    sessions: []
  });
  assert.match(html, /Planejamento/);
  assert.match(html, /Segurança/);
  assert.match(html, /Aplicação/);
  assert.match(html, /Registro/);
  assert.match(html, /Evolução/);
  assert.match(html, /name="planned-energy"/);
  assert.match(html, /name="applied-energy"/);
  assert.match(html, /name="adjustment-reason"/);
  assert.match(html, /decisão profissional/i);
  assert.doesNotMatch(html, /liberação automática/i);
});
