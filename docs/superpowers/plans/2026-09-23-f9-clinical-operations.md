# F9 Clinical Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement local agenda, treatment packages, payments and descriptive operational reports.

**Architecture:** Add an F9 migration and `createF9Service()` composing F8. Keep operational data separate from clinical records, expose authenticated HTTP endpoints, then add top-navigation UI surfaces for Agenda, Financeiro and Relatórios.

**Tech Stack:** Node.js 22, node:sqlite, native HTTP/HTML/CSS/JavaScript, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-23-f9-clinical-operations-design.md`

## Global Constraints

- No external payment provider is required.
- Money is persisted as integer cents.
- Appointment completion never creates a PBM session.
- Package consumption requires an existing real treatment session.
- Reports are descriptive, not predictive or causal.

## Review Focus

- Recurring appointment generation must reject invalid counts/intervals.
- Duplicate package consumption of the same session must fail.
- Payment state transitions must reject non-positive values and double-pay ambiguity.
- Date-period filters must be deterministic and inclusive.
- Cancelled records must not be counted as received revenue.

---

### Task 1: F9 operational domain

**Files:**
- Create: `src/db/migrations/0009_f9.sql`
- Create: `src/app/f9-service.js`
- Test: `test/f9-service.test.js`

**Interfaces:**
- Consumes: `createF8Service(db)` and existing patient/session/professional/equipment/protocol tables.
- Produces: appointment/package/payment/report service methods and status `F9`.

- [ ] Write failing service/schema tests for appointments, recurrence, packages, consumption, payments and reports.
- [ ] Run `npm run test:unit` and verify RED.
- [ ] Implement migration and minimal service methods with audited mutations.
- [ ] Run the full unit suite and verify GREEN.
- [ ] Commit `feat: add F9 clinical operations domain`.

### Task 2: F9 HTTP and UI

**Files:**
- Modify: `src/app/server.js`
- Create: `src/app/public/f9-ui.js`
- Modify: `src/app/public/index.html`
- Modify: `src/app/public/styles.css`
- Test: `test/f9-http.test.js`
- Test: `test/e2e/f9.spec.js`

**Interfaces:**
- Consumes: F9 service methods.
- Produces: appointment/package/payment/report routes and Agenda/Financeiro/Relatórios UI.

- [ ] Write failing HTTP/E2E tests for CRUD/status, package consumption, payment and period report.
- [ ] Run tests and verify RED.
- [ ] Add authenticated routes and responsive top-nav UI surfaces.
- [ ] Run `npm run check`, unit, E2E and smoke and verify GREEN.
- [ ] Commit `feat: expose F9 agenda finance and reports`.
