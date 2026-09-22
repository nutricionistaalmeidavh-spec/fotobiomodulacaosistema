# UI-3 to UI-6 Clinical Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the remaining patient-workspace placeholders with usable clinical UI for anamnesis, consent/C09, dosimetry, equipment context and guided treatment sessions while preserving F0 backend invariants.

**Architecture:** Keep `patient-workspace.js` as an orchestrator and move each clinical surface into focused browser modules. Reuse the existing real F0 API for protocols, equipment and session writes; use deterministic local UI state for anamnesis/consent/C09 until dedicated persistence exists. Calculations are transparent arithmetic helpers only and never generate treatment recommendations.

**Tech Stack:** HTML/CSS, browser ES modules, Node test runner, Playwright, existing local Node/SQLite F0 service.

**Spec:** `docs/superpowers/specs/2026-09-22-ui-foundation-e2e-design.md`

## Global Constraints

- Core remains R$0, self-hosted and open source.
- No paid service or third-party API dependency.
- No automated diagnosis, treatment recommendation or silent clinical decision.
- Protocol versions remain immutable; session planned/applied parameters remain separate; audit remains append-only.
- UI-only clinical data must be visibly identified as local/non-persisted until backend support exists.

## Review Focus

- Invalid/zero dosimetry inputs must not produce Infinity/NaN or a clinical recommendation.
- C09 must not present a patient as automatically cleared by software.
- Consent/anamnesis local changes must not claim persistence.
- Session submission must retain the existing professional-adjustment requirement when applied energy differs from planned.
- Mobile layouts must not add global horizontal overflow.

---

### Task 1: UI-3 Anamnesis + Consent + C09

**Files:**
- Create: `src/app/public/features/clinical-intake.js`
- Modify: `src/app/public/features/patient-workspace.js`
- Modify: `src/app/public/data/fixtures.js`
- Modify: `src/app/public/data/mock-provider.js`
- Test: `test/clinical-ui.test.js`
- Test: `test/e2e/clinical-intake.spec.js`

**Interfaces:**
- Produces `createClinicalIntakePanels({ provider, patientId, onChanged })` with `anamnesis()`, `consents()`, `safetyChecklist()` and `bindActions(root)`.

- [ ] Write unit/E2E tests that require structured anamnesis fields, explicit local-state notice, consent status/history and a C09 checklist with professional confirmation wording.
- [ ] Run CI and verify RED because the module does not exist.
- [ ] Implement local fixture/provider state and panels without backend writes.
- [ ] Run full CI and verify GREEN.

### Task 2: UI-4 Protocols + Dosimetry Calculator

**Files:**
- Create: `src/app/public/features/dosimetry.js`
- Modify: `src/app/public/features/f0-views.js`
- Test: `test/dosimetry.test.js`
- Test: `test/e2e/protocol-dosimetry.spec.js`

**Interfaces:**
- Produces `calculateDosimetry({ powerMw, timeSeconds, areaCm2, energyJ })` and `renderDosimetryCalculator()`.
- Uses only arithmetic relationships: `energyJ = powerMw/1000 * timeSeconds`, `fluenceJcm2 = energyJ/areaCm2`, and optional `timeSeconds = energyJ/(powerMw/1000)`.

- [ ] Write tests for valid calculations and invalid/zero inputs.
- [ ] Verify RED.
- [ ] Add calculator beside the real versioned protocol library with explicit “calculation only; not a recommendation” copy.
- [ ] Verify GREEN and protocol-version regression tests.

### Task 3: UI-5 Equipment Workspace

**Files:**
- Create: `src/app/public/features/equipment-workspace.js`
- Modify: `src/app/public/features/f0-views.js`
- Test: `test/equipment-ui.test.js`
- Test: `test/e2e/equipment.spec.js`

**Interfaces:**
- Produces `renderEquipmentWorkspace(equipment)` and `equipmentReadiness(item)` based only on documented technical fields.

- [ ] Write tests requiring technical cards/table, wavelength/power/applicator visibility and neutral missing-data state.
- [ ] Verify RED.
- [ ] Render the real `/api/equipment` data without inventing compatibility claims.
- [ ] Verify GREEN.

### Task 4: UI-6 Guided Treatment Session

**Files:**
- Create: `src/app/public/features/treatment-workflow.js`
- Modify: `src/app/public/features/f0-views.js`
- Modify: `src/app/public/app.js`
- Test: `test/treatment-workflow-ui.test.js`
- Test: `test/e2e/treatment-workflow.spec.js`

**Interfaces:**
- Produces five explicit stages: `planning`, `safety`, `application`, `record`, `evolution`.
- Final record continues to call existing `/api/sessions`; C09/local notes do not claim backend persistence.

- [ ] Write E2E first for stage navigation, required professional adjustment reason, and successful real F0 session record.
- [ ] Verify RED.
- [ ] Implement guided stages while retaining existing session POST contract and audit behavior.
- [ ] Verify GREEN with full F0 regression suite.

### Task 5: Responsive polish and final verification

**Files:**
- Modify: `src/app/public/styles.css`
- Modify: `README.md`
- Test: all existing and new suites.

- [ ] Add responsive rules for intake grids, dosimetry, equipment and session stages.
- [ ] Run `npm run check`, `npm run test:unit`, `npm run test:e2e`, `npm run smoke` through CI.
- [ ] Confirm 0 failures and document UI-3–UI-6 boundaries/status.
