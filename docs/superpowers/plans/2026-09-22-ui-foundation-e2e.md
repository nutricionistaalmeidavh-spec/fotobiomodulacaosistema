# UI Foundation + E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver UI-0, UI-1 and UI-2 for the photobiomodulation system with a reusable zero-cost frontend foundation, deterministic frontend fixtures, patient-centered workspace and mandatory Playwright E2E coverage while preserving all F0 clinical invariants.

**Architecture:** Keep the repository's existing native HTML/CSS/ES-module frontend and Node/SQLite backend instead of introducing a second React build system. Split the current monolithic browser code into small ES modules for navigation, UI primitives, mock data/provider, dashboard, patients and patient workspace. F0 Protocols, Equipment, Sessions and Audit continue using the existing HTTP API; the new UI-1/UI-2 surfaces consume an explicit in-browser provider contract so they can later switch to an HTTP provider without rewriting views.

**Tech Stack:** Node.js 22+, native ES modules, HTML/CSS, SQLite via `node:sqlite`, Playwright 1.55+, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-22-ui-foundation-e2e-design.md`

## Global Constraints

- Core path must remain R$ 0, self-hosted and open source.
- No paid service may be a required dependency.
- Frontend work must not require the backend to be complete.
- Reuse portable UI/UX patterns from `nutricionistaalmeidavh-spec/frontEnds`; do not copy another product's branding.
- Keep compact top navigation; do not introduce the clinic sidebar as the final shell.
- Preserve an adapter boundary between views and fixture/backend data.
- Desktop and narrow/mobile widths must be usable without horizontal shell overflow.
- Playwright E2E is mandatory in this delivery.
- Do not modify F0 domain invariants: immutable protocol versions, exact session-to-version history, planned/applied parameter separation, mandatory professional justification for changes, append-only audit.
- No final dosage engine, device integration, authentication, subscription, external SaaS or production clinical decision support in this plan.

## File Structure

New focused browser modules:

```text
src/app/public/
  app.js                         # composition/root state only
  index.html                     # shell landmarks and top navigation
  styles.css                     # global tokens/layout + imported component classes
  ui/
    primitives.js                # badges, empty state, dialog, field markup helpers
    navigation.js                # primary route registry + mobile menu behavior
  data/
    contracts.js                 # provider contract validation/documentation helpers
    fixtures.js                  # deterministic UI-1/UI-2 fixture dataset
    mock-provider.js             # mutable in-memory provider for browser UI
  features/
    dashboard.js                 # dashboard template/actions
    patients.js                  # patient list/search/create dialog
    patient-workspace.js         # workspace header/tabs/summary and empty surfaces
    f0-views.js                  # existing protocols/equipment/sessions/audit templates/actions
```

Tests:

```text
test/
  ui-helpers.test.js             # navigation/search/provider pure contracts
  ui-contract.test.js            # static UI route/invariant contract
  e2e/
    f0-regression.spec.js         # preserved F0 protocol/session/audit behavior
    ui-foundation.spec.js         # shell/dashboard/responsive behavior
    patients.spec.js              # search/create/dialog validation
    patient-workspace.spec.js     # identity/tabs/timeline/alerts/empty states
