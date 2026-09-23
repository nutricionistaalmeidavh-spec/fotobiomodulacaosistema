# F8 Advanced Clinical Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement deterministic advanced clinical protocol search with age, professional-area, wavelength and real-applicator filters plus explicit contraindications.

**Architecture:** Add one F8 migration and `createF8Service()` composing F7. Extend F2 indication serialization for the new optional fields, expose one authenticated HTTP endpoint, and add a focused protocol-search UI module.

**Tech Stack:** Node.js 22, node:sqlite, native HTTP/HTML/CSS/JavaScript, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-23-f8-advanced-clinical-engine-design.md`

## Global Constraints

- Core remains R$ 0 and self-hosted.
- No IA, embeddings, RAG, vector database or paid API.
- No automatic prescription, dose selection or therapeutic ranking.
- ProtocolVersion remains immutable.
- Equipment adaptation never overwrites reference parameters.

## Review Focus

- Age boundary inclusivity at min/max years.
- Missing age/professional-area metadata must not invent restrictions.
- Applicator incompatibility must remain visible and not silently exclude without explanation.
- Contraindications must belong to the exact current protocol version.
- Text search must be deterministic and accent/case tolerant enough for existing pt-BR strings.

---

### Task 1: F8 schema and domain search

**Files:**
- Create: `src/db/migrations/0008_f8.sql`
- Create: `src/app/f8-service.js`
- Modify: `src/app/f2-service.js`
- Test: `test/f8-service.test.js`

**Interfaces:**
- Consumes: `createF7Service(db)`, `adaptProtocolVersion(protocolVersionId, applicatorId, selectedPowerMw)`.
- Produces: `createF8Service(db)` and `searchClinicalProtocols(filters)`.

- [ ] **Step 1: Write failing tests** for age/professional area/wavelength/applicator/contraindications and status `F8`.
- [ ] **Step 2: Run `npm run test:unit`** and verify F8 tests fail because service/migration are absent.
- [ ] **Step 3: Add migration and minimal service implementation**; extend F2 indication mapping/creation/copy to preserve `minAgeYears`, `maxAgeYears`, `professionalArea`.
- [ ] **Step 4: Run `npm run test:unit`** and verify the full suite passes.
- [ ] **Step 5: Commit** `feat: add F8 deterministic clinical engine`.

### Task 2: F8 HTTP and UI

**Files:**
- Modify: `src/app/server.js`
- Create: `src/app/public/f8-ui.js`
- Modify: `src/app/public/index.html`
- Test: `test/f8-http.test.js`
- Test: `test/e2e/f8.spec.js`

**Interfaces:**
- Consumes: `searchClinicalProtocols(filters)`.
- Produces: `GET /api/clinical-engine/protocols` and the Protocolos advanced-search panel.

- [ ] **Step 1: Write failing HTTP and Playwright tests** proving auth, filters, contraindication checklist and no recommendation copy.
- [ ] **Step 2: Run tests and verify RED**.
- [ ] **Step 3: Wire server route, boot service as F8, add UI module and script include**.
- [ ] **Step 4: Run `npm run check`, `npm run test:unit`, `npm run test:e2e`, `npm run smoke`** and verify GREEN.
- [ ] **Step 5: Commit** `feat: expose F8 advanced clinical search`.
