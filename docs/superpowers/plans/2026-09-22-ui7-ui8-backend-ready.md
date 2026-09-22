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
    contracts.js                    # capability names, source constants, contract guards
    clinical-data-gateway.js        # single feature-facing data boundary
    operational-report.js           # pure deterministic report derivation
    fixtures.js                     # deterministic UI-7/UI-8 seed data
    adapters/
      f0-api-adapter.js              # only frontend file allowed to know /api/... endpoints
      local-clinical-adapter.js      # async session-memory patient/intake/evolution/photos/agenda
  features/
    dashboard.js                    # migrate to async gateway load/cache
    patients.js                     # migrate to async gateway load/cache
    clinical-intake.js              # gateway-backed local async operations
    patient-workspace.js            # orchestrates patient + UI-7 tabs
    evolution.js                    # UI-7 evolution controller/view
    photos.js                       # UI-7 photo metadata + local preview controller/view
    agenda.js                       # UI-8 agenda controller/view
    reports.js                      # UI-8 operational report controller/view
    audit.js                        # UI-8 filtered persisted audit presentation
    f0-views.js                     # gateway-backed protocol/equipment/session controllers
    planned-routes.js               # settings only after agenda/reports extraction
  app.js                            # composition/navigation only
  clinical.css                     # UI-7/UI-8 responsive styles

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

### Task 1: Data contracts, adapters and `ClinicalDataGateway`

**Files:**
- Modify: `src/app/public/data/contracts.js`
- Create: `src/app/public/data/adapters/f0-api-adapter.js`
- Create: `src/app/public/data/adapters/local-clinical-adapter.js`
- Create: `src/app/public/data/clinical-data-gateway.js`
- Modify: `src/app/public/data/fixtures.js`
- Create: `test/data-gateway.test.js`
- Create: `test/local-clinical-adapter.test.js`

**Interfaces:**
- Consumes: existing F0 JSON shapes from `/api/status`, `/api/patients`, `/api/equipment`, `/api/protocols`, `/api/sessions`, `/api/audit`; existing `UI_FIXTURES` patient/intake shapes.
- Produces: `createF0ApiAdapter({ request })`, `createLocalClinicalAdapter(seed)`, `createClinicalDataGateway({ f0Adapter, localAdapter, reportAdapter? })`. All public gateway operations return Promises, including local operations, so a future network-backed adapter can replace local storage without changing UI call sites.

- [ ] **Step 1: Write contract tests for adapter validation and source semantics**

Create `test/data-gateway.test.js` with concrete assertions:

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

- [ ] **Step 2: Run the new tests to verify RED**

Run:

```bash
node --test test/data-gateway.test.js
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `clinical-data-gateway.js`.

- [ ] **Step 3: Expand `contracts.js` with exact capability registries and guards**

Use this public shape:

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

Keep `cloneUiData()` unchanged because adapters use defensive copies.

- [ ] **Step 4: Implement `F0ApiAdapter` as the only `/api/...` owner**

`src/app/public/data/adapters/f0-api-adapter.js` must define one request helper and map responses explicitly:

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
      return json(`/api/protocols/${encodeURIComponent(protocolId)}/versions`, { method: 'POST', body: JSON.stringify(input) });
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

If the current F0 create-session response shape differs, normalize it in this adapter only and pin the exact shape in the adapter test before changing feature code.

- [ ] **Step 5: Implement async `LocalClinicalAdapter` with deterministic IDs and validation**

Move the existing mock patient/intake state logic into `src/app/public/data/adapters/local-clinical-adapter.js`; add arrays `evolution`, `photos`, and `agenda` to each seed or adapter state. Required validation behavior:

```js
const AGENDA_STATUSES = new Set(['scheduled', 'completed', 'cancelled']);

function required(value, message) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(message);
  return result;
}

function agendaDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new TypeError('Data/hora da agenda é inválida.');
  return parsed.toISOString();
}
```

Every returned patient/evolution/photo/agenda record must include `source: 'local'`. `updateAgendaItem()` must validate the patch before mutating the stored object.

- [ ] **Step 6: Add local-adapter tests for no-mutation-on-error**

Create `test/local-clinical-adapter.test.js` with at least these tests:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalClinicalAdapter } from '../src/app/public/data/adapters/local-clinical-adapter.js';

const seed = { dashboard: {}, patients: [{ id: 'p1', fullName: 'Ana', status: 'active', timeline: [], clinicalIntake: { anamnesis: {}, consent: {}, safetyChecklist: {} } }] };

test('evolution rejects blank title without mutating patient evolution', async () => {
  const adapter = createLocalClinicalAdapter(seed);
  await assert.rejects(() => adapter.addEvolution('p1', { title: '   ', date: '2026-09-22' }), /título/i);
  assert.deepEqual(await adapter.listEvolution('p1'), []);
});

test('agenda rejects unknown status without mutating state', async () => {
  const adapter = createLocalClinicalAdapter(seed);
  await assert.rejects(() => adapter.createAgendaItem({ patientId: 'p1', startsAt: '2026-09-23T09:00:00-03:00', status: 'done-ish' }), /status/i);
  assert.deepEqual(await adapter.listAgenda(), []);
});
```

- [ ] **Step 7: Implement `ClinicalDataGateway` delegation and mixed report hook**

Use exact constructor validation and delegation:

```js
import { assertAdapterCapabilities, F0_ADAPTER_METHODS, LOCAL_ADAPTER_METHODS } from './contracts.js';
import { deriveOperationalReport } from './operational-report.js';

export function createClinicalDataGateway({ f0Adapter, localAdapter, reportAdapter = null }) {
  assertAdapterCapabilities('f0Adapter', f0Adapter, F0_ADAPTER_METHODS);
  assertAdapterCapabilities('localAdapter', localAdapter, LOCAL_ADAPTER_METHODS);

  return {
    ...Object.fromEntries(LOCAL_ADAPTER_METHODS.map((name) => [name, (...args) => localAdapter[name](...args)])),
    ...Object.fromEntries(F0_ADAPTER_METHODS.map((name) => [name, (...args) => f0Adapter[name](...args)])),
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

Task 6 creates `operational-report.js`; until then export a minimal `deriveOperationalReport()` from a temporary file with the stable return shape `{ period, sessionCount, activePatientCount, pendingFollowUpCount, protocolUsage, divergenceCount }`, then replace its internal logic in Task 6. Do not put placeholder text or fake metrics in production UI during Task 1.

- [ ] **Step 8: Run Task 1 tests and the full unit suite**

Run:

```bash
node --test test/data-gateway.test.js test/local-clinical-adapter.test.js
npm run test:unit
npm run check
```

Expected: all pass; syntax check reports all JS valid.

- [ ] **Step 9: Commit Task 1**

```bash
git add src/app/public/data test/data-gateway.test.js test/local-clinical-adapter.test.js
git commit -m "feat: add clinical data gateway and adapters"
```

---

### Task 2: Migrate existing UI-0 through UI-6 to gateway-only data access

**Files:**
- Modify: `src/app/public/app.js`
- Modify: `src/app/public/features/dashboard.js`
- Modify: `src/app/public/features/patients.js`
- Modify: `src/app/public/features/clinical-intake.js`
- Modify: `src/app/public/features/patient-workspace.js`
- Modify: `src/app/public/features/f0-views.js`
- Delete after migration: `src/app/public/data/mock-provider.js`
- Modify: `test/ui-contract.test.js`
- Modify: `test/e2e/f0-regression.spec.js`
- Modify: `test/e2e/patients.spec.js`
- Modify: `test/e2e/patient-workspace.spec.js`

**Interfaces:**
- Consumes: Task 1 `createClinicalDataGateway()`, `createF0ApiAdapter()`, `createLocalClinicalAdapter()`.
- Produces: feature controllers whose data operations are async gateway calls; `app.js` only constructs dependencies, navigates, refreshes and renders.

- [ ] **Step 1: Add a structural test forbidding direct `/api/` calls outside the adapter**

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

test('only F0ApiAdapter knows frontend /api/ endpoints', () => {
  const offenders = jsFiles(frontendRoot)
    .filter((file) => file !== allowed)
    .filter((file) => fs.readFileSync(file, 'utf8').includes("'/api/"));
  assert.deepEqual(offenders, []);
});
```

