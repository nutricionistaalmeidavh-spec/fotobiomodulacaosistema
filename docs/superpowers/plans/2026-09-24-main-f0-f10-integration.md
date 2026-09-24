# Main + F0–F10 Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the complete F0–F10 clinical/operational backend into the current `main` UI without replacing the UI architecture, while making every clinically relevant screen persistent, role-aware, testable, and free of phase-specific duplicate interfaces.

**Architecture:** `main` remains the visual and navigation authority: feature modules, `ClinicalDataGateway`, existing CSS, patient workspace, and route structure are preserved. `feat/f8-f10-clinical-ops-rbac` remains the behavioral/domain authority: migrations, clinical services, auth/RBAC, HTTP routes, evidence/body-map/operations/admin rules, and their unit/HTTP invariants are ported into a new integration branch based on `main`. Phase UIs (`f2-ui.js` through `f10-ui.js`) are not merged; their behaviors are re-exposed through API adapters and the existing `main` feature modules.

**Tech Stack:** Node.js 22+, `node:sqlite`, vanilla ES modules, local HTTP API, Playwright Chromium, `node:test`.

**Specs:**
- `docs/superpowers/specs/2026-09-22-ui7-ui8-backend-ready-design.md`
- `docs/superpowers/specs/2026-09-22-f1-clinical-workspace-design.md`
- `docs/superpowers/specs/2026-09-22-f3-f5-design.md`
- `docs/superpowers/specs/2026-09-23-f6-f7-evidence-bodymap-design.md`
- `docs/superpowers/specs/2026-09-23-f8-advanced-clinical-engine-design.md`
- `docs/superpowers/specs/2026-09-23-f9-clinical-operations-design.md`
- `docs/superpowers/specs/2026-09-23-f10-multiprofessional-rbac-robustness-design.md`

## Global Constraints

- Start implementation from `main`; do not merge the clinical branch wholesale.
- Treat the current `main` UI structure as canonical. Do not replace it with the phase UI shell from `feat/f8-f10-clinical-ops-rbac`.
- Do not import `src/app/public/f2-ui.js`, `f3-ui.js`, `f4-ui.js`, `f5-ui.js`, `f6-ui.js`, `f7-ui.js`, `f8-ui.js`, `f9-ui.js`, `f10-ui.js`, or the clinical branch `index.html` as runtime UI.
- Port migrations `0002_f1.sql` through `0010_f10.sql` without rewriting `0001_f0.sql`.
- Clinical and operational runtime data must come from the SQLite/API path; `localStorage`, `sessionStorage`, and the `local-clinical-adapter` must not be the source of truth.
- The core remains R$0, self-hosted, local-first, and without mandatory paid APIs.
- F11/AI/RAG remains removed. The integrated roadmap ends at F10.
- No automatic prescription, automatic dose recommendation, efficacy ranking, or silent protocol mutation.
- Protocol versions remain immutable; planned and applied session parameters remain separate snapshots.
- Server-side RBAC is authoritative. UI visibility is convenience, not security.
- Patient deletion remains non-destructive/archival.
- Audit history and consent history remain append-only where defined by the phase specs.
- Backups use a consistent SQLite snapshot plus integrity verification; media retention never auto-deletes clinical assets.

## Review Focus

1. **Existing F0 database upgrade:** opening a database that only has `0001_f0` must apply `0002`–`0010` once, preserve all F0 data, and remain reopenable.
2. **Role bootstrap:** `admin`, `professional`, and `reception` must each load a usable UI without unauthorized requests breaking startup; 401 must return to login and 403 must not expose restricted content.
3. **Persistence after reload:** patient/anamnesis/consent/evolution/photo/agenda/finance changes must survive a browser reload and a server restart against the same SQLite file.
4. **Cross-entity integrity:** package/payment patient IDs, session/patient IDs, protocol/version IDs, body-map/session IDs, and evidence/protocol-version IDs must reject mismatched relationships.
5. **Layout safety:** every routed screen at desktop and mobile widths must have no horizontal document overflow, no input/select/textarea/button clipped outside its visible container, and no zero-size interactive control.

