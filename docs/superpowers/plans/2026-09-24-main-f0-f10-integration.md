# Main + F0–F10 Integration Implementation Plan

> **Execution rule:** implement task-by-task with TDD. Do not merge the clinical branch wholesale.

**Goal:** integrate the complete F0–F10 clinical/operational backend into the current `main` UI without replacing its UI architecture, while making every roadmap capability accessible in an appropriate surface, persistent where it represents business/clinical data, role-aware, and covered by automated tests.

**Source authorities**

- UI/navigation authority: `main@717bef304811b89f5450e7b9fb15a57ae7ecc26f`
- Clinical/domain authority: `feat/f8-f10-clinical-ops-rbac@11f3e12e0001996a94bc2ce3ad412dde56e62eba`
- Integration target branch: `feat/integrate-main-f0-f10`, created from `main`

**Architecture:** preserve the current `main` shell, feature modules, CSS, patient workspace, `ClinicalDataGateway`, and route model. Port the validated migrations, services, domain rules, auth/RBAC and HTTP contracts from the clinical branch. Do not port its phase-specific UI shell. UI feature modules continue to depend on the gateway; new API adapters normalize server payloads for the existing UI.

**Tech stack:** Node.js 22+, `node:sqlite`, vanilla ES modules, local HTTP API, Playwright Chromium, `node:test`.

## Canonical specs

- `docs/superpowers/specs/2026-09-22-ui7-ui8-backend-ready-design.md`
- `docs/superpowers/specs/2026-09-22-f1-clinical-workspace-design.md`
- `docs/superpowers/specs/2026-09-22-f3-f5-design.md`
- `docs/superpowers/specs/2026-09-23-f6-f7-evidence-bodymap-design.md`
- `docs/superpowers/specs/2026-09-23-f8-advanced-clinical-engine-design.md`
- `docs/superpowers/specs/2026-09-23-f9-clinical-operations-design.md`
- `docs/superpowers/specs/2026-09-23-f10-multiprofessional-rbac-robustness-design.md`
- `docs/decisions/0002-roadmap-ends-f10-no-ai-rag.md`

## Non-negotiable constraints

- `main` remains the UI authority. Do not replace `main/src/app/public/index.html`, `app.js`, feature modules, or CSS with the clinical branch shell.
- Do not import `f2-ui.js`, `f3-ui.js`, `f4-ui.js`, `f5-ui.js`, `f6-ui.js`, `f7-ui.js`, `f8-ui.js`, `f9-ui.js`, `f10-ui.js`, or `f10-bootstrap.js` into the integrated runtime.
- Port migrations `0002_f1.sql` through `0010_f10.sql`; do not rewrite `0001_f0.sql`.
- Persistent clinical and operational records must use SQLite/API. The local adapter may remain only for isolated fixture tests, never as production source of truth.
- Ephemeral form/checklist state that is not part of the documented F0–F10 data model may remain in component memory until submission; do not invent a new persisted clinical model merely to mirror transient UI state.
- Core remains R$0, self-hosted, local-first and without mandatory paid APIs.
- F11/AI/RAG remains removed. The functional roadmap ends at F10.
- No automatic prescription, automatic dose recommendation, efficacy ranking, hidden protocol mutation, or automatic causal inference.
- Protocol versions remain immutable. Planned and applied session parameters remain separate snapshots.
- Server-side RBAC is authoritative. UI visibility never substitutes for API authorization.
- Patients are archived, not destructively deleted.
- Audit and consent histories remain append-only where required by the specs.
- Backup uses a consistent SQLite snapshot and integrity verification. Media-retention tooling never auto-deletes clinical assets.

## Critical integration risks to test explicitly

1. **Legacy F0 database upgrade:** an existing database containing only `0001_f0` upgrades through `0010_f10` once, preserves existing rows and reopens cleanly.
2. **Role bootstrap:** `admin`, `professional` and `reception` each enter a usable UI without unauthorized startup requests causing 403 failures.
3. **Route-scoped loading:** replace the current unconditional `refreshAll()` pattern. A role must request only the data allowed for the current route.
4. **Reception patient access:** Reception can manage patient demographic/administrative data but must never load clinical timeline, anamnesis, outcomes, photos, protocols or sessions without `clinical.read`.
5. **Persistence:** patient/anamnesis/consent/outcome/media/agenda/package/payment changes survive browser reload and server restart against the same SQLite file.
6. **Cross-entity integrity:** mismatched patient/package/payment/session/protocol-version/body-map/evidence relationships are rejected without partial writes.
7. **Responsive layout:** every route at desktop and mobile widths has no document overflow, no field clipped outside its container and no unusably small form control.