- [ ] **Step 2: Run structural test to verify RED**

Run:

```bash
node --test test/ui-contract.test.js
```

Expected: FAIL listing `src/app/public/app.js` as an offender.

- [ ] **Step 3: Compose adapters and gateway in `app.js`**

Replace the generic `api()` function and mock provider construction with:

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

Make `refreshAll()` populate only application-wide persisted snapshots through gateway methods:

```js
async function refreshAll() {
  const [status, equipment, protocols, sessions, audit] = await Promise.all([
    gateway.getFoundationStatus(), gateway.listEquipment(), gateway.listProtocols(),
    gateway.listSessions(), gateway.getAuditState()
  ]);
  Object.assign(state, { status, equipment, protocols, sessions, audit });
}
```

No raw HTTP path remains in `app.js`.

- [ ] **Step 4: Make local feature controllers async-load their gateway data**

Use the same controller pattern for Dashboard, Patients and Patient Workspace:

```js
export function createPatientsView({ gateway, onOpenPatient, onChanged, onMessage }) {
  const local = { patients: [], query: '', status: 'all', dialogOpen: false, error: '' };

  async function load() {
    local.patients = await gateway.listPatients();
  }

  function render() {
    const allPatients = local.patients;
    // existing filtering/rendering stays synchronous
  }

  async function savePatient(input) {
    const created = await gateway.createPatient(input);
    await load();
    onMessage?.(`Paciente ${created.fullName} adicionado somente ao ambiente local.`, 'success');
    onChanged?.();
  }

  return { load, render, bindActions };
}
```

Update event listeners that perform writes to `async` and catch errors into `onMessage` without mutating local UI as a fallback.

`patientWorkspaceView.setPatient(patientId)` becomes async and loads the patient through `gateway.getPatient(patientId)`. `clinical-intake.js` receives `gateway` and awaits `getClinicalIntake`/update methods.

- [ ] **Step 5: Move F0 writes in `f0-views.js` to gateway methods**

Replace direct `api()` calls:

```js
await gateway.createProtocol({ title, changeSummary });
await gateway.createProtocolVersion(state.selectedProtocolId, { changeSummary });
await gateway.createSession({ protocolVersionId, plannedEnergyJ, appliedEnergyJ, professionalAdjustmentReason });
```

Keep the existing client-side professional-reason guard and the backend invariant; the UI guard improves feedback but does not replace server validation.

- [ ] **Step 6: Add persisted-write failure regression**

In `test/data-gateway.test.js`:

```js
test('persisted write failure propagates and never calls local fallback', async () => {
  let localWrites = 0;
  const gateway = createClinicalDataGateway({
    f0Adapter: fakeF0({ createSession: async () => { throw new Error('backend unavailable'); } }),
    localAdapter: fakeLocal({ createAgendaItem: async () => { localWrites += 1; } })
  });
  await assert.rejects(() => gateway.createSession({ plannedEnergyJ: 4 }), /backend unavailable/);
  assert.equal(localWrites, 0);
});
```

- [ ] **Step 7: Update browser setup to await feature loads before render**

`navigate()` must load only the selected feature before rendering. Use an explicit dispatcher rather than hidden promises:

```js
async function loadRoute(route) {
  if (route === 'dashboard') await dashboardView.load();
  if (route === 'patients') await patientsView.load();
}

async function navigate(route) {
  // existing route guard
  state.currentView = route;
  await refreshAll();
  await loadRoute(route);
  render();
}
```

`openPatient()` becomes async, awaits `patientWorkspaceView.setPatient(patientId)`, then renders.

- [ ] **Step 8: Remove `mock-provider.js` and update imports/tests**

After no production import remains, delete `src/app/public/data/mock-provider.js`. Preserve deterministic fixture behavior in `LocalClinicalAdapter` tests rather than leaving a second local data model.

- [ ] **Step 9: Run regression suite**

Run:

```bash
npm run check
npm run test:unit
npx playwright test test/e2e/patients.spec.js test/e2e/patient-workspace.spec.js test/e2e/f0-regression.spec.js test/e2e/ui-foundation.spec.js
npm run smoke
```

