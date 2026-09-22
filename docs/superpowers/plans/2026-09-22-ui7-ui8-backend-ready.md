# UI-7 / UI-8 Backend-Ready Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the frontend through UI-8 and replace direct storage/transport knowledge in feature code with a stable `ClinicalDataGateway` so future persisted backends can replace local capabilities without rewriting screens.

**Architecture:** Introduce asynchronous adapters behind one gateway: `F0ApiAdapter` owns all existing `/api/...` traffic and `LocalClinicalAdapter` owns deterministic session-memory capabilities. Feature modules depend only on the gateway; each feature caches loaded data for synchronous rendering while reads/writes remain async at the data boundary. UI-7 and UI-8 are then implemented on top of that boundary, with explicit `local` versus `persisted` source semantics.

**Tech Stack:** Node.js >=22.5, native ES modules, native HTML/CSS, Node `node:test`, SQLite-backed existing F0 HTTP API, Playwright ^1.55.0.

**Spec:** `docs/superpowers/specs/2026-09-22-ui7-ui8-backend-ready-design.md`

## Global Constraints

- Preserve existing F0 clinical invariants: immutable protocol versions; sessions linked to the exact version; planned and applied parameters remain separate; professional justification is required when applied parameters differ; audit remains append-only/hash chained.
- Core remains self-hosted/open-source/R$0; no paid runtime dependency or external SaaS becomes mandatory.
- Every UI-7/UI-8 mutable record that could be mistaken for persisted data must expose `source: 'local' | 'persisted'` and the UI must show that source in text, not color alone.
- A failed persisted write must never be silently converted to local success.
- No feature module and no `app.js` code may call `/api/...` directly after Task 2; HTTP endpoint knowledge belongs only in `src/app/public/data/adapters/f0-api-adapter.js`.
- No AI diagnosis, treatment recommendation, treatment efficacy score, automated clinical clearance, or clinical ranking.
- New UI remains keyboard reachable and usable at 390px without global horizontal overflow.
- Existing UI-0 through UI-6 behavior and F0 regressions remain green throughout execution.

## Review Focus

1. **Missing/partial adapter capability:** gateway construction must fail with a precise error rather than failing later during a clinical workflow. Task 1 adds a contract test for a missing method.
2. **Persisted API write fails:** the error must propagate to the UI and no local record may be created as a fallback. Task 2 adds a rejected-write test and browser regression.
3. **Invalid or oversized local photo file:** non-image files and images above 5 MiB must be rejected before a Data URL is stored in session memory. Task 4 adds unit/E2E coverage.
4. **Unknown agenda status or invalid date/time:** local state must not mutate when status is outside `scheduled|completed|cancelled` or scheduled time is invalid. Task 5 adds unit tests before UI wiring.
5. **Invalid report period:** `from > to` must produce a clear validation state rather than misleading metrics or an exception leaking into the page. Task 6 adds pure-function and E2E coverage.

---

## File Structure Locked by This Plan

```text
src/app/public/
  data/
    contracts.js
    clinical-data-gateway.js
    operational-report.js
    fixtures.js
    adapters/
      f0-api-adapter.js
      local-clinical-adapter.js
  features/
    dashboard.js
    patients.js
    clinical-intake.js
    patient-workspace.js
    evolution.js
    photos.js
    agenda.js
    reports.js
    audit.js
    f0-views.js
    planned-routes.js
  app.js
  clinical.css

test/
  data-gateway.test.js
  local-clinical-adapter.test.js
  operational-report.test.js
  ui-contract.test.js
  e2e/
    evolution.spec.js
    photos.spec.js
    agenda.spec.js
    reports.spec.js
    audit-gateway.spec.js
```

---

### Task 1: Data contracts, adapters and gateway foundation

**Files:**
- Modify: `src/app/public/data/contracts.js`
- Create: `src/app/public/data/adapters/f0-api-adapter.js`
- Create: `src/app/public/data/adapters/local-clinical-adapter.js`
- Create: `src/app/public/data/clinical-data-gateway.js`
- Modify: `src/app/public/data/fixtures.js`
- Create: `test/data-gateway.test.js`
- Create: `test/local-clinical-adapter.test.js`

**Interfaces:**
- Consumes: existing F0 JSON from `/api/status`, `/api/equipment`, `/api/protocols`, `/api/sessions`, `/api/audit`; existing `UI_FIXTURES` patient/intake shape.
- Produces: `createF0ApiAdapter({ request })`, `createLocalClinicalAdapter(seed)`, `createClinicalDataGateway({ f0Adapter, localAdapter })`. Every public adapter/gateway method returns a Promise.

- [ ] **Step 1: Write failing gateway contract tests**

