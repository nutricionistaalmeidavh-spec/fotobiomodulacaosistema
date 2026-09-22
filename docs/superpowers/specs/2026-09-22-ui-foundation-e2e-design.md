# UI Foundation + E2E Design

Date: 2026-09-22

## Objective

Create the first reusable frontend foundation for the photobiomodulation system while backend/domain work continues independently. The UI must be functional with fixtures/mocks first, expose the planned clinical workflows visibly, and be covered by end-to-end tests from the first delivery.

## Constraints

- Core path must remain R$ 0, self-hosted and open source.
- No paid service may be a required dependency.
- Frontend work must not require the backend to be complete.
- Reuse portable patterns/components from `nutricionistaalmeidavh-spec/frontEnds`, not whole-product branding.
- Prefer a compact top navigation for this product; do not copy the clinic sidebar shell as the final shell.
- Preserve a future adapter boundary so fixtures can be replaced by real API/data providers without rewriting pages.
- UI must be responsive and usable on desktop and narrow screens.
- E2E coverage is part of the feature, not a later phase.

## Scope of this delivery

### UI-0 — Foundation

Create the web application shell and local design system:

- semantic tokens for primary, surface, text, muted, border, success, warning, danger and info;
- spacing/radius/focus conventions;
- reusable button variants;
- form fields and sections;
- status badges and clinical alerts;
- tables and empty states;
- dialogs/confirmation primitives;
- loading/skeleton/feedback primitives;
- compact top navigation with Lucide icons;
- responsive behavior for mobile widths.

The implementation should adapt concepts from these `frontEnds` kits:

- `library/clinic-ui-kit`
- `library/forms-kit`
- `library/tables-kit`
- `library/dashboard-kit`
- `library/navigation-kit`
- `library/dialogs-kit`
- `library/feedback-kit`

Do not copy product-specific branding from other applications.

### UI-1 — Dashboard + Patients

Dashboard with fixture-backed data:

- sessions today;
- active patients;
- pending follow-ups;
- frequently/recently used protocols;
- quick actions such as new patient, start session and browse protocols;
- recent activity list.

Patients surface:

- search;
- compact filters;
- responsive list/table;
- patient status;
- primary action to create a patient;
- empty state;
- create-patient dialog/form backed by local mock state.

### UI-2 — Patient Workspace

Create a patient-centered workspace with a persistent patient header and contextual navigation.

Initial tabs:

- Summary
- Anamnesis
- Protocols
- Sessions
- Evolution
- Photos
- Documents
- Consents

The first delivery does not need every tab to contain final business logic. It must, however, render each planned surface intentionally, with either fixture-backed content or a designed empty state, so E2E tests can guarantee that the planned product areas are visible and reachable.

Summary should include:

- basic identification;
- last/next session context;
- relevant clinical alerts;
- current protocol context when present;
- pending items;
- longitudinal activity timeline.

## Navigation model

Primary navigation uses a thin top bar:

- Dashboard
- Patients
- Agenda
- Protocols
- Equipment
- Reports
- Settings

Patient-specific navigation is local to the patient workspace and should not pollute the global navigation.

On narrow screens, primary navigation may collapse to an accessible menu/drawer, but critical actions and patient context must remain reachable without hover.

## Mock/data architecture

Use explicit frontend contracts rather than importing mock data directly into view components.

Suggested boundary:

```text
src/
  data/
    contracts.ts
    mock/
      patients.ts
      dashboard.ts
      protocols.ts
      sessions.ts
    providers/
      mock-provider.ts
```

Views consume a provider/interface. A future HTTP/backend provider can implement the same contract.

Do not silently create backend/database behavior in the mock provider.

## Component architecture

Suggested structure:

```text
apps/web/src/
  app/
  components/
    ui/
    clinical/
    navigation/
  features/
    dashboard/
    patients/
    patient-workspace/
  data/
  styles/
  test-fixtures/
```

Prefer focused components. Avoid monolithic page files with navigation, state, data fixtures and rendering all mixed together.

## UX rules

- One primary action per visual region.
- Dense but readable operational screens.
- Red/danger is reserved for clinically or operationally critical states and destructive actions.
- Motion communicates state/context only; no decorative continuous glow, particles or parallax in clinical workflows.
- Empty states should explain the next useful action.
- Critical clinical information must not depend on hover.
- Forms show label, required state, help/error text and keyboard-visible focus.
- Destructive actions require confirmation.

## E2E strategy

Use Playwright for browser E2E tests.

The E2E suite must run against deterministic fixture/mock data and cover at minimum:

### Shell/navigation

1. App loads the dashboard route without console/runtime errors.
2. All primary navigation entries are visible or reachable.
3. Navigation changes the visible page.
4. Narrow viewport exposes a usable mobile navigation path.

### Dashboard

5. Dashboard renders key metrics.
6. Dashboard renders recent activity.
7. Quick action to patients navigates correctly.

### Patients

8. Patients screen renders fixture records.
9. Search filters visible patients.
10. Empty search result shows a designed empty state.
11. Create-patient action opens a dialog/form.
12. Required-field validation is visible.
13. Valid mock patient creation updates the visible patient list/state without a backend.
14. Dialog can be closed by its explicit close/cancel control.

### Patient workspace

15. Opening a fixture patient renders the correct patient identity.
16. Every planned workspace tab is visible/reachable.
17. Switching tabs changes the active workspace content.
18. Summary shows timeline content.
19. Clinical alert fixture is rendered when present.
20. Empty-state tabs still render intentional copy/action rather than blank content.

### Accessibility/responsiveness smoke coverage

21. Main interactive controls are keyboard focusable.
22. Dialog exposes dialog semantics and can be dismissed through its UI.
23. Desktop and narrow viewport smoke tests complete without horizontal page overflow caused by the shell.

## Testability conventions

- Prefer accessible roles/names for selectors.
- Use `data-testid` only when semantic selectors are not stable enough.
- Do not make E2Es depend on arbitrary timeouts.
- Fixtures must be deterministic.
- Tests must not require external APIs, paid SaaS or network access other than the local app server.
- A passing E2E suite must not imply backend integration is complete.

## Unit/component tests

Where practical, add focused tests for:

- search/filter helpers;
- navigation registry;
- mock provider contract behavior;
- any pure status/tone mapping helpers.

E2E remains mandatory for the visible product flows above.

## Out of scope for this delivery

- real authentication;
- final database/API wiring;
- final protocol dosage calculation engine;
- real device/equipment integration;
- production clinical decision support;
- payment/subscription dependencies;
- external SaaS dependencies;
- final marketing/landing page.

These can be connected later through explicit adapters without replacing the UI foundation.

## Acceptance criteria

The delivery is acceptable when:

1. UI-0, UI-1 and UI-2 run locally from the repository.
2. Dashboard, Patients and Patient Workspace are navigable and visually coherent.
3. All planned workspace tabs are represented in the UI.
4. The frontend runs entirely with deterministic local fixtures/mocks.
5. Playwright E2Es cover the shell, dashboard, patients, patient workspace, form validation and responsive navigation.
6. Tests do not require paid services or external backend availability.
7. The implementation keeps a clear data-provider boundary for later backend integration.
8. No unrelated backend behavior is modified.