Expected: all existing behaviors pass through the new gateway boundary.

- [ ] **Step 10: Commit Task 2**

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
- Create: `test/e2e/evolution.spec.js`
- Modify: `test/local-clinical-adapter.test.js`

**Interfaces:**
- Consumes: `gateway.listEvolution(patientId, filters?)`, `gateway.addEvolution(patientId, input)`.
- Produces: `createEvolutionView({ gateway, patientId, onChanged, onMessage })` with `load()`, `render()`, `bindActions()`.

- [ ] **Step 1: Extend local adapter unit tests for evolution filtering and source metadata**

Add:

```js
test('evolution filters by category and date and marks entries local', async () => {
  const adapter = createLocalClinicalAdapter(seed);
  await adapter.addEvolution('p1', { date: '2026-09-20', category: 'session', title: 'Sessão 1', notes: 'Sem intercorrência' });
  await adapter.addEvolution('p1', { date: '2026-09-22', category: 'assessment', title: 'Reavaliação', notes: 'Registro descritivo' });
  const result = await adapter.listEvolution('p1', { category: 'assessment', from: '2026-09-21', to: '2026-09-23' });
  assert.equal(result.length, 1);
  assert.equal(result[0].title, 'Reavaliação');
  assert.equal(result[0].source, 'local');
});
```

- [ ] **Step 2: Add RED Playwright scenarios**

`test/e2e/evolution.spec.js` must open Ana Martins, select `Evolução`, create a local record, assert visible source text, filter by category and cover an empty filter:

```js
test('adds and filters a local evolution record without claiming persistence', async ({ page }) => {
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
  await expect(page.getByText(/Somente local|Não persistido/i)).toBeVisible();
  await page.getByLabel('Filtrar categoria').selectOption('session');
  await expect(page.getByText('Reavaliação funcional E2E')).toBeHidden();
});
```

- [ ] **Step 3: Run RED tests**

Run:

```bash
node --test test/local-clinical-adapter.test.js
npx playwright test test/e2e/evolution.spec.js
```

Expected: unit test fails until filter behavior exists or E2E fails because Evolution form is absent.

- [ ] **Step 4: Implement `evolution.js` controller/view**

Use local cached records and explicit filters:

```js
export function createEvolutionView({ gateway, patientId, onChanged, onMessage }) {
  const local = { records: [], category: 'all', from: '', to: '' };

  async function load() {
    local.records = await gateway.listEvolution(patientId, {
      category: local.category, from: local.from || undefined, to: local.to || undefined
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

Render category options `assessment`, `session`, `follow-up`, `note`; display `source === 'local' ? 'Somente local · não persistido' : 'Persistido'` beside every entry. Do not render effectiveness or diagnosis fields.

- [ ] **Step 5: Wire Evolution into Patient Workspace**

On `setPatient()`, create the evolution controller; when selecting the tab, await `evolutionView.load()` before rerendering. Existing patient summary timeline stays read-only and separate.

- [ ] **Step 6: Add responsive styles**

In `clinical.css`, use a two-column form/list layout above 760px and one column below it. The timeline metadata must wrap, and source badges must remain text-readable.

- [ ] **Step 7: Run GREEN tests and existing workspace tests**

Run:

```bash
node --test test/local-clinical-adapter.test.js
npx playwright test test/e2e/evolution.spec.js test/e2e/patient-workspace.spec.js
```

Expected: all pass.

- [ ] **Step 8: Commit Task 3**

```bash
git add src/app/public/features/evolution.js src/app/public/features/patient-workspace.js src/app/public/data/fixtures.js src/app/public/clinical.css test
git commit -m "feat: add local evolution workflow"
```

---

### Task 4: UI-7 Photos metadata and local preview workflow

**Files:**
- Create: `src/app/public/features/photos.js`
- Modify: `src/app/public/features/patient-workspace.js`
- Modify: `src/app/public/clinical.css`
- Modify: `test/local-clinical-adapter.test.js`
- Create: `test/e2e/photos.spec.js`

**Interfaces:**
- Consumes: `gateway.listPhotos(patientId)`, `gateway.addPhotoMetadata(patientId, input)`, `gateway.removePhotoMetadata(patientId, photoId)`.
- Produces: `createPhotosView({ gateway, patientId, onChanged, onMessage, confirmRemoval? })`.

- [ ] **Step 1: Add adapter tests for add/remove photo metadata**

```js
test('photo metadata is local, copied defensively and removable', async () => {
  const adapter = createLocalClinicalAdapter(seed);
  const created = await adapter.addPhotoMetadata('p1', {
    capturedDate: '2026-09-22', region: 'ombro direito', observation: 'Vista anterior', previewDataUrl: 'data:image/png;base64,AA=='
  });
  assert.equal(created.source, 'local');
  assert.equal((await adapter.listPhotos('p1')).length, 1);
  assert.equal(await adapter.removePhotoMetadata('p1', created.id), true);
  assert.deepEqual(await adapter.listPhotos('p1'), []);
});
```

- [ ] **Step 2: Add pure file validation in `photos.js` and unit-test through exports**

Export constants and helper:

```js
export const MAX_LOCAL_PHOTO_BYTES = 5 * 1024 * 1024;