```

No backend/database files are changed unless a regression exposes a pre-existing issue; UI mock patient creation remains browser-only.

## Review Focus

1. **Patient names containing HTML-like text:** render escaped text and never execute it; covered by provider/helper unit test and patient rendering E2E.
2. **Empty patient search result:** render an intentional empty state with a clear recovery action instead of an empty table; covered by Patients E2E.
3. **Duplicate/blank patient creation:** blank required name must be blocked and a valid mock record must receive a deterministic unique local ID; covered by provider unit test and Patients E2E.
4. **Mobile navigation at 390 px:** all required global routes remain reachable after collapse and the document has no horizontal shell overflow; covered by Foundation E2E.
5. **F0 regression while refactoring app.js:** protocol versioning, treatment-session justification and audit-chain flows continue passing their existing browser E2Es; covered by dedicated regression E2E.

---

### Task 1: Extract reusable browser foundation without changing F0 behavior

**Files:**
- Create: `src/app/public/ui/navigation.js`
- Create: `src/app/public/ui/primitives.js`
- Create: `src/app/public/features/f0-views.js`
- Modify: `src/app/public/app.js`
- Modify: `src/app/public/index.html`
- Modify: `src/app/public/styles.css`
- Modify: `test/ui-contract.test.js`
- Test: `test/e2e/f0-regression.spec.js`

**Interfaces:**
- Produces: `PRIMARY_NAV_ITEMS`, `renderPrimaryNavigation(activeRoute)`, `setMobileNavOpen(open)`, UI markup helpers (`statusBadge`, `emptyState`, `dialogFrame`, `fieldMessage`), and `createF0Views(context)`.
- Consumes: existing `/api/status`, `/api/equipment`, `/api/protocols`, `/api/sessions`, `/api/audit` endpoints unchanged.

- [ ] **Step 1: Write failing static contract tests**

Add assertions that `app.js` imports focused modules and that navigation registry contains `dashboard`, `patients`, `agenda`, `protocols`, `equipment`, `reports`, `settings`; also assert F0 views still expose `sessions` and `audit` through explicit secondary routes/actions.

- [ ] **Step 2: Write F0 regression E2E before refactor**

Move/copy the existing protocol, session and audit browser scenarios into `test/e2e/f0-regression.spec.js`; selectors must use roles/names where practical and keep the safety assertions:

```js
await expect(page.getByText('Ajuste documental E2E')).toBeVisible();
await expect(page.locator('[data-edit-protocol-version]')).toHaveCount(0);
await expect(page.getByText(/Informe o motivo profissional/i)).toBeVisible();
await expect(page.getByText('Cadeia íntegra', { exact: true })).toBeVisible();
```

- [ ] **Step 3: Run tests and confirm the new contract fails before implementation**

Run: `npm run test:unit`
Expected: new navigation/module-contract assertions fail while existing F0 tests pass.

- [ ] **Step 4: Extract navigation/primitives/F0 renderers**

Keep API calls and F0 action behavior semantically unchanged. `app.js` becomes the composition root: state, provider initialization, route dispatch, refresh and event delegation only.

- [ ] **Step 5: Add semantic design tokens and compact top navigation**

Define CSS custom properties for primary/surface/text/muted/border/success/warning/danger/info, spacing, radius and focus. Add a mobile menu button with `aria-expanded`, `aria-controls` and visible keyboard focus. No external font/CDN/icon dependency is required; small inline SVG icons may be local markup.

- [ ] **Step 6: Run F0 + syntax tests**

Run: `npm run check && npm run test:unit && npm run test:e2e`
Expected: all previous F0 invariants remain green.

- [ ] **Step 7: Commit**

```bash
git add src/app/public test/ui-contract.test.js test/e2e/f0-regression.spec.js
git commit -m "refactor: extract reusable UI foundation"
```

### Task 2: Add deterministic frontend data provider and dashboard

**Files:**
- Create: `src/app/public/data/contracts.js`
- Create: `src/app/public/data/fixtures.js`
- Create: `src/app/public/data/mock-provider.js`
- Create: `src/app/public/features/dashboard.js`
- Create: `test/ui-helpers.test.js`
- Create: `test/e2e/ui-foundation.spec.js`
- Modify: `src/app/public/app.js`

**Interfaces:**
- Produces `createMockUiProvider(seed?)` with methods:
  - `getDashboard(): DashboardSnapshot`
  - `listPatients(): PatientSummary[]`
  - `getPatient(id): PatientDetail | null`
  - `createPatient(input): PatientDetail`
- Provider objects are copied on read so view code cannot mutate fixture source accidentally.

- [ ] **Step 1: Write failing provider tests**

Cover deterministic dashboard values, copied return values, unique local patient ID generation and preservation of special-character patient names as plain strings.

- [ ] **Step 2: Run provider test and verify failure**

Run: `node --test test/ui-helpers.test.js`
Expected: FAIL because provider modules do not exist.

- [ ] **Step 3: Implement fixture/provider contract**

Use local deterministic data only. Fixture examples must include at least two patients, one patient with a clinical warning, recent activity, next/last session context, pending follow-up and a current protocol label. No `fetch()` call belongs in the mock provider.

- [ ] **Step 4: Implement dashboard view**

Render operational metrics (`Sessões hoje`, `Pacientes ativos`, `Retornos pendentes`, `Protocolos recentes`), quick actions and recent activity. Quick action `Ver pacientes` must route through the app navigation function rather than hard reload.

- [ ] **Step 5: Add dashboard E2E**

Assert app-ready without console/runtime errors, all required primary routes reachable, metrics visible, recent activity visible, quick action navigates to Patients, and desktop shell has no overflow.

- [ ] **Step 6: Run tests**

Run: `node --test test/ui-helpers.test.js && npx playwright test test/e2e/ui-foundation.spec.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/public/data src/app/public/features/dashboard.js src/app/public/app.js test/ui-helpers.test.js test/e2e/ui-foundation.spec.js
git commit -m "feat: add fixture-backed operational dashboard"
```

### Task 3: Build Patients search, filters and mock create flow

**Files:**
- Create: `src/app/public/features/patients.js`
- Modify: `src/app/public/ui/primitives.js`
- Modify: `src/app/public/app.js`
- Modify: `src/app/public/styles.css`
- Modify: `test/ui-helpers.test.js`
- Create: `test/e2e/patients.spec.js`

**Interfaces:**
- Produces `filterPatients(patients, query, status)` pure helper.
- Produces `createPatientsView({ provider, onOpenPatient, onChanged })` renderer/action binder.
- Consumes provider `listPatients()` and `createPatient(input)` only; no direct fixture imports in the view.

- [ ] **Step 1: Write failing search helper tests**

Cases: accent/case-insensitive name search, no match, status `active`, empty query, and special-character text remaining data rather than markup.

- [ ] **Step 2: Run helper tests to verify failure**

Run: `node --test test/ui-helpers.test.js`
Expected: FAIL on missing `filterPatients` export.

- [ ] **Step 3: Implement list/search/filter UI**

Use a responsive table on desktop and stacked row treatment at narrow width. Empty search result uses `emptyState` with `Limpar busca` action.

- [ ] **Step 4: Implement accessible create-patient dialog**

Dialog requirements: `role="dialog"`, `aria-modal="true"`, labelled title, explicit close button, Cancel button, required Name field, optional phone/email/notes. Blank name sets inline error and focuses the invalid field. Valid submission updates provider state and the visible list without server/database writes.

- [ ] **Step 5: Add Patients E2E**

Cover fixture rows, search, empty state, dialog opening, blank-name validation, valid creation, new patient visible, close/cancel behavior, and malicious-looking text rendered literally.

- [ ] **Step 6: Run tests**

Run: `node --test test/ui-helpers.test.js && npx playwright test test/e2e/patients.spec.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/public/features/patients.js src/app/public/ui/primitives.js src/app/public/app.js src/app/public/styles.css test/ui-helpers.test.js test/e2e/patients.spec.js
git commit -m "feat: add patient list and mock create flow"
```

### Task 4: Build patient-centered workspace with all planned tabs

**Files:**
- Create: `src/app/public/features/patient-workspace.js`
- Modify: `src/app/public/data/fixtures.js`
- Modify: `src/app/public/data/mock-provider.js`
- Modify: `src/app/public/app.js`
- Modify: `src/app/public/styles.css`
- Create: `test/e2e/patient-workspace.spec.js`

**Interfaces:**
- Produces `WORKSPACE_TABS` with exact IDs: `summary`, `anamnesis`, `protocols`, `sessions`, `evolution`, `photos`, `documents`, `consents`.
- Produces `createPatientWorkspaceView({ patient, activeTab, onTabChange, onBack })`.
- Consumes `PatientDetail` fields for identity, clinical alerts, last/next session, current protocol, pending items and timeline.

- [ ] **Step 1: Write failing E2E for patient workspace**

Open a fixture patient from Patients and assert correct patient identity; all eight tabs visible/reachable; Summary timeline and clinical warning visible; switching each tab updates the active panel; fixture-empty Photos/Documents/Consents show designed empty-state copy.

- [ ] **Step 2: Run workspace E2E and verify failure**

Run: `npx playwright test test/e2e/patient-workspace.spec.js`
Expected: FAIL because workspace route/view is not implemented.

- [ ] **Step 3: Implement patient header + local tab navigation**

Keep identity/context visible at top. Patient tabs are local and must not modify global top navigation registry.

- [ ] **Step 4: Implement Summary**

Render basic data, last/next session cards, warning only when fixture has alert, current protocol, pending item list and chronological timeline using adapted `clinic-ui-kit` composition patterns.

- [ ] **Step 5: Implement intentional placeholder/fixture surfaces for remaining tabs**

Anamnesis, Protocols, Sessions and Evolution may render fixture summaries; Photos, Documents and Consents may render empty states. No tab may render a blank container.

- [ ] **Step 6: Run workspace + full E2E**

Run: `npx playwright test test/e2e/patient-workspace.spec.js && npm run test:e2e`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/public/features/patient-workspace.js src/app/public/data src/app/public/app.js src/app/public/styles.css test/e2e/patient-workspace.spec.js
git commit -m "feat: add patient clinical workspace"
```