---

## Canonical UI Placement Matrix

| Capability | Canonical UI after integration | Notes |
| --- | --- | --- |
| F1 patients | `Pacientes` + patient workspace | Replace fixture/local persistence with API persistence. |
| F1 anamnesis/encounter/history | Patient workspace → `Anamnese`, `Resumo`, `Sessões` | Persist assessments/encounters; timeline comes from backend. |
| F2 protocol engine/dosimetry | `Protocolos` + session planning | Keep existing calculator; connect structured protocol fields and immutable versions. |
| F3 equipment/adaptation | `Equipamentos` + session planning | CRUD equipment/applicators and explicit adaptation preview; never overwrite reference protocol. |
| F4 consent | Patient workspace → `Consentimentos` | Replace local simulation with append-only acceptance/revocation history. |
| F4 clinical media | Patient workspace → `Fotos` | Real upload/storage metadata/integrity; no local-only preview as source of truth. |
| F4 PDF/documents | Patient workspace → `Documentos` | Generate/list encounter PDF records and expose verified local document metadata. |
| F4 backup | `Administração` | Admin-only verified backup actions. |
| F5 outcomes/evolution | Patient workspace → `Evolução` + `Resumo` | Typed outcomes, timeline, comparison table and non-causal chart. |
| F6 scientific evidence | `Protocolos` → evidence subview | Search evidence and show exact links to protocol versions; no ranking. |
| F7 body map | `Sessões` → `Aplicação`; readback in patient session history | Register confirmed anatomical points linked to a real session. |
| F8 advanced clinical engine | `Protocolos` → clinical search/filter panel; reusable in session planning | Filtering only; no selected winner, efficacy score or auto-prescription. |
| F9 agenda | Existing `Agenda` | Replace local agenda adapter with persisted appointment API, recurrence, filters and status updates. |
| F9 packages/payments | New primary route `Financeiro` | Dedicated operational surface because there is no existing canonical home. |
| F9 operational reports | Existing `Relatórios` | Switch from mixed/local derivation to backend report API; include received/pending summaries. |
| F10 auth | Login/setup shell before existing app chrome | Preserve main header/navigation after authentication. |
| F10 RBAC | Role-aware navigation + server enforcement | Hide unavailable routes, but always enforce on API. |
| F10 clinic/accounts/integrity/backups/retention | `Administração` | Admin-only tabs/sections. |

## Test Strategy

Every capability must have all applicable layers below before the integration PR can merge:

1. **Domain/unit:** normalization, validation, immutable history, dose math, relationship guards, RBAC matrix.
2. **Schema/migration:** fresh DB and upgrade from F0-only DB.
3. **HTTP/API:** auth, permissions, status codes, request/response shapes, persistence.
4. **Adapter/gateway contract:** UI-facing shapes are normalized by adapters; feature modules never call `/api/*` directly.
5. **Feature E2E:** each visible workflow is exercised through the current `main` UI.
6. **Role E2E:** Admin/Professional/Reception navigation and forbidden operations.
7. **Persistence E2E:** mutate → reload → same data visible.
8. **Responsive/layout E2E:** desktop + mobile traversal, overflow/clipping assertions for all routed screens.
9. **Final gate:** `npm run check && npm run test:unit && npm run test:e2e && npm run smoke` on one final commit.

---

### Task 1: Create the integration branch and pin both source authorities

**Files:**
- Create implementation branch: `feat/integrate-main-f0-f10` from current `main`
- Create: `docs/integration-sources.md`
- Test: no runtime test yet; run the current main gate before changing code.

**Interfaces:**
- Consumes: `main@717bef304811b89f5450e7b9fb15a57ae7ecc26f`, `feat/f8-f10-clinical-ops-rbac@11f3e12e0001996a94bc2ce3ad412dde56e62eba`
- Produces: a documented integration baseline and denylist of phase UI files.