export function validateLocalPhotoFile(file) {
  if (!file || !String(file.type).startsWith('image/')) throw new TypeError('Selecione um arquivo de imagem.');
  if (file.size > MAX_LOCAL_PHOTO_BYTES) throw new TypeError('A imagem local deve ter no máximo 5 MiB.');
  return file;
}
```

Add unit assertions for `{ type: 'text/plain', size: 10 }` and `{ type: 'image/png', size: MAX_LOCAL_PHOTO_BYTES + 1 }`.

- [ ] **Step 3: Add RED E2E for add/preview/source/removal confirmation**

Use Playwright `setInputFiles` with a tiny PNG buffer:

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

- [ ] **Step 4: Run RED**

Run:

```bash
node --test test/local-clinical-adapter.test.js test/ui-helpers.test.js
npx playwright test test/e2e/photos.spec.js
```

Expected: E2E fails because Photos is still an empty state.

- [ ] **Step 5: Implement local preview reading and metadata controller**

Use `FileReader` only in the browser feature:

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

Persist only the Data URL and metadata in the local adapter session state. The UI copy must say `Pré-visualização local · não enviada ao backend`.

- [ ] **Step 6: Wire Photos tab and removal confirmation**

`patient-workspace.js` creates `photosView` on patient selection; selection of the Photos tab awaits `load()`. Use `window.confirm('Remover esta foto do estado local?')` by default, injectable in unit tests.

- [ ] **Step 7: Add mobile photo-grid styles**

Grid: `repeat(auto-fit, minmax(220px, 1fr))`; image uses `aspect-ratio: 4 / 3; object-fit: cover`; action buttons wrap at 390px.

- [ ] **Step 8: Run GREEN and regression**

Run:

```bash
npm run check
npm run test:unit
npx playwright test test/e2e/photos.spec.js test/e2e/evolution.spec.js test/e2e/patient-workspace.spec.js
```

Expected: all pass.

- [ ] **Step 9: Commit Task 4**

```bash
git add src/app/public/features/photos.js src/app/public/features/patient-workspace.js src/app/public/clinical.css test
git commit -m "feat: add local clinical photo workspace"
```

---

### Task 5: UI-8 Agenda operational workflow

**Files:**
- Create: `src/app/public/features/agenda.js`
- Modify: `src/app/public/app.js`
- Modify: `src/app/public/features/planned-routes.js`
- Modify: `src/app/public/clinical.css`
- Modify: `src/app/public/data/fixtures.js`
- Modify: `test/local-clinical-adapter.test.js`
- Create: `test/e2e/agenda.spec.js`

**Interfaces:**
- Consumes: `gateway.listAgenda(filters?)`, `gateway.createAgendaItem(input)`, `gateway.updateAgendaItem(id, patch)`, `gateway.listPatients()`.
- Produces: `createAgendaView({ gateway, onOpenPatient, onChanged, onMessage })` with `load()`, `render()`, `bindActions()`.

- [ ] **Step 1: Pin agenda validation and filter behavior in unit tests**

Add tests that create valid `scheduled` items, filter by status, update to `completed`, and prove invalid date/status do not mutate:

```js
test('agenda validates before mutation and supports status updates', async () => {
  const adapter = createLocalClinicalAdapter(seed);
  const created = await adapter.createAgendaItem({ patientId: 'p1', startsAt: '2026-09-23T09:00:00-03:00', status: 'scheduled', note: 'Retorno' });
  assert.equal(created.source, 'local');
  assert.equal((await adapter.listAgenda({ status: 'scheduled' })).length, 1);
  const updated = await adapter.updateAgendaItem(created.id, { status: 'completed' });
  assert.equal(updated.status, 'completed');
  const before = await adapter.listAgenda();
  await assert.rejects(() => adapter.updateAgendaItem(created.id, { status: 'unknown' }), /status/i);
  assert.deepEqual(await adapter.listAgenda(), before);
});
```

- [ ] **Step 2: Add RED Agenda E2E**

Test the real route is no longer `data-planned-route="agenda"`, create an item for Ana, filter scheduled, update completed, then open the linked patient:

```js
await page.locator('[data-nav="agenda"]').click();
await expect(page.getByRole('heading', { name: 'Agenda' })).toBeVisible();
await expect(page.locator('[data-planned-route="agenda"]')).toHaveCount(0);
await page.getByLabel('Paciente da agenda').selectOption({ label: 'Ana Martins' });
await page.getByLabel('Data e hora').fill('2026-09-23T09:00');
await page.getByRole('button', { name: 'Adicionar à agenda' }).click();
await expect(page.getByText(/Somente local/i)).toBeVisible();
```

- [ ] **Step 3: Run RED tests**

```bash
node --test test/local-clinical-adapter.test.js
npx playwright test test/e2e/agenda.spec.js
```

Expected: E2E fails because Agenda is still a planned placeholder.

- [ ] **Step 4: Implement `agenda.js` with cached patients/items**

Controller state:

```js
const local = { items: [], patients: [], status: 'all', from: '', to: '', dialogOpen: false, error: '' };

