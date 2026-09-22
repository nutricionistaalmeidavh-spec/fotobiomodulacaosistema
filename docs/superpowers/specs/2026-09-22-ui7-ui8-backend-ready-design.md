# UI-7 / UI-8 + Backend-Ready Data Architecture

Date: 2026-09-22
Branch: `feat/ui7-ui8-backend-ready`
Base: `main` at `d7d03cd7447a1da4ffc4b7c2066dd46c2b82a0a1`

## Objective

Finish the planned frontend through UI-8 while preparing a stable data boundary for future backend integration. The UI must not know whether a capability is currently backed by the persisted F0 API or by deterministic local state.

The result must preserve the existing F0 clinical invariants, keep the core self-hosted/open-source/R$0, and make future backend work primarily an adapter implementation problem instead of a screen rewrite.

## Current State

The current application has:

- UI-0 through UI-6 implemented;
- real F0 API-backed Protocols, Equipment, Sessions and Audit;
- local/mock-backed Patients, Anamnesis, Consent and C09;
- patient workspace tabs for Evolution and Photos, but they are not yet complete workflows;
- Agenda and Reports as planned-route placeholders;
- `app.js` directly calling `/api/...` for F0 data while also instantiating a separate mock provider.

The architectural problem to solve is this split data access model: presentation code should not continue gaining direct knowledge of storage or transport.

## Architectural Decision

Adopt a gateway + adapters architecture.

```text
UI / Features
    |
    v
ClinicalDataGateway
    |-- F0ApiAdapter
    |     |-- protocols
    |     |-- equipment
    |     |-- sessions
    |     `-- audit
    |
    `-- LocalClinicalAdapter
          |-- patients / intake
          |-- evolution
          |-- photo metadata
          |-- agenda
          `-- report fixtures / derived local data