- [ ] **Step 1: Record the source SHAs and ownership rule**

```markdown
UI authority: main@717bef304811b89f5450e7b9fb15a57ae7ecc26f
Clinical/domain authority: feat/f8-f10-clinical-ops-rbac@11f3e12e0001996a94bc2ce3ad412dde56e62eba
Do not import phase-specific public UI files from the clinical branch.
```

- [ ] **Step 2: Run the untouched main gate**

```bash
npm install
npx playwright install --with-deps chromium
npm run check
npm run test:unit
npm run test:e2e
npm run smoke
```

Expected: current `main` baseline passes before integration edits.

- [ ] **Step 3: Commit the integration baseline document**

```bash
git add docs/integration-sources.md
git commit -m "docs: pin F0-F10 integration sources"
```

---

### Task 2: Port F1–F10 schema, domain, and service chain without changing the main UI

**Files:**
- Create: `src/db/migrations/0002_f1.sql` … `src/db/migrations/0010_f10.sql`
- Create/port: `src/app/auth-service.js`, `src/app/f2-service.js` … `src/app/f10-service.js`, `src/app/f4-mvp-service.js`
- Create/port required domain/core modules under `src/core/` and `src/domain/`
- Modify only as required for compatibility: `src/app/f0-service.js`
- Test/port: clinical branch unit/domain tests into `test/*.test.js`
- Create: `test/integration-schema-upgrade.test.js`

**Interfaces:**
- Consumes: current F0 database/migration and all validated clinical branch services.
- Produces: `createF10Service(db, { dbFile, storageRoot, backupRoot })` with backward-compatible F0 methods plus F1–F10 methods.

- [ ] **Step 1: Write the F0-to-F10 upgrade RED test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/db/database.js';