async function load() {
  [local.patients, local.items] = await Promise.all([
    gateway.listPatients(),
    gateway.listAgenda({ status: local.status, from: local.from || undefined, to: local.to || undefined })
  ]);
}
```

Display `Agendado`, `Concluído`, `Cancelado`, local source text and linked patient action. No scheduling status copy may imply clinical outcome.

- [ ] **Step 5: Replace Agenda route composition in `app.js`**

Instantiate `agendaView` and route `agenda` to `agendaView.render`. `navigate('agenda')` awaits `agendaView.load()`. Remove Agenda from `PLANNED_ROUTES`; keep Settings there.

- [ ] **Step 6: Wire linked patient navigation and async status writes**

`data-open-agenda-patient` calls existing async `openPatient(patientId)`. Status buttons call `await gateway.updateAgendaItem(id, { status })`, reload and rerender.

- [ ] **Step 7: Add 390px agenda layout and overflow E2E**

At 390px, toolbar and agenda rows become stacked cards; E2E asserts:

```js
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
expect(overflow).toBe(false);
```

- [ ] **Step 8: Run GREEN**

```bash
npm run check
npm run test:unit
npx playwright test test/e2e/agenda.spec.js test/e2e/ui-foundation.spec.js
```

Expected: all pass.

- [ ] **Step 9: Commit Task 5**

```bash
git add src/app/public/features/agenda.js src/app/public/app.js src/app/public/features/planned-routes.js src/app/public/data/fixtures.js src/app/public/clinical.css test
git commit -m "feat: add backend-ready clinical agenda"
```

---

### Task 6: UI-8 Reports and filtered persisted Audit

**Files:**
- Create: `src/app/public/data/operational-report.js`
- Create: `src/app/public/features/reports.js`
- Create: `src/app/public/features/audit.js`
- Modify: `src/app/public/data/clinical-data-gateway.js`
- Modify: `src/app/public/features/f0-views.js`
- Modify: `src/app/public/features/planned-routes.js`
- Modify: `src/app/public/app.js`
- Modify: `src/app/public/clinical.css`
- Create: `test/operational-report.test.js`
- Create: `test/e2e/reports.spec.js`
- Create: `test/e2e/audit-gateway.spec.js`

**Interfaces:**
- Consumes: gateway `getOperationalReport(filters)`, `getAuditState()`.
- Produces: `deriveOperationalReport({ patients, sessions, protocols, filters })`, `createReportsView(...)`, `createAuditView(...)`.

- [ ] **Step 1: Write deterministic report tests including invalid period**

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

test('derives descriptive operational metrics for a valid period', () => {
  const report = deriveOperationalReport({ patients, sessions, protocols: [], filters: { from: '2026-09-20', to: '2026-09-21' } });
  assert.equal(report.sessionCount, 2);
  assert.equal(report.activePatientCount, 1);
  assert.equal(report.pendingFollowUpCount, 1);
  assert.equal(report.divergenceCount, 1);
  assert.deepEqual(report.protocolUsage, [{ protocol: 'Cervical', count: 2 }]);
});

test('rejects an inverted report period', () => {
  assert.throws(
    () => deriveOperationalReport({ patients, sessions, protocols: [], filters: { from: '2026-09-22', to: '2026-09-20' } }),
    /Período inválido/
  );
});
```