### Task 5: Complete responsive/accessibility coverage and placeholders for global planned routes

**Files:**
- Create: `src/app/public/features/planned-routes.js`
- Modify: `src/app/public/app.js`
- Modify: `src/app/public/styles.css`
- Modify: `test/e2e/ui-foundation.spec.js`
- Modify: `test/ui-contract.test.js`

**Interfaces:**
- Produces designed nonblank surfaces for `agenda`, `reports`, `settings` without inventing backend behavior.
- Mobile menu toggles through one controlled state and closes after route selection.

- [ ] **Step 1: Extend E2E first**

At 390×844 assert mobile menu control is keyboard/click reachable, required primary entries are reachable, selecting Agenda changes heading/content, interactive controls can receive keyboard focus, and:

```js
const overflow = await page.evaluate(() =>
  document.documentElement.scrollWidth - document.documentElement.clientWidth
);
expect(overflow).toBeLessThanOrEqual(1);
```

- [ ] **Step 2: Implement planned route placeholders and mobile menu behavior**

Each placeholder explains the future module and current boundary. Do not simulate backend writes.

- [ ] **Step 3: Add focus-visible and responsive rules**

Ensure no critical information is hover-only; table wrappers may scroll internally but the page shell may not overflow globally.

- [ ] **Step 4: Run targeted E2E**

