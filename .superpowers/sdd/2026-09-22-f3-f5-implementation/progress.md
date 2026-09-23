# SDD ledger — plan: docs/superpowers/plans/2026-09-22-f3-f5-implementation.md

Execution mode: Native
Isolation ruling: this environment exposes GitHub branch operations but no persistent local git worktree; `feat/f3-f5-mvp-outcomes` is the isolated workspace equivalent for this run. The ledger will be deleted before branch finishing.

Pre-flight shared interfaces:
- Task 1 -> Task 3: `0004_f3.sql` equipment/applicator fields feed `f3-service.js`; aligned with spec.
- Task 2 -> Task 3: `adaptProtocolToApplicator()` feeds `adaptProtocolVersion()`; aligned with spec.
- Task 3 -> Tasks 4-7: F4 composes F3 and must preserve equipment/adaptation API; aligned.
- Tasks 4-7 -> Tasks 8-10: F5 composes F4 and extends patient timeline/outcomes; aligned.

Ruling: variable-power applicators require explicit `selectedPowerMw`; fixed power may be used automatically. This prevents the system from silently choosing a clinical power setting.
Ruling: SQLite backup snapshots use `VACUUM INTO` before hashing/export, not a raw copy of an open database.
Ruling: F4 includes basic narrative evolution entries in the patient workspace before F5 adds typed longitudinal measures.

Task 1: complete (RED 5bb2854: missing equipment.notes; GREEN ce989b0; CI 35801065744: syntax/unit/E2E/smoke success)
Task 2: complete (RED e5e4935: equipment-adaptation module absent; GREEN 1efbbc7; CI 35801288001: syntax/unit/E2E/smoke success)