- [ ] **Step 2: Run report unit tests RED**

```bash
node --test test/operational-report.test.js
```

Expected: FAIL until the pure derivation exists.

- [ ] **Step 3: Implement pure report derivation**

Normalize dates to start/end-of-day boundaries, filter sessions only, count active patients/pending items from current patient snapshot, count divergences by comparing numeric planned/applied energy, and sort protocol usage by count descending then protocol name ascending. Return:

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

No efficacy field is allowed.

- [ ] **Step 4: Add RED E2E for Reports**

`reports.spec.js` asserts Reports no longer uses planned placeholder, renders the five operational sections, changing period updates the session count, and the copy includes `descritivo` or `não é recomendação clínica`.

- [ ] **Step 5: Implement `reports.js` controller**

Use:

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

Render validation error inside the report surface rather than allowing it to escape to application initialization.

- [ ] **Step 6: Extract audit presentation into `audit.js` and add filters**

`createAuditView({ gateway, onChanged, onMessage })` stores `{ audit, action: 'all', entity: 'all', order: 'desc' }`. `load()` always calls `await gateway.getAuditState()`; render uses only those persisted events. Filter helper is pure and exported for unit testing:

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

The integrity badge continues to derive only from `audit.valid`; never from a local adapter.

- [ ] **Step 7: Add Audit gateway E2E**

Create `audit-gateway.spec.js`: create a real protocol through the Protocols UI, open Audit, assert `Cadeia íntegra`, find `protocol.created`, apply action filter, and verify the hash text remains visible for the matching event.

- [ ] **Step 8: Remove Reports placeholder and old inline audit renderer**

Instantiate `reportsView` and `auditView` in `app.js`. Remove `reports` from `PLANNED_ROUTES`. Remove `audit()` from `f0-views.js`; keep only protocols/equipment/sessions there.

- [ ] **Step 9: Run Task 6 GREEN**

```bash
node --test test/operational-report.test.js test/ui-contract.test.js
npx playwright test test/e2e/reports.spec.js test/e2e/audit-gateway.spec.js test/e2e/f0-regression.spec.js
npm run check
```

Expected: all pass.

- [ ] **Step 10: Commit Task 6**

```bash
git add src/app/public/data src/app/public/features src/app/public/app.js src/app/public/clinical.css test
git commit -m "feat: add operational reports and gateway audit view"
```

---

### Task 7: Final backend-readiness hardening, docs and complete verification

**Files:**
- Modify: `README.md`
- Modify: `docs/reuse-map.md` if current module inventory needs updating
- Modify: `test/ui-contract.test.js`
- Modify: `test/e2e/ui-foundation.spec.js`
- Modify: `src/app/public/clinical.css` only if final browser checks expose layout regressions

**Interfaces:**
- Consumes: completed gateway/adapters and UI-7/UI-8 modules.
- Produces: documented backend integration contract and a fully green branch suitable for future persisted-adapter work.