test('existing F0 data survives migrations through F10', () => {
  // Build/open a fixture DB containing 0001_f0 state and a known protocol/session.
  // Reopen with the integrated migration directory.
  // Assert 0001..0010 appear once in schema_migrations and the known F0 rows still exist.
  assert.ok(true);
});
```

Replace the final assertion during implementation with actual migration/data assertions before GREEN.

- [ ] **Step 2: Port migrations and domain/service files from the clinical branch**

Do not modify `0001_f0.sql`; preserve ordered filenames and service composition through F10.

- [ ] **Step 3: Port the clinical branch unit/domain tests**

Keep the tests that prove F1 workspace, F2 dosimetry/protocol structure, F3 equipment adaptation, F4 consent/media/PDF/backup, F5 outcomes, F6 evidence, F7 body map, F8 filtering, F9 operations, and F10 RBAC/integrity.

- [ ] **Step 4: Run unit/domain tests**

```bash
npm run check
npm run test:unit
```

Expected: all main tests plus the ported clinical tests pass with no UI change.

- [ ] **Step 5: Commit**

```bash
git add src/db src/core src/domain src/app test
git commit -m "feat: port F1-F10 clinical domain onto main"
```

---

### Task 3: Replace the F0-only server with the authenticated F10 server while preserving main static assets

**Files:**
- Modify: `src/app/server.js`
- Test/port: `test/server-http.test.js`
- Test/port/create: `test/f10-http.test.js`, `test/integration-auth-http.test.js`

**Interfaces:**
- Consumes: `createF10Service`, `createAuthService`, `hasPermission`.
- Produces: the complete authenticated `/api/*` contract while continuing to serve the existing `src/app/public/` from `main`.

- [ ] **Step 1: Write RED tests for authentication and static-main coexistence**

```js
assert.equal((await fetch(`${url}/api/patients`)).status, 401);
assert.equal((await fetch(`${url}/`)).status, 200);
```

Also assert first-run setup, login cookie, logout, 403 role denial, and existing F0 route compatibility.

- [ ] **Step 2: Port server auth/RBAC/route logic from the clinical branch**

Keep the main `publicDir`; do not port the clinical branch public HTML/JS shell.

- [ ] **Step 3: Verify role enforcement**

```js
// reception: patients + agenda + finance allowed; clinical/protocol/equipment/admin denied
// professional: patient + clinical + agenda + protocol allowed; finance/admin denied
// admin: all permissions allowed
```

- [ ] **Step 4: Run HTTP/unit gate**

```bash
npm run check
npm run test:unit
```

- [ ] **Step 5: Commit**

```bash
git add src/app/server.js test
git commit -m "feat: expose F0-F10 authenticated API on main"
```

---

### Task 4: Expand the ClinicalDataGateway and eliminate local runtime clinical state

**Files:**
- Create: `src/app/public/data/http-client.js`
- Create: `src/app/public/data/adapters/clinical-api-adapter.js`
- Create: `src/app/public/data/adapters/operations-api-adapter.js`
- Create: `src/app/public/data/adapters/admin-api-adapter.js`
- Create: `src/app/public/data/adapters/auth-api-adapter.js`
- Modify: `src/app/public/data/contracts.js`
- Modify: `src/app/public/data/clinical-data-gateway.js`
- Modify: `src/app/public/app.js`
- Keep only for isolated tests/fixtures: `src/app/public/data/adapters/local-clinical-adapter.js`
- Test: `test/data-gateway.test.js`, `test/api-adapters.test.js`, `test/runtime-source-of-truth.test.js`

**Interfaces:**
- Consumes: complete `/api/*` contract.
- Produces: UI-facing methods for auth, patients/intake/consent/evolution/photos/documents, protocols/evidence/engine, equipment/adaptation, sessions/body map, agenda/finance/reports, and admin.

- [ ] **Step 1: Add a RED runtime-source test**

```js
assert.doesNotMatch(appSource, /createLocalClinicalAdapter\(/);
assert.doesNotMatch(featureSources, /fetch\(['"]\/api\//);
```

The application runtime must instantiate API adapters; feature modules must call only the gateway.

- [ ] **Step 2: Add one shared HTTP client**

```js
export async function apiRequest(path, options = {}) {
  const response = await fetch(path, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || `Falha HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return body;
}
```

- [ ] **Step 3: Implement focused adapters and normalization**

Adapters must translate backend models into the shapes already expected by `main` feature modules instead of forcing every view to understand raw server rows.

- [ ] **Step 4: Change `app.js` runtime wiring**

Replace the `localAdapter` runtime with persisted adapters. Keep fixture/local adapter tests but not production bootstrapping.

- [ ] **Step 5: Run gateway and unit tests**

```bash
npm run check
npm run test:unit
```

- [ ] **Step 6: Commit**

```bash
git add src/app/public/data src/app/public/app.js test
git commit -m "feat: route main UI through persisted F0-F10 gateway"
```

---

### Task 5: Add authentication shell and role-aware navigation to the existing main chrome

**Files:**
- Modify: `src/app/public/index.html`
- Modify: `src/app/public/app.js`
- Modify: `src/app/public/ui/navigation.js`
- Modify: `src/app/public/styles.css`
- Create: `src/app/public/features/auth.js`
- Test: `test/navigation-rbac.test.js`
- E2E: `test/e2e/auth-rbac-main.spec.js`

**Interfaces:**
- Consumes: gateway auth methods and authenticated user `{ id, professionalId, name, email, role }`.
- Produces: setup/login/logout shell and permission-aware route list.

- [ ] **Step 1: Write RED E2E for setup/login/logout and all three roles**

The test must assert that each role reaches a usable route set and that hidden routes cannot be opened by directly navigating/clicking stale DOM state.

- [ ] **Step 2: Add `#auth-root` and hide the current app chrome until authenticated**

Preserve the existing main header, CSS and feature architecture after login.

- [ ] **Step 3: Make navigation permission-aware**

```js
const ROUTE_PERMISSIONS = {
  patients: 'patients.read', agenda: 'agenda.read', finance: 'finance.read',
  protocols: 'protocols.read', equipment: 'equipment.read', reports: 'finance.read',
  audit: 'audit.read', admin: 'accounts.manage'
};
```

UI filtering must mirror, not replace, server RBAC.

- [ ] **Step 4: Handle auth errors centrally**

A 401 returns to login; a 403 shows an access message without destroying the app shell.

- [ ] **Step 5: Run E2E subset**

```bash
npx playwright test test/e2e/auth-rbac-main.spec.js
```

- [ ] **Step 6: Commit**

```bash
git add src/app/public test
git commit -m "feat: integrate auth and role-aware main navigation"
```

---

### Task 6: Convert patient workspace from local simulation to F1/F4/F5 persistence

**Files:**
- Modify: `src/app/public/features/patients.js`
- Modify: `src/app/public/features/patient-workspace.js`
- Modify: `src/app/public/features/clinical-intake.js`
- Modify: `src/app/public/features/evolution.js`
- Modify: `src/app/public/features/photos.js`
- Create: `src/app/public/features/documents.js`
- Test: adapter/unit tests for normalization
- E2E: `test/e2e/patient-clinical-workspace-integrated.spec.js`

**Interfaces:**
- Consumes: persisted patient, encounter/assessment, consent, outcome, media, PDF/document and timeline APIs.
- Produces: the existing patient tabs backed by SQLite.

- [ ] **Step 1: Write RED E2E for patient persistence across reload**

Create patient → save anamnesis/encounter → accept consent → add typed outcome → upload allowed image → generate document → reload → reopen patient → assert all records remain.

- [ ] **Step 2: Replace local anamnesis copy and actions**

Remove UI language such as “rascunho local” and “simular consentimento”. Use real encounter/assessment and consent endpoints.

- [ ] **Step 3: Wire F5 evolution**

Expose VAS, functional numeric, edema, ROM and text outcomes; render chronological timeline, comparison, and local SVG/polyline without causal claims.

- [ ] **Step 4: Wire clinical media and documents**

Photos must use backend media records and integrity metadata. `Documentos` must list/generated encounter PDFs rather than show a placeholder.

- [ ] **Step 5: Run patient E2E plus unit gate**

```bash
npm run test:unit
npx playwright test test/e2e/patient-clinical-workspace-integrated.spec.js test/e2e/patients.spec.js test/e2e/patient-workspace.spec.js
```

- [ ] **Step 6: Commit**

```bash
git add src/app/public/features test
git commit -m "feat: persist patient clinical workspace through F5"
```

---

### Task 7: Integrate F2/F6/F8 into the existing Protocolos surface

**Files:**
- Modify: `src/app/public/features/f0-views.js`
- Modify: `src/app/public/features/dosimetry.js`
- Create: `src/app/public/features/protocol-search.js`
- Create: `src/app/public/features/evidence.js`
- Modify: `src/app/public/clinical.css`
- E2E: `test/e2e/protocol-evidence-engine-integrated.spec.js`

**Interfaces:**
- Consumes: structured protocols/version APIs, evidence API, clinical-engine search API.
- Produces: one Protocolos page with version library, dosimetry, clinical filtering, evidence and exact-version links.

- [ ] **Step 1: Write RED E2E**

Assert deterministic filters by condition/symptom/body region/goal/phase/age/professional area/wavelength, no ranking/winner language, evidence visible for exact protocol version, and immutable version history.

- [ ] **Step 2: Add a Protocolos subnavigation**

Use sections such as `Biblioteca`, `Busca clínica`, `Evidências`; do not add separate F6/F8 top-level routes.

- [ ] **Step 3: Keep dosimetry as calculation, not recommendation**

The calculator can derive math from explicit inputs; it must not choose dose or treatment.

- [ ] **Step 4: Run protocol/evidence E2E**

```bash
npx playwright test test/e2e/protocol-evidence-engine-integrated.spec.js test/e2e/protocol-dosimetry.spec.js
```

- [ ] **Step 5: Commit**

```bash
git add src/app/public/features src/app/public/clinical.css test
git commit -m "feat: integrate protocol evidence and clinical search UI"
```

---

### Task 8: Integrate F3/F7 into Equipamentos and the guided Sessão workflow

**Files:**
- Modify: `src/app/public/features/equipment-workspace.js`
- Modify: `src/app/public/features/treatment-workflow.js`
- Modify: `src/app/public/features/f0-views.js`
- Create: `src/app/public/features/body-map.js`
- Modify: `src/app/public/clinical.css`
- E2E: `test/e2e/session-equipment-bodymap-integrated.spec.js`

**Interfaces:**
- Consumes: equipment/applicator CRUD, adaptation preview, session create, body-map catalog and session point APIs.
- Produces: explicit equipment selection/adaptation and confirmed anatomical points during the existing five-step session flow.

- [ ] **Step 1: Write RED E2E**

Create/select applicator → select protocol version → preview adaptation → require explicit `selectedPowerMw` for variable-power applicator → register body-map point → save session → verify planned/applied snapshots and saved anatomical point after reload.

- [ ] **Step 2: Expand Equipamentos**

Expose manufacturer/model/applicators/wavelength/power/spot/mode/frequency/status fields already validated by F3.

- [ ] **Step 3: Insert adaptation into Planejamento**

Show reference parameters and equipment-derived parameters side by side; never mutate the reference version.

- [ ] **Step 4: Insert body map into Aplicação**

The professional selects/confirm points; the component stores anatomical identity/laterality/coordinates only and does not infer dose.

- [ ] **Step 5: Run equipment/session E2E**

```bash
npx playwright test test/e2e/equipment.spec.js test/e2e/treatment-workflow.spec.js test/e2e/session-equipment-bodymap-integrated.spec.js
```

- [ ] **Step 6: Commit**

```bash
git add src/app/public/features src/app/public/clinical.css test
git commit -m "feat: integrate equipment adaptation and body map workflow"
```

---

### Task 9: Replace local Agenda and add the F9 Financeiro surface

**Files:**
- Modify: `src/app/public/features/agenda.js`
- Create: `src/app/public/features/finance.js`
- Modify: `src/app/public/ui/navigation.js`
- Modify: `src/app/public/app.js`
- Modify: `src/app/public/styles.css`
- E2E: `test/e2e/agenda-finance-integrated.spec.js`

**Interfaces:**
- Consumes: appointments, treatment packages, package consumption, payments.
- Produces: persisted agenda and dedicated finance route.

- [ ] **Step 1: Write RED E2E for agenda persistence**

Create recurring appointment → reload → verify occurrences → update status → verify no PBM session is auto-created.

- [ ] **Step 2: Remove local-only agenda copy**

Agenda must call the operations adapter and display persisted status; retain filters and patient navigation.

- [ ] **Step 3: Add `Financeiro` to primary navigation only for permitted roles**

The page must support package creation, real-session consumption, payment creation, mark-paid action and patient/status filtering.

- [ ] **Step 4: Write relationship E2E**

Attempt to attach a package belonging to patient A to a payment/session for patient B and assert the API/UI reports the mismatch without changing data.

- [ ] **Step 5: Run operations E2E**

```bash
npx playwright test test/e2e/agenda.spec.js test/e2e/agenda-finance-integrated.spec.js
```

- [ ] **Step 6: Commit**

```bash
git add src/app/public/features src/app/public/ui src/app/public/app.js src/app/public/styles.css test
git commit -m "feat: persist agenda and add finance operations UI"
```

---

### Task 10: Switch Relatórios to the F9 backend report and preserve descriptive-only semantics

**Files:**
- Modify: `src/app/public/features/reports.js`
- Modify: `src/app/public/data/clinical-data-gateway.js`
- Test: `test/operational-report.test.js`
- E2E: `test/e2e/reports-integrated.spec.js`

**Interfaces:**
- Consumes: `/api/reports/operations`.
- Produces: persisted operational counts plus received/pending finance summaries.

- [ ] **Step 1: Write RED E2E**

Create/prepare a paid payment and pending payment → open Relatórios → apply period → assert received and pending totals plus session/patient operational counts.

- [ ] **Step 2: Remove the mixed local fallback from runtime reporting**

Keep pure report derivation only for unit tests if useful; runtime reports should use the backend report adapter.

- [ ] **Step 3: Preserve non-clinical wording**

No efficacy, prognosis, or treatment recommendation claims may be derived from operational report data.

- [ ] **Step 4: Run report tests**

```bash
npm run test:unit
npx playwright test test/e2e/reports.spec.js test/e2e/reports-integrated.spec.js
```

- [ ] **Step 5: Commit**

```bash
git add src/app/public/features/reports.js src/app/public/data test
git commit -m "feat: integrate persisted F9 operational reports"
```

---

### Task 11: Turn Configurações into F10 Administração and robustness UI

**Files:**
- Create: `src/app/public/features/admin.js`
- Modify: `src/app/public/ui/navigation.js`
- Modify: `src/app/public/app.js`
- Modify: `src/app/public/styles.css`
- E2E: `test/e2e/admin-robustness-integrated.spec.js`

**Interfaces:**
- Consumes: clinic/account/session/integrity/backup/restore-preview/audit/media-retention admin APIs.
- Produces: admin-only operational management surface.

- [ ] **Step 1: Write RED admin E2E**

Admin can create account, assign role, disable account, revoke sessions, inspect integrity, create verified backup, preview restore, filter audit and list retention candidates. Professional/Reception cannot open or call these actions.

- [ ] **Step 2: Replace the placeholder `settings` route**

Use `Administração` for admins. If a non-admin needs personal settings later, that is a separate scope; do not expose empty configuration placeholders in this integration.

- [ ] **Step 3: Preserve destructive-safety rules**

Restore remains preview/verification in the UI unless the existing F10 service explicitly supports a safe restore action; media retention lists candidates but never auto-deletes.

- [ ] **Step 4: Run F10 E2E**

```bash
npx playwright test test/e2e/auth-rbac-main.spec.js test/e2e/admin-robustness-integrated.spec.js
```

- [ ] **Step 5: Commit**

```bash
git add src/app/public/features/admin.js src/app/public/ui/navigation.js src/app/public/app.js src/app/public/styles.css test
git commit -m "feat: integrate F10 administration and robustness UI"
```

---

### Task 12: Add global route/role/layout regression coverage

**Files:**
- Create: `test/e2e/all-routes-layout.spec.js`
- Create: `test/e2e/persistence-reload.spec.js`
- Modify: `playwright.config.js` only if projects/viewports need explicit additions.

**Interfaces:**
- Consumes: every integrated route and role.
- Produces: a cross-cutting regression gate that catches missing navigation destinations, clipped controls, overflow, and non-persistent UI mutations.

- [ ] **Step 1: Traverse all routes by role**

```js
const routesByRole = {
  admin: ['dashboard', 'patients', 'agenda', 'protocols', 'equipment', 'finance', 'reports', 'sessions', 'audit', 'admin'],
  professional: ['dashboard', 'patients', 'agenda', 'protocols', 'equipment', 'sessions'],
  reception: ['dashboard', 'patients', 'agenda', 'finance', 'reports']
};
```

Adjust only if the final permission matrix intentionally differs; keep server and UI tests synchronized.

- [ ] **Step 2: Add no-overflow/no-clipping assertions**

```js
const metrics = await page.evaluate(() => ({
  viewport: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth,
  controls: [...document.querySelectorAll('input, select, textarea, button')]
    .filter((el) => !el.hidden && getComputedStyle(el).display !== 'none')
    .map((el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
    })
}));
expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewport + 1);
for (const control of metrics.controls) {
  expect(control.width).toBeGreaterThan(0);
  expect(control.height).toBeGreaterThan(0);
  expect(control.left).toBeGreaterThanOrEqual(-1);
  expect(control.right).toBeLessThanOrEqual(metrics.viewport + 1);
}
```

Run at desktop and at least one mobile viewport around 360–390 px width.

- [ ] **Step 3: Add reload persistence scenarios**

For patient, outcome, consent, media, appointment, package and payment: mutate through UI → reload → assert persisted state is visible.

- [ ] **Step 4: Run complete E2E**

```bash
npm run test:e2e
```

- [ ] **Step 5: Commit**

```bash
git add test/e2e playwright.config.js
git commit -m "test: cover integrated routes persistence and layout"
```

---

### Task 13: Documentation, dead-code cleanup, and final single-commit gate

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/domain-model.md`
- Modify: `docs/reuse-map.md`
- Keep/port: `docs/decisions/0002-roadmap-ends-f10-no-ai-rag.md`
- Remove from integration branch if accidentally introduced: phase-specific UI files and local-runtime fixture wiring.

**Interfaces:**
- Consumes: completed integrated application.
- Produces: one merge-ready branch whose docs match runtime behavior.

- [ ] **Step 1: Search for stale implementation language**

```bash
grep -R "Somente local\|não persistido\|simular consentimento\|F11\|AI/RAG" src/app/public README.md docs || true
```

Only historical/spec references may remain where intentionally documented; no end-user runtime copy should claim integrated features are local simulations.

- [ ] **Step 2: Search for direct API access from feature modules**

```bash
grep -R "fetch(.*\/api\|api(.*\/api" src/app/public/features || true
```

Expected: feature modules use the gateway/adapters, not direct endpoint calls.

- [ ] **Step 3: Search for phase UI leakage**

```bash
find src/app/public -maxdepth 1 -type f -name 'f*-ui.js' -print
```

Expected on the integration branch: none of the clinical branch phase UI files are required by `index.html`.

- [ ] **Step 4: Run the final fresh gate on one final commit**

```bash
npm run check
npm run test:unit
npm run test:e2e
npm run smoke
```

Expected: all four commands PASS on the same SHA.

- [ ] **Step 5: Verify architectural constraints manually from the diff**

Confirm no paid runtime dependency, no F11/AI/RAG module, no auto-prescription/ranking, no mutation of reference protocol versions, no local runtime source-of-truth, and no server-side RBAC weakening.

- [ ] **Step 6: Commit documentation/cleanup**

```bash
git add README.md docs src/app/public test
git commit -m "docs: finalize integrated F0-F10 architecture"
```

- [ ] **Step 7: Run the final gate again after the documentation/cleanup commit**

```bash
npm run check && npm run test:unit && npm run test:e2e && npm run smoke
```

Only after this exact SHA is green should the integration PR target `main`.

---

## Recommended execution grouping

The integration should not be executed as one giant merge commit.

**Serial foundation:** Tasks 1 → 2 → 3 → 4 → 5.

After the gateway/auth contracts are stable, these workstreams can proceed in isolated worktrees/branches and then be reconciled into the integration branch:

- Patient clinical workspace: Task 6
- Protocol/evidence/engine: Task 7
- Agenda/Finance/Reports: Tasks 9–10
- Administration: Task 11 (depends on Task 5)

Task 8 depends on the protocol/equipment contracts from Task 7 and should land after them. Task 12 must run only after all visible surfaces are integrated. Task 13 is the final convergence gate.

## Merge rule

Do not merge `feat/f8-f10-clinical-ops-rbac` directly into `main`. Merge only the purpose-built `feat/integrate-main-f0-f10` branch after:

- all main UI routes are preserved or intentionally replaced by a documented canonical route;
- every F0–F10 capability has a UI location where applicable;
- all clinical/operational runtime data is API/SQLite-backed;
- all role rules pass server and browser tests;
- all legacy `main` E2E tests either still pass or have been updated only where the integrated behavior intentionally changed;
- the final syntax/unit/E2E/smoke gate is green on one SHA.