Run: `npx playwright test test/e2e/ui-foundation.spec.js`
Expected: PASS on desktop and narrow viewport scenarios.

- [ ] **Step 5: Commit**

```bash
git add src/app/public/features/planned-routes.js src/app/public/app.js src/app/public/styles.css test/e2e/ui-foundation.spec.js test/ui-contract.test.js
git commit -m "feat: complete responsive UI foundation"
```

### Task 6: Full regression, docs and acceptance verification

**Files:**
- Modify: `README.md`
- Modify: `docs/reuse-map.md`
- Modify: `test/e2e/ui.spec.js` (remove obsolete duplicates or convert to thin smoke test; do not duplicate the new suites)

**Interfaces:**
- No new runtime interface. This task validates the combined delivery.

- [ ] **Step 1: Update README state without claiming backend completion**

Document UI-0/UI-1/UI-2 as fixture-backed parallel frontend work; explicitly state mock patient creation is not persisted and does not mean F1 backend is complete.

- [ ] **Step 2: Update reuse map**

Record which UX patterns were adapted from `frontEnds`: clinic status/timeline/patient header concepts, forms, dashboard, tables, navigation, dialogs and feedback; note no external product branding/code dependency was introduced.

- [ ] **Step 3: Run syntax and unit suite**

Run: `npm run check && npm run test:unit`
Expected: PASS.

- [ ] **Step 4: Run complete Playwright suite**

Run: `npm run test:e2e`
Expected: PASS for F0 regression plus all 23+ UI acceptance scenarios.

- [ ] **Step 5: Run smoke**

Run: `npm run smoke`
Expected: `F0 OK: 19 tabelas carregadas.`

- [ ] **Step 6: Inspect changed files for backend isolation**

Expected: no changes under `src/db/`, `src/domain/`, `src/core/`, migrations, or F0 service/server business rules.

- [ ] **Step 7: Final commit**

```bash
git add README.md docs/reuse-map.md test/e2e/ui.spec.js
git commit -m "docs: document parallel UI foundation"
```

## Self-review

- **Spec coverage:** UI-0, dashboard, Patients, patient workspace, all eight workspace tabs, seven required global routes, deterministic fixture provider, responsive behavior and mandatory E2E are assigned to Tasks 1–5; Task 6 verifies acceptance.
- **Backend isolation:** plan intentionally leaves `src/db`, `src/domain`, `src/core`, migrations and F0 service semantics untouched.
- **F0 regressions:** extracted before refactor and rerun through the final full suite.
- **Placeholder scan:** no implementation step depends on an unspecified TODO/TBD.
- **Type/interface consistency:** mock provider methods and workspace tab IDs are defined once above and consumed consistently by later tasks.
- **Review Focus coverage:** special-character rendering, empty search, required create validation/ID behavior, mobile overflow/navigation and F0 regression each have explicit owning tests.