---

## Canonical UI placement

| Capability | Integrated UI location | Integration rule |
| --- | --- | --- |
| F1 Patients | `Pacientes` | Replace fixture/local state with API persistence. |
| F1 Anamnesis/encounter/history | Patient workspace → `Anamnese`, `Resumo`, `Sessões` | Professional/Admin only for clinical content. |
| F2 Protocol engine/dosimetry | `Protocolos` + session planning | Keep calculation UI; connect structured protocol/version data. |
| F3 Equipment/adaptation | `Equipamentos` + `Sessões > Planejamento` | Show reference vs equipment-derived parameters separately. |
| F4 Consent | Patient workspace → `Consentimentos` | Replace simulated consent with real append-only history. |
| F4 Clinical media | Patient workspace → `Fotos` | Real upload and integrity-backed metadata. |
| F4 PDF/documents | Patient workspace → `Documentos` | Generate/list encounter PDFs and document metadata. |
| F4 Backup | `Administração` | Admin-only. |
| F5 Outcomes/evolution | Patient workspace → `Evolução` + `Resumo` | Typed outcomes, timeline, comparisons, non-causal graph. |
| F6 Scientific evidence | `Protocolos > Evidências` | Link evidence to exact immutable protocol versions. |
| F7 Body map | `Sessões > Aplicação`; readback in session history | Confirm anatomical points; never infer dose. |
| F8 Advanced clinical engine | `Protocolos > Busca clínica`; reusable in session planning | Deterministic filtering only, no winner/ranking. |
| F9 Agenda | Existing `Agenda` | Replace local adapter with persisted appointments/recurrence. |
| F9 Packages/payments | New primary route `Financeiro` | Dedicated surface; visible only with finance permissions. |
| F9 Operational reports | Existing `Relatórios` | Use backend report API; include received/pending summaries. |
| F10 Auth | Login/setup shell before existing main chrome | Keep main chrome after authentication. |
| F10 RBAC | Role-aware navigation + route loaders + server enforcement | Never preload forbidden modules. |
| F10 Clinic/accounts/integrity/backups/retention | `Administração` | Replace placeholder `Configurações` for Admin. |

### Role-visible surfaces

- **Admin:** Dashboard, Pacientes, Agenda, Protocolos, Equipamentos, Sessões, Financeiro, Relatórios, Auditoria, Administração.
- **Professional:** Dashboard, Pacientes, Agenda, Protocolos, Equipamentos, Sessões. No Financeiro, Relatórios, Auditoria or Administração under the current RBAC matrix.
- **Reception:** Dashboard, Pacientes, Agenda, Financeiro, Relatórios. Patient access is demographic/administrative only; no clinical workspace tabs.

The server remains the final authority even if the UI hides a route.

---

## Required test layers

Every applicable capability must have:

1. Domain/unit validation.
2. Fresh-schema and legacy-upgrade migration tests.
3. HTTP/auth/RBAC contract tests.
4. Adapter/gateway normalization tests.
5. Feature E2E through the integrated `main` UI.
6. Role E2E for Admin/Professional/Reception.
7. Reload/restart persistence E2E.
8. Desktop/mobile layout and clipping E2E.
9. Final `check + unit + e2e + smoke` gate on one SHA.

---

### Task 1 — Create the implementation baseline

**Files**
- Branch: `feat/integrate-main-f0-f10` from current `main`
- Create: `docs/integration-sources.md`

- [ ] Create the branch from `main`, not from the clinical branch.
- [ ] Record both source SHAs and this rule: `main = UI authority`, clinical branch = `domain/API authority`.
- [ ] Record the denylist of phase UI files.
- [ ] Run untouched baseline:

```bash
npm install
npx playwright install --with-deps chromium
npm run check
npm run test:unit
npm run test:e2e
npm run smoke
```

Expected: current main is green before integration edits.

- [ ] Commit:

```bash
git add docs/integration-sources.md
git commit -m "docs: pin F0-F10 integration sources"
```