Create `test/data-gateway.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createClinicalDataGateway } from '../src/app/public/data/clinical-data-gateway.js';

function fakeF0(overrides = {}) {
  return {
    getFoundationStatus: async () => ({ phase: 'F0', tableCount: 19 }),
    listProtocols: async () => [],
    createProtocol: async (input) => ({ id: 'p1', ...input, source: 'persisted' }),
    createProtocolVersion: async () => ({ versionNumber: 2, source: 'persisted' }),
    listEquipment: async () => [],
    listSessions: async () => [],
    createSession: async (input) => ({ id: 's1', ...input, source: 'persisted' }),
    getAuditState: async () => ({ valid: true, events: [], source: 'persisted' }),
    ...overrides
  };
}

function fakeLocal(overrides = {}) {
  return {
    getDashboard: async () => ({ sessionsToday: 0 }),
    listPatients: async () => [],
    getPatient: async () => null,
    createPatient: async (input) => ({ id: 'local-p1', ...input, source: 'local' }),
    getClinicalIntake: async () => ({ source: 'local' }),
    updateAnamnesis: async () => ({ source: 'local' }),
    updateConsent: async () => ({ source: 'local' }),
    updateSafetyChecklist: async () => ({ source: 'local' }),
    listEvolution: async () => [],
    addEvolution: async (patientId, input) => ({ id: 'e1', patientId, ...input, source: 'local' }),
    listPhotos: async () => [],
    addPhotoMetadata: async (patientId, input) => ({ id: 'ph1', patientId, ...input, source: 'local' }),
    removePhotoMetadata: async () => true,
    listAgenda: async () => [],
    createAgendaItem: async (input) => ({ id: 'a1', ...input, source: 'local' }),
    updateAgendaItem: async () => ({ source: 'local' }),
    ...overrides
  };
}

test('gateway rejects a partial local adapter at construction time', () => {
  const broken = fakeLocal();
  delete broken.listEvolution;
  assert.throws(
    () => createClinicalDataGateway({ f0Adapter: fakeF0(), localAdapter: broken }),
    /localAdapter must implement listEvolution\(\)/
  );
});

test('gateway preserves local and persisted source metadata', async () => {
  const gateway = createClinicalDataGateway({ f0Adapter: fakeF0(), localAdapter: fakeLocal() });
  assert.equal((await gateway.createPatient({ fullName: 'Ana' })).source, 'local');
  assert.equal((await gateway.createSession({ plannedEnergyJ: 4 })).source, 'persisted');
});
```

- [ ] **Step 2: Run RED**

```bash
node --test test/data-gateway.test.js
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `clinical-data-gateway.js`.

- [ ] **Step 3: Expand `contracts.js` with exact capabilities**

```js
export const DATA_SOURCE = Object.freeze({ LOCAL: 'local', PERSISTED: 'persisted' });

export const F0_ADAPTER_METHODS = Object.freeze([
  'getFoundationStatus', 'listProtocols', 'createProtocol', 'createProtocolVersion',
  'listEquipment', 'listSessions', 'createSession', 'getAuditState'
]);

export const LOCAL_ADAPTER_METHODS = Object.freeze([
  'getDashboard', 'listPatients', 'getPatient', 'createPatient',
  'getClinicalIntake', 'updateAnamnesis', 'updateConsent', 'updateSafetyChecklist',
  'listEvolution', 'addEvolution', 'listPhotos', 'addPhotoMetadata',
  'removePhotoMetadata', 'listAgenda', 'createAgendaItem', 'updateAgendaItem'
]);

export function assertAdapterCapabilities(name, adapter, methods) {
  if (!adapter || typeof adapter !== 'object') throw new TypeError(`${name} is required`);
  for (const method of methods) {
    if (typeof adapter[method] !== 'function') throw new TypeError(`${name} must implement ${method}()`);
  }
  return adapter;
}
```

Keep `cloneUiData()`.

- [ ] **Step 4: Implement `F0ApiAdapter` as the only endpoint owner**

Create `src/app/public/data/adapters/f0-api-adapter.js`:

```js
import { DATA_SOURCE } from '../contracts.js';

