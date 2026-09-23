# F10 Multiprofessional RBAC Robustness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local clinic membership, server-enforced RBAC, account/session administration, integrity checks and controlled backup/restore preparation.

**Architecture:** Add an F10 migration, extend auth to resolve clinic membership, add a centralized permission matrix and `createF10Service()` composing F9. Enforce permission checks server-side by route family and expose an admin-only UI.

**Tech Stack:** Node.js 22, node:sqlite, scrypt auth, native HTTP/HTML/CSS/JavaScript, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-23-f10-multiprofessional-rbac-robustness-design.md`

## Global Constraints

- Authorization is enforced by the backend, never inferred from UI visibility.
- Admin/professional/reception are the only F10 roles.
- No secrets, password hashes or session token hashes are returned or audited.
- Existing clinical audit remains append-only.
- Restore never silently overwrites the open database.
- No IA/RAG/SaaS dependency is introduced.

## Review Focus

- Reception must be denied clinical workspace/encounter/outcome/media/consent/session operations.
- Professional must be denied administrative finance/account/backup operations.
- Disabled accounts must stop authenticating immediately.
- Revoking sessions must invalidate all active cookies for the target account.
- Restore preview must reject a tampered backup before any file copy.

---

### Task 1: F10 clinic membership and RBAC core

**Files:**
- Create: `src/db/migrations/0010_f10.sql`
- Create: `src/core/rbac.js`
- Modify: `src/app/auth-service.js`
- Create: `src/app/f10-service.js`
- Test: `test/f10-rbac.test.js`

**Interfaces:**
- Consumes: `createF9Service(db)`, existing auth accounts/sessions and F4 backup functions.
- Produces: effective membership role, permission checks, account/session/integrity administration and status `F10`.

- [ ] Write failing tests for role matrix, account creation, disable, session revocation, integrity and retention candidates.
- [ ] Run unit suite and verify RED.
- [ ] Implement migration/RBAC/auth/service minimally.
- [ ] Run full unit suite and verify GREEN.
- [ ] Commit `feat: add F10 clinic RBAC and robustness core`.

### Task 2: F10 HTTP authorization and administration UI

**Files:**
- Modify: `src/app/server.js`
- Create: `src/app/public/f10-ui.js`
- Modify: `src/app/public/index.html`
- Modify: `src/app/public/styles.css`
- Test: `test/f10-http.test.js`
- Test: `test/e2e/f10.spec.js`

**Interfaces:**
- Consumes: effective user permissions and F10 admin service methods.
- Produces: server-enforced authorization and Administration surface.

- [ ] Write failing HTTP/E2E tests for admin allowed, professional restricted, reception denied clinical records, session revocation and integrity UI.
- [ ] Run tests and verify RED.
- [ ] Wire permission guards, admin routes and responsive UI.
- [ ] Run `npm run check`, unit, E2E and smoke and verify GREEN.
- [ ] Commit `feat: enforce F10 RBAC and admin operations`.

### Task 3: Final documentation and roadmap gate

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/domain-model.md`
- Confirm: `docs/decisions/0002-roadmap-ends-f10-no-ai-rag.md`

- [ ] Document F8–F10 and state that the canonical roadmap ends at F10.
- [ ] Search documentation/code for roadmap claims that schedule F11/AI/RAG and remove/replace them where they are current-roadmap text.
- [ ] Run `npm run check`, `npm run test:unit`, `npm run test:e2e`, `npm run smoke` on the same final commit.
- [ ] Verify no runtime dependency or code path for LLM/RAG/vector databases exists.
- [ ] Commit `docs: close roadmap at F10 without AI RAG`.