---

### Task 2 — Port F1–F10 migrations, domain and service chain without changing the UI

**Create/port exactly**

Migrations:
- `src/db/migrations/0002_f1.sql`
- `src/db/migrations/0003_f2.sql`
- `src/db/migrations/0004_f3.sql`
- `src/db/migrations/0005_f4.sql`
- `src/db/migrations/0006_f5.sql`
- `src/db/migrations/0007_f6.sql`
- `src/db/migrations/0008_f8.sql`
- `src/db/migrations/0009_f9.sql`
- `src/db/migrations/0010_f10.sql`

Core:
- `src/core/auth.js`
- `src/core/backup.js`
- `src/core/clinical-storage.js`
- `src/core/pdf.js`
- `src/core/rbac.js`
- reconcile `src/core/audit.js` with the clinical source while retaining all existing main tests.

Domain:
- `src/domain/body-map.js`
- `src/domain/equipment-adaptation.js`
- `src/domain/outcomes.js`
- reconcile `src/domain/protocols.js`
- reconcile `src/domain/treatment-sessions.js`

Application services:
- `src/app/auth-service.js`
- reconcile `src/app/f0-service.js`
- `src/app/f2-service.js`
- `src/app/f3-service.js`
- `src/app/f4-service.js`
- `src/app/f4-mvp-service.js`
- `src/app/f5-service.js`
- `src/app/f6-service.js`
- `src/app/f7-service.js`
- `src/app/f8-service.js`
- `src/app/f9-service.js`
- `src/app/f10-service.js`
- reconcile `src/app/seed.js`

**New test:** `test/integration-schema-upgrade.test.js`

- [ ] Write this RED legacy-upgrade test before copying the migrations:

```js
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { openDatabase } from '../src/db/database.js';

test('existing F0 database upgrades through F10 without losing patient rows', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pbm-f0-upgrade-'));
  const dbFile = path.join(dir, 'legacy.sqlite');
  const legacy = new DatabaseSync(dbFile);
  const f0Sql = fs.readFileSync(new URL('../src/db/migrations/0001_f0.sql', import.meta.url), 'utf8');

  legacy.exec(f0Sql);
  legacy.exec(`
    CREATE TABLE schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  legacy.prepare('INSERT INTO schema_migrations(version) VALUES (?)').run('0001_f0');
  legacy.prepare('INSERT INTO patients(id, full_name) VALUES (?, ?)').run('legacy-patient', 'Paciente legado');
  legacy.close();

  const db = openDatabase(dbFile);
  assert.equal(
    db.prepare('SELECT full_name FROM patients WHERE id = ?').get('legacy-patient').full_name,
    'Paciente legado'
  );
  assert.deepEqual(
    db.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map((row) => row.version),
    ['0001_f0', '0002_f1', '0003_f2', '0004_f3', '0005_f4', '0006_f5', '0007_f6', '0008_f8', '0009_f9', '0010_f10']
  );
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
```

- [ ] Port/reconcile the clinical branch unit/domain tests for F1–F10. Preserve all current main tests; never replace a main assertion merely to make the port pass.
- [ ] Run:

```bash
npm run check
npm run test:unit
```

Expected: main tests + F1–F10 unit/domain tests pass while the UI is still unchanged.

- [ ] Commit:

```bash
git add src/db src/core src/domain src/app test
git commit -m "feat: port F1-F10 clinical domain onto main"
```

---

### Task 3 — Replace the F0-only API server with the authenticated F10 server

**Files**
- Modify: `src/app/server.js`
- Reconcile: `test/server-http.test.js`
- Port/reconcile: `test/f1-http.test.js`, `test/f2-http.test.js`, F3/F4/F6/F7/F8/F9 HTTP tests, `test/f10-http.test.js`
- Create: `test/integration-auth-http.test.js`

**Rule:** port server behavior, not the clinical branch public HTML/JS shell.

- [ ] RED: unauthenticated `/api/patients` returns 401 while `/` still serves the `main` HTML.
- [ ] RED: setup creates first authenticated Admin session; login/logout cookie lifecycle works.
- [ ] RED: role permissions return 403 exactly according to `src/core/rbac.js`.
- [ ] Port `createF10Service`, `createAuthService`, cookie handling, route contracts, `storageRoot` and `backupRoot` propagation.
- [ ] Preserve static serving of current `main/src/app/public`.
- [ ] Run:

```bash
npm run check
npm run test:unit
```

- [ ] Commit:

```bash
git add src/app/server.js test
git commit -m "feat: expose authenticated F0-F10 API on main"
```

---

### Task 4 — Expand `ClinicalDataGateway` and remove local clinical records from production runtime

**Files**
- Create: `src/app/public/data/http-client.js`
- Create: `src/app/public/data/adapters/auth-api-adapter.js`
- Create: `src/app/public/data/adapters/clinical-api-adapter.js`
- Create: `src/app/public/data/adapters/operations-api-adapter.js`
- Create: `src/app/public/data/adapters/admin-api-adapter.js`
- Modify: `src/app/public/data/contracts.js`
- Modify: `src/app/public/data/clinical-data-gateway.js`
- Modify: `src/app/public/app.js`
- Keep only for fixture tests: `src/app/public/data/adapters/local-clinical-adapter.js`
- Create: `test/api-adapters.test.js`
- Create: `test/runtime-source-of-truth.test.js`
- Modify: `test/data-gateway.test.js`

- [ ] RED: production `app.js` must not instantiate `createLocalClinicalAdapter`.
- [ ] RED: files under `src/app/public/features/` must not call `/api/*` directly.
- [ ] Implement one shared HTTP client that attaches status to errors so 401/403 can be handled centrally.
- [ ] Normalize backend records in adapters; do not make individual screens understand raw DB/API shapes.
- [ ] Gateway must expose auth, patients, intake/encounters, consents, outcomes, media/documents, protocols/evidence/engine, equipment/adaptation, sessions/body map, agenda, finance/reports and admin methods.
- [ ] Run `npm run check && npm run test:unit`.
- [ ] Commit:

```bash
git add src/app/public/data src/app/public/app.js test
git commit -m "feat: route main UI through persisted F0-F10 gateway"
```

---

### Task 5 — Add auth shell, permission-aware navigation and route-scoped loading

**Files**
- Create: `src/app/public/features/auth.js`
- Modify: `src/app/public/index.html`
- Modify: `src/app/public/app.js`
- Modify: `src/app/public/ui/navigation.js`
- Modify: `src/app/public/styles.css`
- Create: `test/navigation-rbac.test.js`
- Create: `test/e2e/auth-rbac-main.spec.js`

- [ ] RED E2E: setup/login/logout work in the existing main shell.
- [ ] RED E2E: Admin/Professional/Reception see only permitted routes.
- [ ] Replace unconditional `refreshAll()` with permission-aware, route-scoped loaders. Reception login must not request protocols, equipment, sessions, audit or clinical workspace data.
- [ ] Add `#auth-root`; keep the existing header/navigation/content chrome hidden until authenticated.
- [ ] A 401 transitions to login. A 403 shows an access message and does not destroy the shell.
- [ ] `Dashboard` must derive its cards from endpoints permitted to the current role rather than preloading every domain.
- [ ] `Audit` is Admin-only under the current RBAC matrix.
- [ ] Run:

```bash
npx playwright test test/e2e/auth-rbac-main.spec.js
npm run test:unit
```

- [ ] Commit:

```bash
git add src/app/public test
git commit -m "feat: integrate auth and permission-aware main shell"
```

---

### Task 6 — Integrate F1/F4/F5 into the existing patient experience

**Files**
- Modify: `src/app/public/features/patients.js`
- Modify: `src/app/public/features/patient-workspace.js`
- Modify: `src/app/public/features/clinical-intake.js`
- Modify: `src/app/public/features/evolution.js`
- Modify: `src/app/public/features/photos.js`
- Create: `src/app/public/features/documents.js`
- Create: `test/e2e/patient-clinical-workspace-integrated.spec.js`
- Create: `test/e2e/reception-patient-access.spec.js`

- [ ] RED Professional/Admin E2E: create patient → create encounter/assessment → consent → typed outcome → allowed image → PDF/document → reload → all records remain.
- [ ] RED Reception E2E: Reception can open/edit demographic data but no clinical tabs, timeline, outcomes, photos, protocols or sessions are requested/rendered.
- [ ] Map the Anamnese form to actual F1 fields (`chiefComplaint`, `history`, `medications`, `allergies`, `precautions`, `painScore`). Do not silently overload unrelated fields.
- [ ] Replace “rascunho local” and simulated consent copy/actions with real persisted behavior.
- [ ] Consent UI shows immutable acceptance/revocation history.
- [ ] Evolution exposes VAS, functional numeric, edema, ROM and text outcomes, with timeline/comparison and local SVG/polyline chart; no causal claims.
- [ ] Photos use backend media upload/integrity metadata. Local preview may exist only before/while uploading.
- [ ] `Documentos` generates/lists encounter PDFs instead of a placeholder.
- [ ] Keep C09 as a transient pre-session safety UI unless a documented F0–F10 persisted field exists; do not invent persistence just for the checklist.
- [ ] Run:

```bash
npm run test:unit
npx playwright test test/e2e/patients.spec.js test/e2e/patient-workspace.spec.js test/e2e/patient-clinical-workspace-integrated.spec.js test/e2e/reception-patient-access.spec.js
```

- [ ] Commit:

```bash
git add src/app/public/features test
git commit -m "feat: persist patient clinical workspace through F5"
```

---

### Task 7 — Integrate F2/F6/F8 into `Protocolos`

**Files**
- Modify: `src/app/public/features/f0-views.js`
- Modify: `src/app/public/features/dosimetry.js`
- Create: `src/app/public/features/protocol-search.js`
- Create: `src/app/public/features/evidence.js`
- Modify: `src/app/public/clinical.css`
- Create: `test/e2e/protocol-evidence-engine-integrated.spec.js`

- [ ] RED: exact immutable versions remain visible after creating a new version.
- [ ] RED: clinical search filters condition, symptom, body region, therapeutic goal, phase, age, professional area and wavelength deterministically.
- [ ] RED: no score, ranking, “melhor protocolo”, efficacy winner or auto-prescription language appears.
- [ ] RED: evidence links display the exact protocol version relationship.
- [ ] Keep one canonical top-level `Protocolos` route with internal sections `Biblioteca`, `Busca clínica`, `Evidências`; do not add F6/F8 top-level routes.
- [ ] Keep dosimetry as math from explicit professional inputs, never as a dose chooser.
- [ ] Run:

```bash
npx playwright test test/e2e/protocol-dosimetry.spec.js test/e2e/protocol-evidence-engine-integrated.spec.js
```

- [ ] Commit:

```bash
git add src/app/public/features src/app/public/clinical.css test
git commit -m "feat: integrate protocol evidence and clinical search UI"
```

---

### Task 8 — Integrate F3/F7 into `Equipamentos` and the guided `Sessões` workflow

**Files**
- Modify: `src/app/public/features/equipment-workspace.js`
- Modify: `src/app/public/features/treatment-workflow.js`
- Modify: `src/app/public/features/f0-views.js`
- Create: `src/app/public/features/body-map.js`
- Modify: `src/app/public/clinical.css`
- Create: `test/e2e/session-equipment-bodymap-integrated.spec.js`

- [ ] RED: create/select equipment and applicator with structured wavelength/power/spot/mode/frequency fields.
- [ ] RED: variable-power applicator requires explicit `selectedPowerMw`.
- [ ] RED: adaptation preview shows `referenceParameters` separately from `equipmentDerivedParameters` and leaves reference version unchanged.
- [ ] RED: body-map point is selected/confirmed in `Aplicação`, persisted against a real session, and visible after reload.
- [ ] RED: planned/applied snapshots and professional adjustment reason remain intact.
- [ ] Place adaptation in `Planejamento`; place body map in `Aplicação`; keep the existing five-stage session UX.
- [ ] Run:

```bash
npx playwright test test/e2e/equipment.spec.js test/e2e/treatment-workflow.spec.js test/e2e/session-equipment-bodymap-integrated.spec.js
```

- [ ] Commit:

```bash
git add src/app/public/features src/app/public/clinical.css test
git commit -m "feat: integrate equipment adaptation and body map workflow"
```

---

### Task 9 — Persist `Agenda` and add the F9 `Financeiro` route

**Files**
- Modify: `src/app/public/features/agenda.js`
- Create: `src/app/public/features/finance.js`
- Modify: `src/app/public/ui/navigation.js`
- Modify: `src/app/public/app.js`
- Modify: `src/app/public/styles.css`
- Create: `test/e2e/agenda-finance-integrated.spec.js`

- [ ] RED Agenda: recurring appointment persists after reload, status updates persist, and appointment completion does not auto-create a PBM session.
- [ ] Remove “somente local” behavior/copy and use appointment API through the gateway.
- [ ] Add `Financeiro` only for `finance.read` roles.
- [ ] Financeiro supports package creation, explicit consumption by a real patient session, payment creation, mark-paid and filters.
- [ ] RED integrity: package for patient A cannot be attached/consumed against patient B; UI reports the backend rejection and no partial write occurs.
- [ ] Run:

```bash
npx playwright test test/e2e/agenda.spec.js test/e2e/agenda-finance-integrated.spec.js
```

- [ ] Commit:

```bash
git add src/app/public/features src/app/public/ui src/app/public/app.js src/app/public/styles.css test
git commit -m "feat: persist agenda and add finance operations UI"
```

---

### Task 10 — Integrate F9 backend reports into existing `Relatórios`

**Files**
- Modify: `src/app/public/features/reports.js`
- Modify: `src/app/public/data/clinical-data-gateway.js`
- Modify: `test/operational-report.test.js`
- Create: `test/e2e/reports-integrated.spec.js`

- [ ] RED: paid and pending payments created in Financeiro are reflected in received/pending totals for the selected period.
- [ ] RED: session and patient operational counts come from persisted backend records.
- [ ] Runtime reports use `/api/reports/operations`; mixed local fallback is not used in production.
- [ ] Preserve descriptive-only copy: no efficacy, prognosis or clinical recommendation is derived from operational reports.
- [ ] Run:

```bash
npm run test:unit
npx playwright test test/e2e/reports.spec.js test/e2e/reports-integrated.spec.js
```

- [ ] Commit:

```bash
git add src/app/public/features/reports.js src/app/public/data test
git commit -m "feat: integrate persisted F9 operational reports"
```

---

### Task 11 — Replace placeholder `Configurações` with F10 `Administração`

**Files**
- Create: `src/app/public/features/admin.js`
- Modify: `src/app/public/ui/navigation.js`
- Modify: `src/app/public/app.js`
- Modify: `src/app/public/styles.css`
- Create: `test/e2e/admin-robustness-integrated.spec.js`

- [ ] RED Admin E2E: create account, assign role, disable account, revoke sessions, inspect SQLite/audit integrity, create verified backup, preview restore, filter audit and list media-retention candidates.
- [ ] RED non-admin: Professional/Reception neither see Administração nor succeed when calling its protected API directly.
- [ ] Replace the current placeholder settings route with `Administração` for Admin only. Do not expose an empty Configurações page to other roles.
- [ ] Restore remains verification/preview unless the existing F10 service explicitly supports a safe restore operation.
- [ ] Media retention lists candidates; it never auto-deletes files.
- [ ] Run:

```bash
npx playwright test test/e2e/auth-rbac-main.spec.js test/e2e/admin-robustness-integrated.spec.js
```

- [ ] Commit:

```bash
git add src/app/public/features/admin.js src/app/public/ui/navigation.js src/app/public/app.js src/app/public/styles.css test
git commit -m "feat: integrate F10 administration and robustness UI"
```

---

### Task 12 — Add global route, role, persistence and layout regression gates

**Files**
- Create: `test/e2e/all-routes-layout.spec.js`
- Create: `test/e2e/persistence-reload.spec.js`
- Modify: `playwright.config.js` to include explicit desktop and mobile projects if not already present.

- [ ] Traverse every visible route for each role and assert the current route renders a non-empty main panel.
- [ ] For Reception, assert network requests never include clinical-only endpoints during Dashboard, Pacientes, Agenda, Financeiro or Relatórios.
- [ ] For mutations to patient, outcome, consent, media, appointment, package and payment: perform through UI → reload → assert persisted value → restart test server against the same DB → assert again.
- [ ] At desktop and mobile (360–390 px wide), assert no horizontal document overflow.
- [ ] For every visible `input`, `select`, `textarea` and non-compact button, assert positive dimensions and minimum usable size; fields must be at least 88 px wide and 36 px high, textareas at least 72 px high.
- [ ] For every visible field, compare its rectangle against the nearest `.card`, `.form-grid`, `.workspace-panel`, `.treatment-stage-panel` or `main` container and assert it does not extend beyond that container by more than 1 px.
- [ ] Example geometry helper:

```js
const layout = await page.evaluate(() => ({
  viewport: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth,
  fields: [...document.querySelectorAll('input, select, textarea, button:not(.compact)')]
    .filter((el) => !el.hidden && getComputedStyle(el).display !== 'none')
    .map((el) => {
      const rect = el.getBoundingClientRect();
      const container = el.closest('.card, .form-grid, .workspace-panel, .treatment-stage-panel, main');
      const bounds = (container || document.documentElement).getBoundingClientRect();
      return {
        tag: el.tagName,
        width: rect.width,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        containerLeft: bounds.left,
        containerRight: bounds.right
      };
    })
}));
expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewport + 1);
for (const field of layout.fields) {
  expect(field.width).toBeGreaterThanOrEqual(88);
  expect(field.height).toBeGreaterThanOrEqual(field.tag === 'TEXTAREA' ? 72 : 36);
  expect(field.left).toBeGreaterThanOrEqual(field.containerLeft - 1);
  expect(field.right).toBeLessThanOrEqual(field.containerRight + 1);
}
```

- [ ] Run complete E2E:

```bash
npm run test:e2e
```

- [ ] Commit:

```bash
git add test/e2e playwright.config.js
git commit -m "test: cover integrated roles persistence and layout"
```

---

### Task 13 — Cleanup, documentation and final merge gate

**Files**
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/domain-model.md`
- Modify: `docs/reuse-map.md`
- Port: `docs/decisions/0002-roadmap-ends-f10-no-ai-rag.md`
- Remove any accidentally introduced phase-specific UI files or runtime local-adapter wiring.

- [ ] Search stale end-user copy:

```bash
grep -R "Somente local\|não persistido\|simular consentimento" src/app/public || true
```

Expected: none for functionality that is now persisted.

- [ ] Search forbidden F11 runtime references:

```bash
grep -R "F11\|AI/RAG" src README.md docs || true
```

Historical decision/spec mentions may remain only where they explicitly document removal; there must be no runtime module or future-roadmap claim.

- [ ] Search direct API access from feature modules:

```bash
grep -R "fetch(.*\/api\|api(.*\/api" src/app/public/features || true
```

Expected: features use gateway/adapters only.

- [ ] Search phase UI leakage:

```bash
find src/app/public -maxdepth 1 -type f -name 'f*-ui.js' -print
```

Expected: none required by integrated `index.html`.

- [ ] Review diff for: no paid runtime dependency; no auto-prescription/ranking; no reference-protocol mutation; no local clinical source of truth; no RBAC weakening.
- [ ] Commit documentation/cleanup:

```bash
git add README.md docs src/app/public test
git commit -m "docs: finalize integrated F0-F10 architecture"
```

- [ ] Run the final gate on that exact SHA:

```bash
npm run check && npm run test:unit && npm run test:e2e && npm run smoke
```

Only this green SHA may open the merge-ready PR to `main`.

---

## Execution dependencies and safe parallelism

**Serial foundation:** Task 1 → Task 2 → Task 3 → Task 4 → Task 5.

Only after auth/gateway contracts are stable may these workstreams run in isolated worktrees/branches:

- Task 6: patient clinical workspace
- Task 7: protocols/evidence/clinical engine
- Tasks 9–10: agenda/finance/reports
- Task 11: administration (depends on Task 5)

Task 8 depends on the protocol/equipment contracts stabilized by Task 7. Task 12 starts only after all visible surfaces are integrated. Task 13 is the final convergence gate.

## Merge rule

Do **not** merge `feat/f8-f10-clinical-ops-rbac` directly into `main`.

Merge only `feat/integrate-main-f0-f10` after all conditions below are true:

- every F0–F10 capability has a canonical UI location where applicable;
- the existing main UI architecture is preserved;
- production clinical/operational records are API/SQLite-backed;
- Admin/Professional/Reception route and API permissions pass;
- Reception never loads clinical-only patient data;
- legacy main E2E tests still pass or were changed only where integrated behavior intentionally superseded local simulation;
- persistence survives reload/restart;
- responsive no-overflow/no-clipping gate passes on all routes;
- `npm run check`, `npm run test:unit`, `npm run test:e2e` and `npm run smoke` are green on the same final commit.