export function createF0ApiAdapter({ request = fetch } = {}) {
  async function json(path, options = {}) {
    const response = await request(path, {
      ...options,
      headers: { 'content-type': 'application/json', ...(options.headers || {}) }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Falha HTTP ${response.status}`);
    return payload;
  }

  return {
    async getFoundationStatus() { return json('/api/status'); },
    async listProtocols() {
      const payload = await json('/api/protocols');
      return payload.protocols.map((item) => ({ ...item, source: DATA_SOURCE.PERSISTED }));
    },
    async createProtocol(input) {
      const payload = await json('/api/protocols', { method: 'POST', body: JSON.stringify(input) });
      return { ...payload.protocol, source: DATA_SOURCE.PERSISTED };
    },
    async createProtocolVersion(protocolId, input) {
      const payload = await json(`/api/protocols/${encodeURIComponent(protocolId)}/versions`, {
        method: 'POST', body: JSON.stringify(input)
      });
      return { ...(payload.version || payload), source: DATA_SOURCE.PERSISTED };
    },
    async listEquipment() {
      const payload = await json('/api/equipment');
      return payload.equipment.map((item) => ({ ...item, source: DATA_SOURCE.PERSISTED }));
    },
    async listSessions() {
      const payload = await json('/api/sessions');
      return payload.sessions.map((item) => ({ ...item, source: DATA_SOURCE.PERSISTED }));
    },
    async createSession(input) {
      const payload = await json('/api/sessions', { method: 'POST', body: JSON.stringify(input) });
      return { ...(payload.session || payload), source: DATA_SOURCE.PERSISTED };
    },
    async getAuditState() {
      const payload = await json('/api/audit');
      return { ...payload, source: DATA_SOURCE.PERSISTED };
    }
  };
}
```

Before changing feature code, add request-stub tests that pin the actual create-protocol/version/session response shapes returned by the current F0 server.

- [ ] **Step 5: Implement `LocalClinicalAdapter` with deterministic state and validation**

Move current mock patient/intake behavior into `src/app/public/data/adapters/local-clinical-adapter.js`; seed `evolution`, `photos` and top-level `agenda` arrays. Use:

```js
const AGENDA_STATUSES = new Set(['scheduled', 'completed', 'cancelled']);

function required(value, message) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(message);
  return result;
}

function parseAgendaDate(value) {
  const raw = required(value, 'Informe data e hora da agenda.');
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw new TypeError('Data/hora da agenda é inválida.');
  return raw;
}
```

Validate complete patches before mutating. Every patient/evolution/photo/agenda return includes `source: 'local'`.

- [ ] **Step 6: Add no-mutation-on-error tests**

Create `test/local-clinical-adapter.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalClinicalAdapter } from '../src/app/public/data/adapters/local-clinical-adapter.js';

const seed = {
  dashboard: {}, agenda: [],
  patients: [{ id: 'p1', fullName: 'Ana', status: 'active', timeline: [], evolution: [], photos: [], clinicalIntake: { anamnesis: {}, consent: {}, safetyChecklist: {} } }]
};

test('evolution rejects blank title without mutation', async () => {
  const adapter = createLocalClinicalAdapter(seed);
  await assert.rejects(() => adapter.addEvolution('p1', { title: '   ', date: '2026-09-22' }), /título/i);
  assert.deepEqual(await adapter.listEvolution('p1'), []);
});

test('agenda rejects unknown status without mutation', async () => {
  const adapter = createLocalClinicalAdapter(seed);
  await assert.rejects(() => adapter.createAgendaItem({ patientId: 'p1', startsAt: '2026-09-23T09:00', status: 'done-ish' }), /status/i);
  assert.deepEqual(await adapter.listAgenda(), []);
});
```

- [ ] **Step 7: Implement gateway delegation only**

Create `src/app/public/data/clinical-data-gateway.js` without report logic yet:

```js
import { assertAdapterCapabilities, F0_ADAPTER_METHODS, LOCAL_ADAPTER_METHODS } from './contracts.js';

export function createClinicalDataGateway({ f0Adapter, localAdapter }) {
  assertAdapterCapabilities('f0Adapter', f0Adapter, F0_ADAPTER_METHODS);
  assertAdapterCapabilities('localAdapter', localAdapter, LOCAL_ADAPTER_METHODS);

  return {
    ...Object.fromEntries(LOCAL_ADAPTER_METHODS.map((name) => [name, (...args) => localAdapter[name](...args)])),
    ...Object.fromEntries(F0_ADAPTER_METHODS.map((name) => [name, (...args) => f0Adapter[name](...args)]))
  };
}
```

Reports are intentionally added in Task 6 so Task 1 has no dependency on a not-yet-created file.

- [ ] **Step 8: Run GREEN and full unit regression**

```bash
node --test test/data-gateway.test.js test/local-clinical-adapter.test.js
npm run test:unit
npm run check
```

Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add src/app/public/data test/data-gateway.test.js test/local-clinical-adapter.test.js
git commit -m "feat: add clinical data gateway and adapters"
```

---

### Task 2: Migrate UI-0 through UI-6 to gateway-only data access

**Files:**
- Modify: `src/app/public/app.js`
- Modify: `src/app/public/features/dashboard.js`
- Modify: `src/app/public/features/patients.js`
- Modify: `src/app/public/features/clinical-intake.js`
- Modify: `src/app/public/features/patient-workspace.js`
- Modify: `src/app/public/features/f0-views.js`
- Delete: `src/app/public/data/mock-provider.js`
- Modify: `test/ui-contract.test.js`
- Modify: `test/data-gateway.test.js`
- Modify: `test/e2e/f0-regression.spec.js`
- Modify: `test/e2e/patients.spec.js`
- Modify: `test/e2e/patient-workspace.spec.js`

**Interfaces:**
- Consumes: Task 1 adapters/gateway.
- Produces: existing features with async `load()`/write methods backed only by `ClinicalDataGateway`; `app.js` becomes composition/navigation.

- [ ] **Step 1: Add structural RED test forbidding direct endpoint use**

Extend `test/ui-contract.test.js`:

```js
import fs from 'node:fs';
import path from 'node:path';

const frontendRoot = path.resolve('src/app/public');
const allowed = path.join(frontendRoot, 'data/adapters/f0-api-adapter.js');

function jsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? jsFiles(full) : entry.name.endsWith('.js') ? [full] : [];
  });
}

test('only F0ApiAdapter contains frontend API endpoints', () => {
  const offenders = jsFiles(frontendRoot)
    .filter((file) => file !== allowed)
    .filter((file) => /\/api\//.test(fs.readFileSync(file, 'utf8')));
  assert.deepEqual(offenders, []);
});
```

Run `node --test test/ui-contract.test.js`; expected FAIL naming `app.js`.

- [ ] **Step 2: Compose the gateway in `app.js`**

```js
import { createF0ApiAdapter } from './data/adapters/f0-api-adapter.js';
import { createLocalClinicalAdapter } from './data/adapters/local-clinical-adapter.js';
import { createClinicalDataGateway } from './data/clinical-data-gateway.js';
import { UI_FIXTURES } from './data/fixtures.js';

const gateway = createClinicalDataGateway({
  f0Adapter: createF0ApiAdapter(),
  localAdapter: createLocalClinicalAdapter(UI_FIXTURES)
});
```

Delete the generic `api()` helper. `refreshAll()` uses only gateway F0 methods:

```js
async function refreshAll() {
  const [status, equipment, protocols, sessions, audit] = await Promise.all([
    gateway.getFoundationStatus(), gateway.listEquipment(), gateway.listProtocols(),
    gateway.listSessions(), gateway.getAuditState()
  ]);
  Object.assign(state, { status, equipment, protocols, sessions, audit });
}
```

- [ ] **Step 3: Convert Dashboard, Patients and Patient Workspace to async controller caches**

Each controller owns loaded state and exposes `load()`. For Patients:

```js
export function createPatientsView({ gateway, onOpenPatient, onChanged, onMessage }) {
  const local = { patients: [], query: '', status: 'all', dialogOpen: false, error: '' };
  async function load() { local.patients = await gateway.listPatients(); }
  function render() {
    const allPatients = local.patients;
    // retain current filter/focus-safe rendering
  }
  return { load, render, bindActions };
}
```

Patient creation handler becomes `async`, awaits `gateway.createPatient()`, reloads, then rerenders. `patientWorkspaceView.setPatient(patientId)` becomes async and loads patient/intake through gateway.

- [ ] **Step 4: Move Clinical Intake writes to gateway**

`clinical-intake.js` receives `gateway`; write handlers use:

```js
await gateway.updateAnamnesis(patientId, patch);
await gateway.updateConsent(patientId, patch);
await gateway.updateSafetyChecklist(patientId, patch);
```

On rejection, call `onMessage(error.message)` and do not update local cached success state.

- [ ] **Step 5: Move F0 writes in `f0-views.js` to gateway**

```js
await gateway.createProtocol({ title, changeSummary });
await gateway.createProtocolVersion(state.selectedProtocolId, { changeSummary });
await gateway.createSession({ protocolVersionId, plannedEnergyJ, appliedEnergyJ, professionalAdjustmentReason });
```

Keep the existing professional-reason UI guard and preserve backend validation.

- [ ] **Step 6: Add persisted-write failure regression**

In `test/data-gateway.test.js`:

```js
test('persisted write failure propagates without local fallback', async () => {
  let localWrites = 0;
  const gateway = createClinicalDataGateway({
    f0Adapter: fakeF0({ createSession: async () => { throw new Error('backend unavailable'); } }),
    localAdapter: fakeLocal({ createAgendaItem: async () => { localWrites += 1; } })
  });
  await assert.rejects(() => gateway.createSession({ plannedEnergyJ: 4 }), /backend unavailable/);
  assert.equal(localWrites, 0);
});
```

- [ ] **Step 7: Make route loading explicit**

```js
async function loadRoute(route) {
  if (route === 'dashboard') await dashboardView.load();
  if (route === 'patients') await patientsView.load();
}

async function navigate(route) {
  // retain route validation
  state.currentView = route;
  await refreshAll();
  await loadRoute(route);
  render();
}
```

`openPatient()` awaits `patientWorkspaceView.setPatient(patientId)` before render.

- [ ] **Step 8: Remove `mock-provider.js`**

Delete it after all imports/tests use the gateway/local adapter. There must be one local data model only.

- [ ] **Step 9: Run regressions**

```bash
npm run check
npm run test:unit
npx playwright test test/e2e/patients.spec.js test/e2e/patient-workspace.spec.js test/e2e/f0-regression.spec.js test/e2e/ui-foundation.spec.js
npm run smoke
```

Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add src/app/public test
git commit -m "refactor: route frontend data through clinical gateway"
```

---

### Task 3: UI-7 Evolution workflow

**Files:**
- Create: `src/app/public/features/evolution.js`
- Modify: `src/app/public/features/patient-workspace.js`
- Modify: `src/app/public/data/fixtures.js`
- Modify: `src/app/public/clinical.css`
- Modify: `test/local-clinical-adapter.test.js`
- Create: `test/e2e/evolution.spec.js`

**Interfaces:**
- Consumes: `gateway.listEvolution(patientId, filters?)`, `gateway.addEvolution(patientId, input)`.
- Produces: `createEvolutionView({ gateway, patientId, onChanged, onMessage })` with `load()`, `render()`, `bindActions()`.

- [ ] **Step 1: Add local-adapter filter/source tests**

```js
test('evolution filters by category/date and remains local', async () => {
  const adapter = createLocalClinicalAdapter(seed);
  await adapter.addEvolution('p1', { date: '2026-09-20', category: 'session', title: 'Sessão 1', notes: 'Sem intercorrência' });
  await adapter.addEvolution('p1', { date: '2026-09-22', category: 'assessment', title: 'Reavaliação', notes: 'Registro descritivo' });
  const result = await adapter.listEvolution('p1', { category: 'assessment', from: '2026-09-21', to: '2026-09-23' });
  assert.equal(result.length, 1);
  assert.equal(result[0].title, 'Reavaliação');
  assert.equal(result[0].source, 'local');
});
```

- [ ] **Step 2: Add RED E2E**

`test/e2e/evolution.spec.js`:

```js
test('adds and filters local evolution without claiming persistence', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-nav="patients"]').click();
  await page.getByRole('button', { name: 'Ana Martins', exact: true }).click();
  await page.getByRole('tab', { name: 'Evolução' }).click();
  await page.getByLabel('Título da evolução').fill('Reavaliação funcional E2E');
  await page.getByLabel('Data da evolução').fill('2026-09-22');
  await page.getByLabel('Categoria da evolução').selectOption('assessment');
  await page.getByLabel('Observações da evolução').fill('Registro descritivo sem interpretação automática.');
  await page.getByRole('button', { name: 'Adicionar evolução' }).click();
  await expect(page.getByText('Reavaliação funcional E2E')).toBeVisible();
  await expect(page.getByText(/Somente local|não persistido/i)).toBeVisible();
  await page.getByLabel('Filtrar categoria').selectOption('session');
  await expect(page.getByText('Reavaliação funcional E2E')).toBeHidden();
});
```

Run unit + this E2E; expected RED because the workflow does not exist.

- [ ] **Step 3: Implement `evolution.js`**

```js
export function createEvolutionView({ gateway, patientId, onChanged, onMessage }) {
  const local = { records: [], category: 'all', from: '', to: '' };

  async function load() {
    local.records = await gateway.listEvolution(patientId, {
      category: local.category,
      from: local.from || undefined,
      to: local.to || undefined
    });
  }

  async function add(input) {
    await gateway.addEvolution(patientId, input);
    await load();
    onMessage?.('Evolução adicionada somente ao estado local; ainda não persistida no backend.', 'success');
    onChanged?.();
  }

  return { load, render, bindActions };
}
```

Render categories `assessment`, `session`, `follow-up`, `note`; each record prints `Somente local · não persistido` or `Persistido`. Do not render diagnosis/effectiveness fields.

- [ ] **Step 4: Wire the Evolution tab**

`patient-workspace.js` creates the controller on patient selection and awaits `evolutionView.load()` before showing the tab.

- [ ] **Step 5: Add responsive styles**

Use two columns above 760px and one below; timeline metadata wraps and source text remains visible.

- [ ] **Step 6: Run GREEN**

```bash
node --test test/local-clinical-adapter.test.js
npx playwright test test/e2e/evolution.spec.js test/e2e/patient-workspace.spec.js
```

- [ ] **Step 7: Commit**

```bash
git add src/app/public/features/evolution.js src/app/public/features/patient-workspace.js src/app/public/data/fixtures.js src/app/public/clinical.css test
git commit -m "feat: add local evolution workflow"
```

---

### Task 4: UI-7 Photos metadata and local preview

**Files:**
- Create: `src/app/public/features/photos.js`
- Modify: `src/app/public/features/patient-workspace.js`
- Modify: `src/app/public/clinical.css`
- Modify: `test/local-clinical-adapter.test.js`
- Modify: `test/ui-helpers.test.js`
- Create: `test/e2e/photos.spec.js`

**Interfaces:**
- Consumes: `gateway.listPhotos()`, `gateway.addPhotoMetadata()`, `gateway.removePhotoMetadata()`.
- Produces: `createPhotosView({ gateway, patientId, onChanged, onMessage, confirmRemoval? })`, `validateLocalPhotoFile(file)`, `readLocalPhoto(file)`.

- [ ] **Step 1: Add adapter add/remove test**

```js
test('photo metadata is local and removable', async () => {
  const adapter = createLocalClinicalAdapter(seed);
  const created = await adapter.addPhotoMetadata('p1', {
    capturedDate: '2026-09-22', region: 'Ombro direito', observation: 'Vista anterior', previewDataUrl: 'data:image/png;base64,AA=='
  });
  assert.equal(created.source, 'local');
  assert.equal((await adapter.listPhotos('p1')).length, 1);
  assert.equal(await adapter.removePhotoMetadata('p1', created.id), true);
  assert.deepEqual(await adapter.listPhotos('p1'), []);
});
```

- [ ] **Step 2: Add file validation tests**

Implementation contract:

```js
export const MAX_LOCAL_PHOTO_BYTES = 5 * 1024 * 1024;

export function validateLocalPhotoFile(file) {
  if (!file || !String(file.type).startsWith('image/')) throw new TypeError('Selecione um arquivo de imagem.');
  if (file.size > MAX_LOCAL_PHOTO_BYTES) throw new TypeError('A imagem local deve ter no máximo 5 MiB.');
  return file;
}
```

Test a `text/plain` file and `image/png` larger than `MAX_LOCAL_PHOTO_BYTES`.

- [ ] **Step 3: Add RED E2E for preview/source/removal confirmation**

```js
await page.getByLabel('Arquivo da foto').setInputFiles({
  name: 'ombro.png',
  mimeType: 'image/png',
  buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl9sAAAAASUVORK5CYII=', 'base64')
});
await page.getByLabel('Região fotografada').fill('Ombro direito');
await page.getByRole('button', { name: 'Adicionar foto local' }).click();
await expect(page.getByText('Ombro direito')).toBeVisible();
await expect(page.getByText(/não persistido/i)).toBeVisible();
page.once('dialog', (dialog) => dialog.dismiss());
await page.getByRole('button', { name: /Remover foto/i }).click();
await expect(page.getByText('Ombro direito')).toBeVisible();
page.once('dialog', (dialog) => dialog.accept());
await page.getByRole('button', { name: /Remover foto/i }).click();
await expect(page.getByText('Ombro direito')).toBeHidden();
```

Expected RED because Photos is still empty.

- [ ] **Step 4: Implement browser-only local preview reading**

```js
export function readLocalPhoto(file) {
  validateLocalPhotoFile(file);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem local.'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}
```

Store Data URL + metadata only in local adapter session memory. UI copy: `Pré-visualização local · não enviada ao backend`.

- [ ] **Step 5: Wire Photos and confirmation**

`patient-workspace.js` creates/loads `photosView`; default removal uses `window.confirm('Remover esta foto do estado local?')`.

- [ ] **Step 6: Add responsive photo grid**

Use `repeat(auto-fit, minmax(220px, 1fr))`, `aspect-ratio: 4 / 3`, `object-fit: cover` and wrapped actions.

- [ ] **Step 7: Run GREEN**

```bash
npm run check
npm run test:unit
npx playwright test test/e2e/photos.spec.js test/e2e/evolution.spec.js test/e2e/patient-workspace.spec.js
```

- [ ] **Step 8: Commit**

```bash
git add src/app/public/features/photos.js src/app/public/features/patient-workspace.js src/app/public/clinical.css test
git commit -m "feat: add local clinical photo workspace"
```

---

### Task 5: UI-8 Agenda

**Files:**
- Create: `src/app/public/features/agenda.js`
- Modify: `src/app/public/app.js`
- Modify: `src/app/public/features/planned-routes.js`
- Modify: `src/app/public/clinical.css`
- Modify: `src/app/public/data/fixtures.js`
- Modify: `test/local-clinical-adapter.test.js`
- Create: `test/e2e/agenda.spec.js`

**Interfaces:**
- Consumes: `gateway.listAgenda(filters?)`, `gateway.createAgendaItem()`, `gateway.updateAgendaItem()`, `gateway.listPatients()`.
- Produces: `createAgendaView({ gateway, onOpenPatient, onChanged, onMessage })`.

- [ ] **Step 1: Add agenda validation/filter tests**

```js
test('agenda validates before mutation and supports status updates', async () => {
  const adapter = createLocalClinicalAdapter(seed);
  const created = await adapter.createAgendaItem({ patientId: 'p1', startsAt: '2026-09-23T09:00', status: 'scheduled', note: 'Retorno' });
  assert.equal(created.source, 'local');
  assert.equal((await adapter.listAgenda({ status: 'scheduled' })).length, 1);
  const updated = await adapter.updateAgendaItem(created.id, { status: 'completed' });
  assert.equal(updated.status, 'completed');
  const before = await adapter.listAgenda();
  await assert.rejects(() => adapter.updateAgendaItem(created.id, { status: 'unknown' }), /status/i);
  assert.deepEqual(await adapter.listAgenda(), before);
});
```

Add a separate invalid-date assertion proving `createAgendaItem()` leaves list length unchanged.

- [ ] **Step 2: Add RED E2E**

```js
await page.locator('[data-nav="agenda"]').click();
await expect(page.getByRole('heading', { name: 'Agenda' })).toBeVisible();
await expect(page.locator('[data-planned-route="agenda"]')).toHaveCount(0);
await page.getByLabel('Paciente da agenda').selectOption({ label: 'Ana Martins' });
await page.getByLabel('Data e hora').fill('2026-09-23T09:00');
await page.getByRole('button', { name: 'Adicionar à agenda' }).click();
await expect(page.getByText(/Somente local/i)).toBeVisible();
```

Expected RED because Agenda is still placeholder.

- [ ] **Step 3: Implement `agenda.js`**

```js
const local = { items: [], patients: [], status: 'all', from: '', to: '', error: '' };

async function load() {
  [local.patients, local.items] = await Promise.all([
    gateway.listPatients(),
    gateway.listAgenda({ status: local.status, from: local.from || undefined, to: local.to || undefined })
  ]);
}
```

Render `scheduled/completed/cancelled` as `Agendado/Concluído/Cancelado`, always print `Somente local · não persistido`, and never infer clinical outcome from status.

- [ ] **Step 4: Replace Agenda placeholder in `app.js`**

Instantiate `agendaView`, route `agenda` to it, await `agendaView.load()` in `loadRoute()`, remove `agenda` from `PLANNED_ROUTES`.

- [ ] **Step 5: Wire linked patient/status actions**

Patient action calls existing async `openPatient(patientId)`. Status action awaits `gateway.updateAgendaItem(id, { status })`, reloads and rerenders.

- [ ] **Step 6: Add 390px layout and overflow test**

```js
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
expect(overflow).toBe(false);
```

- [ ] **Step 7: Run GREEN**

```bash
npm run check
npm run test:unit
npx playwright test test/e2e/agenda.spec.js test/e2e/ui-foundation.spec.js
```

- [ ] **Step 8: Commit**

```bash
git add src/app/public/features/agenda.js src/app/public/app.js src/app/public/features/planned-routes.js src/app/public/data/fixtures.js src/app/public/clinical.css test
git commit -m "feat: add backend-ready clinical agenda"
```

---

### Task 6: UI-8 Reports and persisted Audit through gateway

**Files:**
- Create: `src/app/public/data/operational-report.js`
- Modify: `src/app/public/data/clinical-data-gateway.js`
- Create: `src/app/public/features/reports.js`
- Create: `src/app/public/features/audit.js`
- Modify: `src/app/public/features/f0-views.js`
- Modify: `src/app/public/features/planned-routes.js`
- Modify: `src/app/public/app.js`
- Modify: `src/app/public/clinical.css`
- Create: `test/operational-report.test.js`
- Create: `test/e2e/reports.spec.js`
- Create: `test/e2e/audit-gateway.spec.js`

**Interfaces:**
- Consumes: existing gateway methods `listPatients()`, `listSessions()`, `listProtocols()`, `getAuditState()`.
- Produces: `deriveOperationalReport(...)`, gateway `getOperationalReport(filters)`, `createReportsView(...)`, `createAuditView(...)`.

- [ ] **Step 1: Write RED report tests**

Create `test/operational-report.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveOperationalReport } from '../src/app/public/data/operational-report.js';

const patients = [
  { id: 'p1', status: 'active', pendingItems: ['retorno'] },
  { id: 'p2', status: 'inactive', pendingItems: [] }
];
const sessions = [
  { createdAt: '2026-09-20T10:00:00Z', protocolTitle: 'Cervical', plannedParameters: { energyJ: 4 }, appliedParameters: { energyJ: 5 } },
  { createdAt: '2026-09-21T10:00:00Z', protocolTitle: 'Cervical', plannedParameters: { energyJ: 4 }, appliedParameters: { energyJ: 4 } }
];

test('derives descriptive operational metrics', () => {
  const report = deriveOperationalReport({ patients, sessions, protocols: [], filters: { from: '2026-09-20', to: '2026-09-21' } });
  assert.equal(report.sessionCount, 2);
  assert.equal(report.activePatientCount, 1);
  assert.equal(report.pendingFollowUpCount, 1);
  assert.equal(report.divergenceCount, 1);
  assert.deepEqual(report.protocolUsage, [{ protocol: 'Cervical', count: 2 }]);
});

test('rejects an inverted period', () => {
  assert.throws(
    () => deriveOperationalReport({ patients, sessions, protocols: [], filters: { from: '2026-09-22', to: '2026-09-20' } }),
    /Período inválido/
  );
});
```

Run and expect `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 2: Implement pure report derivation**

Return exactly:

```js
{
  period: { from: normalizedFromOrNull, to: normalizedToOrNull },
  sessionCount,
  activePatientCount,
  pendingFollowUpCount,
  divergenceCount,
  protocolUsage
}
```

Filter sessions by inclusive calendar dates; active patients/pending follow-ups come from current patient snapshot; divergence compares numeric planned/applied energy; protocol usage sorts count descending then protocol name ascending. No efficacy field.

- [ ] **Step 3: Extend gateway with optional report adapter and derived fallback**

Modify constructor:

```js
import { deriveOperationalReport } from './operational-report.js';

export function createClinicalDataGateway({ f0Adapter, localAdapter, reportAdapter = null }) {
  // existing validation
  return {
    // existing delegations
    async getOperationalReport(filters = {}) {
      if (reportAdapter?.getOperationalReport) return reportAdapter.getOperationalReport(filters);
      const [patients, sessions, protocols] = await Promise.all([
        localAdapter.listPatients(), f0Adapter.listSessions(), f0Adapter.listProtocols()
      ]);
      return deriveOperationalReport({ patients, sessions, protocols, filters });
    }
  };
}
```

Add gateway test proving an injected `reportAdapter.getOperationalReport()` is used when present, so a future persisted reports backend changes composition, not UI.

- [ ] **Step 4: Add RED Reports E2E and implement `reports.js`**

E2E asserts `reports` is no longer a planned route, renders session/active/pending/protocol/divergence metrics, and copy states the report is descriptive/non-recommendation. Controller:

```js
async function load() {
  local.error = '';
  try {
    local.report = await gateway.getOperationalReport({ from: local.from || undefined, to: local.to || undefined });
  } catch (error) {
    local.report = null;
    local.error = error.message;
  }
}
```

Inverted date range renders `Período inválido` inside the report card rather than breaking navigation.

- [ ] **Step 5: Extract persisted Audit to `audit.js`**

Export:

```js
export function filterAuditEvents(events, { action = 'all', entity = 'all', order = 'desc' } = {}) {
  const result = events.filter((event) =>
    (action === 'all' || event.action === action) &&
    (entity === 'all' || event.entityType === entity)
  );
  return result.sort((a, b) => order === 'asc'
    ? String(a.createdAt).localeCompare(String(b.createdAt))
    : String(b.createdAt).localeCompare(String(a.createdAt)));
}
```

`createAuditView({ gateway, onChanged, onMessage })` always loads with `gateway.getAuditState()`. Integrity badge derives only from persisted `audit.valid`.

- [ ] **Step 6: Add Audit E2E**

Create a real protocol through the Protocols UI, open Audit, assert `Cadeia íntegra`, filter `protocol.created`, and verify entity/hash remain visible. This proves the extracted view still reads the real chain.

- [ ] **Step 7: Replace Reports placeholder and inline Audit**

Instantiate `reportsView` and `auditView` in `app.js`; remove `reports` from `PLANNED_ROUTES`; remove inline `audit()` from `f0-views.js`.

- [ ] **Step 8: Run GREEN**

```bash
node --test test/operational-report.test.js test/data-gateway.test.js test/ui-contract.test.js
npx playwright test test/e2e/reports.spec.js test/e2e/audit-gateway.spec.js test/e2e/f0-regression.spec.js
npm run check
```

- [ ] **Step 9: Commit**

```bash
git add src/app/public/data src/app/public/features src/app/public/app.js src/app/public/clinical.css test
git commit -m "feat: add operational reports and gateway audit view"
```

---

### Task 7: Final backend-readiness hardening and documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/reuse-map.md` if the module inventory is listed there
- Modify: `test/ui-contract.test.js`
- Modify: `test/e2e/ui-foundation.spec.js`
- Modify: `src/app/public/clinical.css` only if final browser checks expose layout regressions

**Interfaces:**
- Consumes: completed Tasks 1-6.
- Produces: documented async adapter contract and a fully green branch ready for future persisted adapters.

- [ ] **Step 1: Harden structural contract tests**

Add:

```js
const adapterText = fs.readFileSync('src/app/public/data/adapters/f0-api-adapter.js', 'utf8');
assert.match(adapterText, /\/api\/protocols/);
assert.match(adapterText, /\/api\/sessions/);
assert.match(adapterText, /\/api\/audit/);

for (const feature of ['evolution.js', 'photos.js', 'agenda.js', 'reports.js', 'audit.js']) {
  const text = fs.readFileSync(path.join(frontendRoot, 'features', feature), 'utf8');
  assert.doesNotMatch(text, /\/api\//);
  assert.match(text, /gateway/);
}
assert.equal(fs.existsSync('src/app/public/data/mock-provider.js'), false);
```

- [ ] **Step 2: Add final desktop/mobile integration traversal**

Extend `ui-foundation.spec.js` to visit Dashboard, Patients, Agenda, Reports, Protocols, Equipment, Sessions and Audit at desktop and `390x844`. For each route:

```js
const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
expect(hasOverflow).toBe(false);
```

Patient workspace additionally opens Evolution and Photos.

- [ ] **Step 3: Document exact persistence matrix in README**

Add:

```markdown
| Capability | Current source | Future integration point |
| --- | --- | --- |
| Protocols / versions | Persisted F0 SQLite API | `F0ApiAdapter` |
| Equipment | Persisted F0 SQLite API | `F0ApiAdapter` |
| Sessions | Persisted F0 SQLite API | `F0ApiAdapter` |
| Audit | Persisted F0 SQLite API | `F0ApiAdapter` |
| Patients / intake | Local session memory | replace local capability adapter |
| Evolution | Local session memory | implement persisted evolution adapter |
| Photos | Local metadata + Data URL preview | implement metadata API + object-storage adapter |
| Agenda | Local session memory | implement persisted agenda adapter |
| Reports | Derived through gateway from available data | optional persisted reports adapter |
```

State that UI contracts are Promise-based and future adapters must preserve method names/signatures from `contracts.js`.

- [ ] **Step 4: Run complete CI-equivalent suite**

```bash
npm run check
npm run test:unit
npm run test:e2e
npm run smoke
```

Expected: all pass; smoke prints `F0 OK: 19 tabelas carregadas.`; no test is skipped to obtain green.

- [ ] **Step 5: Inspect final diff for source-truth and clinical-boundary mistakes**

```bash
git diff main...HEAD -- src/app/public README.md test
```

Verify: no local record labeled persisted; no feature `/api/`; no local fallback for failed F0 writes; no efficacy/diagnosis/recommendation wording; every destructive photo removal requires confirmation.

- [ ] **Step 6: Commit final hardening/docs**

```bash
git add README.md docs/reuse-map.md src/app/public test
git commit -m "docs: finalize backend-ready frontend architecture"
```

- [ ] **Step 7: Re-run exact final SHA verification**

```bash
npm run check && npm run test:unit && npm run test:e2e && npm run smoke
```

Record final SHA and CI run ID before integration.

---

## Self-Review Result

- **Spec coverage:** Gateway/adapters, UI-7 Evolution/Photos, UI-8 Agenda/Reports/Audit, source semantics, errors, accessibility/mobile, docs and regressions all map to explicit tasks.
- **Placeholder scan:** No deferred implementation file, `TBD`, `TODO`, or unnamed validation/error-handling step remains.
- **Type/signature consistency:** Task 1 creates only adapter delegation; Task 6 creates `operational-report.js` and only then extends gateway with `getOperationalReport()`. All data methods remain Promise-based from UI perspective.
- **Review Focus coverage:** partial adapter (Task 1), persisted write failure (Task 2), invalid/oversized photo (Task 4), invalid agenda status/date (Task 5), inverted report period (Task 6) each has explicit tests.
