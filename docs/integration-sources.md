# F0–F10 integration sources

This branch integrates the validated clinical/operational F0–F10 implementation into the current main UI architecture.

## Pinned authorities

- UI/navigation authority: `main@717bef304811b89f5450e7b9fb15a57ae7ecc26f`
- Clinical/domain/API authority: `feat/f8-f10-clinical-ops-rbac@11f3e12e0001996a94bc2ce3ad412dde56e62eba`
- Integration branch: `feat/integrate-main-f0-f10`, created from the pinned main SHA above.

## Ownership rule

`main` owns the visual shell, navigation model, feature modules, CSS, patient workspace and `ClinicalDataGateway` pattern. The clinical branch owns migrations, domain rules, services, HTTP contracts, authentication/RBAC, evidence/body-map rules, F9 operations and F10 robustness behavior.

The integration must transplant clinical behavior into the existing main architecture rather than replace main's UI.

## Runtime UI denylist

The following phase-specific files from the clinical branch must not be imported into the integrated runtime:

- `src/app/public/f2-ui.js`
- `src/app/public/f3-ui.js`
- `src/app/public/f4-ui.js`
- `src/app/public/f5-ui.js`
- `src/app/public/f6-ui.js`
- `src/app/public/f7-ui.js`
- `src/app/public/f8-ui.js`
- `src/app/public/f9-ui.js`
- `src/app/public/f10-ui.js`
- `src/app/public/f10-bootstrap.js`
- the clinical branch `src/app/public/index.html` shell

Their validated behavior may be represented through adapters and the canonical main feature modules, but their UI implementation is not a source of truth.

## Baseline verification

The pinned main SHA `717bef304811b89f5450e7b9fb15a57ae7ecc26f` passed GitHub Actions CI run `35814200295` with all workflow stages green: syntax check, unit/domain tests, browser E2E and smoke.

## Integration constraints

- Preserve the zero-cost, self-hosted/local-first core.
- No mandatory paid API or SaaS dependency.
- No F11/AI/RAG runtime scope; the functional roadmap ends at F10.
- No automatic prescription, dose recommendation, efficacy ranking or silent protocol mutation.
- Protocol versions stay immutable.
- Planned and applied treatment parameters stay separate snapshots.
- Server-side RBAC is authoritative.
- Persistent clinical/operational records use SQLite/API; the local clinical adapter may remain only for fixture tests.