- [ ] **Step 1: Expand structural contract tests for backend readiness**

Add assertions that:

```js
const adapterText = fs.readFileSync('src/app/public/data/adapters/f0-api-adapter.js', 'utf8');
assert.match(adapterText, /\/api\/protocols/);
assert.match(adapterText, /\/api\/sessions/);
assert.match(adapterText, /\/api\/audit/);

for (const feature of [
  'features/evolution.js', 'features/photos.js', 'features/agenda.js',
  'features/reports.js', 'features/audit.js'
]) {
  const text = fs.readFileSync(path.join(frontendRoot, feature), 'utf8');
  assert.doesNotMatch(text, /\/api\//);
  assert.match(text, /gateway/);
}
```

Also assert `mock-provider.js` no longer exists.

- [ ] **Step 2: Add final desktop/mobile integration checks**

Extend `ui-foundation.spec.js` to visit Dashboard, Patients, Agenda, Reports, Protocols, Equipment, Sessions and Audit at desktop and at `390x844`, asserting `documentElement.scrollWidth <= clientWidth` on each route. Patient workspace additionally visits Evolution and Photos tabs.

- [ ] **Step 3: Update README with exact persistence matrix**

Document a table with these rows:

```markdown
| Capability | Current source | Future integration point |
| --- | --- | --- |
| Protocols / versions | Persisted F0 SQLite API | `F0ApiAdapter` |
| Equipment | Persisted F0 SQLite API | `F0ApiAdapter` |
| Sessions | Persisted F0 SQLite API | `F0ApiAdapter` |
| Audit | Persisted F0 SQLite API | `F0ApiAdapter` |
| Patients / intake | Local session memory | replace local capability adapter |
| Evolution | Local session memory | implement persisted evolution adapter |
| Photos | Local metadata + Data URL preview | implement metadata API + object storage adapter |
| Agenda | Local session memory | implement persisted agenda adapter |
| Reports | Derived through gateway from available data | optional persisted reports adapter |
```

Explain that UI contracts are async and adapter substitution must preserve the method signatures in `contracts.js`.

- [ ] **Step 4: Run the complete verification suite from a fresh branch head**

Run exactly:

```bash
npm run check
npm run test:unit
npm run test:e2e
npm run smoke
```

Expected:
- syntax check passes;
- every unit/domain/contract test passes;
- every Playwright test passes;
- smoke prints `F0 OK: 19 tabelas carregadas.`;
- no test is skipped to obtain green.

- [ ] **Step 5: Inspect final diff for source-truth mistakes**

Run:

```bash
git diff main...HEAD -- src/app/public README.md test
```

Check specifically that:
- `local` records are never labeled persisted;
- no feature contains `/api/`;
- no local write is used as fallback for a failed F0 write;
- no efficacy/diagnosis/recommendation wording was introduced;
- all destructive photo removal paths require confirmation.

- [ ] **Step 6: Commit final docs/hardening**

```bash
git add README.md docs/reuse-map.md src/app/public test
git commit -m "docs: finalize backend-ready frontend architecture"
```

- [ ] **Step 7: Re-run complete CI-equivalent suite on the exact final SHA**

```bash
npm run check && npm run test:unit && npm run test:e2e && npm run smoke
```

Expected: all green on the final commit SHA. Record the SHA and CI run ID before any integration decision.

---

## Self-Review Result

- **Spec coverage:** Gateway/adapters, UI-7 Evolution/Photos, UI-8 Agenda/Reports/Audit, local/persisted source semantics, error handling, accessibility/mobile, documentation and full regression coverage each map to a concrete task above.
- **Placeholder scan:** No `TBD`, `TODO`, deferred implementation step, or unnamed error-handling instruction remains in the plan.
- **Type/signature consistency:** All feature-facing data methods are Promise-returning through `ClinicalDataGateway`; local and F0 adapters expose the names registered in `contracts.js`; report derivation returns one stable metric shape consumed by Reports.
- **Review Focus coverage:** missing adapter capability (Task 1), persisted write failure (Task 2), invalid/oversized photo (Task 4), invalid agenda status/date (Task 5), and inverted report period (Task 6) each have an explicit test.