```

A feature consumes only gateway methods and normalized domain-shaped results. It must not directly call `fetch('/api/...')`.

The adapters may be replaced incrementally. A future persisted Agenda adapter can replace the local Agenda implementation while Evolution remains local, without changing Agenda UI code.

## Data Contracts

Create an explicit contract module for all frontend-facing data capabilities. The gateway should expose operations equivalent to:

### Patient and clinical context

- `listPatients()`
- `getPatient(patientId)`
- `createPatient(input)`
- `getClinicalIntake(patientId)`
- `updateAnamnesis(patientId, patch)`
- `updateConsent(patientId, patch)`
- `updateSafetyChecklist(patientId, patch)`

### Evolution

- `listEvolution(patientId, filters?)`
- `addEvolution(patientId, input)`

Evolution records must include stable identifiers, timestamp/date, type/category, title or summary, notes/description, optional session/protocol references, and `source` metadata (`local` or `persisted`).

### Photos

- `listPhotos(patientId)`
- `addPhotoMetadata(patientId, input)`
- `removePhotoMetadata(patientId, photoId)`

Photo metadata should be backend-ready and allow future fields such as `fileId`, `storageUrl`, `sessionId`, region/site, captured date and observation. The current implementation must not claim that a photo is durably uploaded when it is only local preview/metadata.

### Agenda

- `listAgenda(filters?)`
- `createAgendaItem(input)`
- `updateAgendaItem(itemId, patch)`

Agenda item status is limited to explicit operational states such as scheduled, completed and cancelled. The UI must not create clinical conclusions from scheduling status.

### Reports

- `getOperationalReport(filters?)`

Reports remain operational/descriptive. They may include session count, active patients, pending follow-ups, protocol usage and planned-vs-applied divergence counts, but must not score treatment effectiveness or make clinical recommendations.

### Persisted F0 capabilities

- `listProtocols()`
- `createProtocol(input)`
- `createProtocolVersion(protocolId, input)`
- `listEquipment()`
- `listSessions()`
- `createSession(input)`
- `listAuditEvents()` / `getAuditState()`
- `getFoundationStatus()`

These are backed by the existing HTTP API through `F0ApiAdapter`.

## Gateway Behavior

`ClinicalDataGateway` composes one or more adapters behind one interface.

Responsibilities:

- validate required adapter capabilities at construction time;
- normalize return shapes;
- expose feature-facing operations;
- preserve source metadata where it matters to user expectations;
- propagate actionable errors without silently substituting persistence;
- allow adapter substitution without changing feature modules.

It must not contain clinical recommendation logic.

## UI-7 — Evolution

The Evolution tab becomes a real interactive frontend workflow.

### Required behavior

- longitudinal timeline/list;
- filter by type/category;
- filter by date or simple period when meaningful;
- add a local evolution entry;
- optional relationship display to session/protocol metadata when available;
- visibly distinguish local/draft data from persisted data;
- explicit empty state;
- no automatic interpretation, effectiveness score or diagnosis.

New local evolution entries remain in the local adapter until a future backend adapter is supplied.

## UI-7 — Photos

The Photos tab becomes a metadata-first clinical photo workspace.

### Required behavior

- grid/list of photo records;
- local preview when a browser-selected file can be represented safely;
- metadata: date, region/site, optional session reference and observation;
- add local photo metadata;
- remove local photo metadata with confirmation;
- explicit marker that local-only items are not persisted uploads;
- empty state and mobile behavior.

No external storage service is required.

## UI-8 — Agenda

Replace the Agenda placeholder with an operational agenda module.

### Required behavior

- list by day/period;
- patient name/context;
- scheduled date/time;
- status filter;
- create agenda item locally;
- update explicit operational status;
- open patient workspace when a linked local patient exists;
- clear local-source marker until a persisted adapter exists.

The module must consume the gateway only.

## UI-8 — Reports

Replace the Reports placeholder with operational reports.

### Required behavior

- period controls;
- session count;
- active patient count;
- pending follow-up count;
- protocol usage summary;
- planned-vs-applied divergence count based on available session data;
- deterministic values in tests;
- explanatory copy that reports are descriptive/operational.

No treatment ranking, efficacy score or automated clinical recommendation is allowed.

## UI-8 — Audit

Preserve the real append-only F0 audit trail but route it through the gateway/API adapter.

### Required behavior

- integrity state remains prominent;
- filters by action/entity and, if data permits, date;
- chronological/reverse chronological browsing;
- hash/entity information remains inspectable;
- no local adapter may masquerade as the persisted F0 audit chain.

## App Composition Refactor

`app.js` should become composition/orchestration only.

It should:

- construct adapters;
- construct the gateway;
- create feature views with gateway dependencies;
- coordinate navigation and application-level rerendering.

It should no longer own a generic `api()` function used by feature code, nor directly populate F0 datasets through raw API calls as the permanent architecture.

Existing F0 presentation modules should progressively consume gateway methods rather than `state + api` plumbing.

## Source-of-Truth Rules

Every user-visible mutable record introduced by UI-7/UI-8 must have a clear source:

- `persisted`: backed by the existing real F0 API/database; or
- `local`: browser/session-memory adapter state, clearly labeled where persistence could otherwise be assumed.

The product must never display a local-only write as though it were durably stored.

## Error Handling

- Adapter/network failures render a usable error state or application flash message.
- A failed persisted write must not be converted into a local success silently.
- Local operations validate required fields before mutation.
- Lists render explicit empty states.
- UI stays navigable if one optional/local dataset is empty.

## Accessibility and Responsive Behavior

- semantic roles/names first;
- keyboard reachable controls;
- confirmations for destructive photo removal;
- no critical information dependent on hover;
- desktop and narrow viewport without global horizontal overflow;
- local/persisted markers readable without relying on color alone.

## Testing Strategy

### Unit / contract tests

- gateway validates adapters;
- gateway delegates to correct adapter;
- normalized result/source metadata;
- local evolution CRUD behavior;
- local photo metadata add/remove behavior;
- agenda create/update/filter behavior;
- operational report derivation;
- F0 API adapter maps endpoint responses into gateway contract;
- invalid adapter methods fail clearly.

### Playwright E2E

Evolution:

1. open patient Evolution tab;
2. add local evolution record;
3. record appears in timeline;
4. local-source marker visible;
5. category/date filtering works;
6. empty-state path is intentional.

Photos:

7. open Photos tab;
8. add local photo metadata/preview path;
9. metadata renders;
10. local-only status is explicit;
11. removal requires confirmation;
12. removal updates the UI.

Agenda:

13. Agenda is no longer a placeholder;
14. create local agenda item;
15. filter by status;
16. update status;
17. linked patient opens workspace;
18. mobile layout remains usable.

Reports:

19. Reports is no longer a placeholder;
20. operational metrics render deterministically;
21. period controls update displayed report data;
22. descriptive/no-recommendation boundary remains visible.

Audit / gateway regression:

23. real audit route remains integrity-aware;
24. audit filter works;
25. protocol create/version remains append-only;
26. session planned/applied divergence still requires professional reason;
27. no new feature module directly calls `/api/`;
28. app initializes through the gateway;
29. desktop shell has no global overflow;
30. narrow/mobile navigation and new modules remain usable.

All existing UI-0 through UI-6 and F0 regressions remain part of the final CI suite.

## Proposed File Boundaries

```text
src/app/public/
  data/
    contracts.js
    clinical-data-gateway.js
    adapters/
      f0-api-adapter.js
      local-clinical-adapter.js
    fixtures.js
  features/
    evolution.js
    photos.js
    agenda.js
    reports.js
    audit.js            # optional extraction from f0-views
    patient-workspace.js
    f0-views.js
  app.js
```

Exact extraction may be adjusted if the current repository structure makes a smaller focused boundary clearer, but feature code must retain gateway-only data access.

## Out of Scope

- implementing the future persisted patient/anamnesis/evolution/photo/agenda backend;
- authentication/authorization redesign;
- external object storage;
- paid APIs or SaaS requirements;
- AI clinical decision support;
- automated diagnosis or treatment recommendation;
- real cloud deployment changes.

## Acceptance Criteria

1. UI-7 Evolution and Photos are functional, intentional surfaces with deterministic local state where backend persistence does not exist.
2. UI-8 Agenda and Reports are functional and no longer placeholders.
3. Audit continues to use the real F0 persisted chain.
4. All feature modules obtain data through `ClinicalDataGateway` rather than calling HTTP endpoints directly.
5. F0 persisted capabilities are exposed through `F0ApiAdapter`.
6. Non-persisted capabilities are exposed through `LocalClinicalAdapter` and clearly marked as local in persistence-sensitive contexts.
7. Replacing a local adapter capability with a future backend implementation does not require rewriting the feature UI contract.
8. Existing F0 clinical invariants remain unchanged.
9. Existing UI-0 through UI-6 functionality remains covered and operable.
10. Unit/contract, Playwright E2E, syntax and smoke checks are green before integration.
11. No paid runtime dependency or external SaaS becomes mandatory.
12. README/documentation describes the adapter boundary and what remains local versus persisted.
