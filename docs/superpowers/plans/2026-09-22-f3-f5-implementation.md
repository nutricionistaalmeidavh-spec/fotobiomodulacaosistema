# F3–F5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar F3, F4 e F5 em sequência sobre a F2 verde: adaptação por equipamento, fechamento do MVP operacional e evolução clínica longitudinal.

**Architecture:** Preservar a composição já usada na F2. `f3-service.js` compõe `f2-service.js`; `f4-service.js` compõe F3; `f5-service.js` compõe F4. Cada fase ganha migration própria, contratos de serviço/HTTP/UI e só ativa o servidor depois que seu gate RED→GREEN estiver verde.

**Tech Stack:** Node.js >= 22.5, `node:sqlite`, HTTP nativo do Node, HTML/CSS/JS sem framework, Playwright 1.55 para E2E, SHA-256 para integridade, filesystem local para mídia/PDF/backup.

**Spec:** `docs/superpowers/specs/2026-09-22-f3-f5-design.md`

## Global Constraints

- Core R$0, self-hosted e sem dependência obrigatória de APIs pagas.
- Nenhuma prescrição automática e nenhuma recomendação automática de dose.
- O protocolo de referência nunca é sobrescrito pela adaptação ao equipamento.
- Sessão deve preservar snapshots separados de parâmetros planejados e aplicados.
- Mudanças clínicas relevantes exigem justificativa e auditoria.
- Histórico clínico/versionado permanece imutável.
- Sem body map visual, biblioteca científica aprofundada, IA/RAG, agenda/financeiro completo ou RBAC avançado nesta entrega.
- Cada fase deve passar por RED → GREEN → regressão completa antes da próxima.

## Review Focus

1. **Equipamento incompatível com o protocolo** — a adaptação deve retornar `warnings` e nunca fabricar compatibilidade; Task 2 testa wavelength/mode/frequency incompatíveis.
2. **Mídia clínica inválida ou grande demais** — upload local deve rejeitar MIME não permitido, base64 inválido e payload > 5 MiB decodificado; Task 5 testa os três casos.
3. **Consentimento revogado** — revogação não pode apagar o aceite original nem permitir mutação destrutiva; Task 4 testa histórico accepted→revoked.
4. **Backup incompleto/corrompido** — manifest deve listar DB/arquivos com SHA-256 e verificação deve falhar se um item mudar; Task 6 testa adulteração.
5. **Escalas clínicas fora do domínio** — EVA/VAS deve aceitar apenas 0–10 e ROM/medidas devem exigir número finito; Task 8 testa limites e valores inválidos.

---

### Task 1: F3 migration e modelo persistente de equipamento/aplicador

**Files:**
- Create: `src/db/migrations/0004_f3.sql`
- Create: `test/f3-equipment-schema.test.js`
- Modify: `test/schema.test.js`

**Interfaces:**
- Consumes: tabelas `equipment`, `applicators`, `treatment_sessions` criadas em `0001_f0.sql`.
- Produces: colunas estruturadas para capacidade do equipamento e índices usados por `f3-service.js`.

- [ ] **Step 1: Write the failing schema tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/db/database.js';

test('F3 adds structured equipment/applicator capability fields', () => {
  const db = openDatabase(':memory:');
  const equipment = db.prepare("PRAGMA table_info('equipment')").all().map((r) => r.name);
  const applicators = db.prepare("PRAGMA table_info('applicators')").all().map((r) => r.name);
  assert.ok(equipment.includes('notes'));
  assert.ok(applicators.includes('min_power_mw'));
  assert.ok(applicators.includes('fixed_power_mw'));
  assert.ok(applicators.includes('frequencies_json'));
  assert.ok(applicators.includes('limitations'));
  db.close();
});
```

- [ ] **Step 2: Run the test to verify RED**

Run: `node --test test/f3-equipment-schema.test.js`
Expected: FAIL because F3 columns/migration do not exist.

- [ ] **Step 3: Add migration `0004_f3.sql`**

```sql
ALTER TABLE equipment ADD COLUMN notes TEXT;
ALTER TABLE applicators ADD COLUMN min_power_mw REAL CHECK (min_power_mw IS NULL OR min_power_mw > 0);
ALTER TABLE applicators ADD COLUMN fixed_power_mw REAL CHECK (fixed_power_mw IS NULL OR fixed_power_mw > 0);
ALTER TABLE applicators ADD COLUMN frequencies_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE applicators ADD COLUMN limitations TEXT;

CREATE INDEX idx_equipment_owner_active ON equipment(owner_professional_id, active);
CREATE INDEX idx_applicators_equipment_active ON applicators(equipment_id, active);
```

- [ ] **Step 4: Advance migration regression expectation**

Update `test/schema.test.js` so the persistent DB expects:

```js
['0001_f0', '0002_f1', '0003_f2', '0004_f3']
```

- [ ] **Step 5: Run unit regression**

Run: `npm run test:unit`
Expected: all existing tests + F3 schema test PASS.

- [ ] **Step 6: Commit**

```bash
git add src/db/migrations/0004_f3.sql test/f3-equipment-schema.test.js test/schema.test.js
git commit -m "feat: add F3 equipment capability schema"
```

### Task 2: F3 deterministic compatibility/adaptation engine

**Files:**
- Create: `src/domain/equipment-adaptation.js`
- Create: `test/f3-adaptation.test.js`

**Interfaces:**
- Consumes: `referenceParameters` from F2 normalized PBM protocol version and one persisted applicator.
- Produces: `adaptProtocolToApplicator({ referenceParameters, applicator }) -> { compatible, referenceParameters, equipmentDerivedParameters, warnings }`.

- [ ] **Step 1: Write RED tests for compatible adaptation**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptProtocolToApplicator } from '../src/domain/equipment-adaptation.js';

test('F3 derives time without mutating reference protocol', () => {
  const reference = Object.freeze({ wavelengthNm: 808, energyJ: 4, powerMw: 100, timeS: 40, areaCm2: 0.5, mode: 'continuous', frequencyHz: null });
  const result = adaptProtocolToApplicator({
    referenceParameters: reference,
    applicator: { wavelengthNm: 808, fixedPowerMw: 200, spotAreaCm2: 0.5, modes: ['continuous'], frequenciesHz: [] }
  });
  assert.equal(result.compatible, true);
  assert.equal(result.equipmentDerivedParameters.timeS, 20);
  assert.equal(result.equipmentDerivedParameters.energyJ, 4);
  assert.equal(reference.timeS, 40);
});
```

- [ ] **Step 2: Add RED tests for incompatibilities**

```js
assert.deepEqual(
  adaptProtocolToApplicator({ referenceParameters: { wavelengthNm: 808, energyJ: 4, mode: 'continuous' }, applicator: { wavelengthNm: 660, fixedPowerMw: 100, modes: ['continuous'] } }).warnings,
  ['wavelength_incompatible']
);
```

Also cover:
- protocol `pulsed` with applicator continuous-only → `mode_incompatible`;
- pulsed frequency absent from supported list → `frequency_incompatible`;
- no usable power → `power_missing`;
- no spot area → derived irradiance/fluence are `null`, with `spot_area_missing` warning.

- [ ] **Step 3: Run RED**

Run: `node --test test/f3-adaptation.test.js`
Expected: FAIL because module does not exist.

- [ ] **Step 4: Implement minimal deterministic engine**

```js
function round(value) { return Number(Number(value).toFixed(6)); }

export function adaptProtocolToApplicator({ referenceParameters, applicator }) {
  const warnings = [];
  if (Number(referenceParameters.wavelengthNm) !== Number(applicator.wavelengthNm)) warnings.push('wavelength_incompatible');
  if (!(applicator.modes || []).includes(referenceParameters.mode)) warnings.push('mode_incompatible');
  if (referenceParameters.mode === 'pulsed' && referenceParameters.frequencyHz != null && !(applicator.frequenciesHz || []).includes(referenceParameters.frequencyHz)) warnings.push('frequency_incompatible');

  const powerMw = Number(applicator.fixedPowerMw || applicator.maxPowerMw || 0);
  if (!(powerMw > 0)) warnings.push('power_missing');
  const areaCm2 = Number(applicator.spotAreaCm2 || 0);
  if (!(areaCm2 > 0)) warnings.push('spot_area_missing');

  const energyJ = Number(referenceParameters.energyJ);
  const timeS = powerMw > 0 && energyJ > 0 ? round((energyJ * 1000) / powerMw) : null;
  const irradianceMwCm2 = powerMw > 0 && areaCm2 > 0 ? round(powerMw / areaCm2) : null;
  const fluenceJcm2 = energyJ > 0 && areaCm2 > 0 ? round(energyJ / areaCm2) : null;

  return Object.freeze({
    compatible: !warnings.some((w) => ['wavelength_incompatible', 'mode_incompatible', 'frequency_incompatible', 'power_missing'].includes(w)),
    referenceParameters,
    equipmentDerivedParameters: { powerMw: powerMw || null, timeS, energyJ: energyJ || null, areaCm2: areaCm2 || null, irradianceMwCm2, fluenceJcm2 },
    warnings
  });
}
```

- [ ] **Step 5: Run GREEN**

Run: `node --test test/f3-adaptation.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/equipment-adaptation.js test/f3-adaptation.test.js
git commit -m "feat: add deterministic equipment adaptation engine"
```

### Task 3: F3 service, HTTP API, UI e E2E gate

**Files:**
- Create: `src/app/f3-service.js`
- Create: `src/app/public/f3-ui.js`
- Create: `test/f3-service-http.test.js`
- Modify: `src/app/server.js`
- Modify: `src/app/public/index.html`
- Modify: `test/e2e/ui.spec.js`

**Interfaces:**
- Consumes: `createF2Service(db)`, `adaptProtocolToApplicator()`.
- Produces:
  - `createF3Service(db)`
  - `createEquipment(input, actorId)`
  - `updateEquipment(id, input, actorId)`
  - `createApplicator(equipmentId, input, actorId)`
  - `listEquipmentDetailed()`
  - `adaptProtocolVersion(protocolVersionId, applicatorId)`
  - HTTP: `POST /api/equipment`, `PATCH /api/equipment/:id`, `POST /api/equipment/:id/applicators`, `POST /api/protocol-versions/:id/adapt`.

- [ ] **Step 1: Write failing service/HTTP tests**

Create an equipment + applicator, create an 808 nm F2 protocol, call adaptation and assert:

```js
assert.equal(result.referenceParameters.energyJ, 4);
assert.equal(result.equipmentDerivedParameters.timeS, 20);
assert.equal(result.referenceParameters.timeS, 40);
assert.equal(result.compatible, true);
```

HTTP must return `phase: 'F3'`.

- [ ] **Step 2: Run RED**

Run: `node --test test/f3-service-http.test.js`
Expected: FAIL because F3 service/routes do not exist.

- [ ] **Step 3: Implement `f3-service.js` by composition**

Use:

```js
export function createF3Service(db) {
  const base = createF2Service(db);
  return {
    ...base,
    getStatus() { return { ...base.getStatus(), phase: 'F3' }; },
    createEquipment,
    updateEquipment,
    createApplicator,
    listEquipmentDetailed,
    adaptProtocolVersion
  };
}
```

All writes append audit events: `equipment.created`, `equipment.updated`, `applicator.created`, `protocol.adapted_previewed`.

- [ ] **Step 4: Activate F3 in server and add routes**

Replace `createF2Service` with `createF3Service`. Add authenticated JSON routes listed above. `POST /api/protocol-versions/:id/adapt` body:

```json
{ "applicatorId": "..." }
```

- [ ] **Step 5: Run service/HTTP GREEN and full unit regression**

Run: `npm run test:unit`
Expected: all tests PASS.

- [ ] **Step 6: Add F3 UI module**

`f3-ui.js` owns only equipment/adaptation UX:
- Equipamentos: create/edit/archive + applicators;
- Protocolos: selector of applicator next to current protocol and preview with two columns: `Referência` vs `Calculado para equipamento`;
- warnings shown as neutral compatibility notices, never as automatic clinical recommendation.

- [ ] **Step 7: Add E2E F3 scenario**

Playwright flow:
1. create equipment `Laser F3`;
2. create 808 nm applicator, fixed 200 mW, spot 0.5 cm²;
3. open structured protocol 4 J;
4. select applicator;
5. assert reference time `40 s` and derived time `20 s` simultaneously;
6. assert no reference field changed;
7. create incompatible 660 nm applicator and assert visible `wavelength_incompatible` warning.

- [ ] **Step 8: Run F3 gate**

Run in order:

```bash
npm run check
npm run test:unit
npm run test:e2e
npm run smoke
```

Expected: all PASS on the same commit.

- [ ] **Step 9: Commit**

```bash
git add src/app/f3-service.js src/app/server.js src/app/public/f3-ui.js src/app/public/index.html test/f3-service-http.test.js test/e2e/ui.spec.js
git commit -m "feat: complete F3 equipment adaptation workflow"
```

### Task 4: F4 migration + consent model/version history

**Files:**
- Create: `src/db/migrations/0005_f4.sql`
- Create: `test/f4-consent.test.js`
- Modify: `test/schema.test.js`

**Interfaces:**
- Consumes: existing `consents`, `clinical_media`, `documents`, `application_points`.
- Produces: immutable consent history and document/media metadata required by F4.

- [ ] **Step 1: Write RED consent tests**

Assert accepted consent can be followed by a revoked record without UPDATE/DELETE of the original.

```js
assert.equal(history[0].status, 'accepted');
assert.equal(history[1].status, 'revoked');
assert.throws(() => db.prepare('DELETE FROM consents WHERE id = ?').run(history[0].id), /immutable/i);
```

- [ ] **Step 2: Run RED**

Run: `node --test test/f4-consent.test.js`
Expected: FAIL because immutability trigger/F4 columns are absent.

- [ ] **Step 3: Add `0005_f4.sql`**

```sql
ALTER TABLE clinical_media ADD COLUMN original_filename TEXT;
ALTER TABLE clinical_media ADD COLUMN mime_type TEXT;
ALTER TABLE clinical_media ADD COLUMN byte_size INTEGER;
ALTER TABLE documents ADD COLUMN sha256 TEXT;

CREATE TRIGGER consents_immutable_update
BEFORE UPDATE ON consents BEGIN
  SELECT RAISE(ABORT, 'consents are immutable; append a new consent event');
END;

CREATE TRIGGER consents_immutable_delete
BEFORE DELETE ON consents BEGIN
  SELECT RAISE(ABORT, 'consents are immutable; append a new consent event');
END;
```

- [ ] **Step 4: Advance migration expectation to `0005_f4`**

- [ ] **Step 5: Run GREEN**

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/db/migrations/0005_f4.sql test/f4-consent.test.js test/schema.test.js
git commit -m "feat: add F4 consent and clinical asset schema"
```

### Task 5: F4 local clinical media + consent service

**Files:**
- Create: `src/app/f4-service.js`
- Create: `src/core/clinical-storage.js`
- Create: `test/f4-assets.test.js`
- Modify: `src/app/server.js`

**Interfaces:**
- Consumes: `createF3Service(db)` and a storage root, default `data/clinical-assets`.
- Produces:
  - `createF4Service(db, { storageRoot })`
  - `acceptConsent(input, actorId)`
  - `revokeConsent(consentId, reason, actorId)`
  - `listConsents(patientId)`
  - `storeClinicalImage({ patientId, encounterId, sessionId, fileName, mimeType, dataBase64, caption }, actorId)`
  - `listClinicalMedia(patientId)`.

- [ ] **Step 1: Write RED storage validation tests**

Test accepted MIME types: `image/jpeg`, `image/png`, `image/webp`.

Reject:

```js
await assert.rejects(() => storeClinicalImage({ mimeType: 'text/html', dataBase64: '...' }), /mime/i);
await assert.rejects(() => storeClinicalImage({ mimeType: 'image/jpeg', dataBase64: 'not-base64!!' }), /base64/i);
```

Generate a decoded buffer > 5 MiB and assert `/5 MiB/i` rejection.

- [ ] **Step 2: Run RED**

Run: `node --test test/f4-assets.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement local storage helper**

`clinical-storage.js` must:
- decode strict base64;
- validate MIME whitelist;
- cap decoded image at 5 MiB;
- write to `storageRoot/media/<patientId>/<uuid>.<ext>`;
- calculate SHA-256 from bytes;
- return `{ relativePath, sha256, byteSize }`.

- [ ] **Step 4: Implement F4 consent/media methods by composition**

Consent revocation appends a second consent row with `status='revoked'`, `version` copied from accepted record, `evidence_json` containing `{ previousConsentId, reason }`.

- [ ] **Step 5: Add HTTP routes**

Authenticated routes:
- `GET /api/patients/:id/consents`
- `POST /api/patients/:id/consents`
- `POST /api/consents/:id/revoke`
- `GET /api/patients/:id/media`
- `POST /api/patients/:id/media`

Switch server to `createF4Service`; `/api/status` must become F4.

- [ ] **Step 6: Run GREEN/regression**

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/f4-service.js src/core/clinical-storage.js src/app/server.js test/f4-assets.test.js
git commit -m "feat: add local consent and clinical media workflows"
```

### Task 6: F4 PDF + local backup with integrity manifest

**Files:**
- Create: `src/core/pdf.js`
- Create: `src/core/backup.js`
- Create: `test/f4-export.test.js`
- Modify: `src/app/f4-service.js`
- Modify: `src/app/server.js`

**Interfaces:**
- Produces:
  - `generateEncounterPdf({ encounter, patient, sessions, protocols, equipment, outcomes }) -> Buffer`
  - `createBackup({ dbFile, assetRoot, destinationRoot }) -> { backupPath, manifest }`
  - `verifyBackup(backupPath) -> { valid, errors }`
  - service methods `finalizeEncounterPdf(encounterId, actorId)`, `createLocalBackup(actorId)`.

- [ ] **Step 1: Write RED PDF tests**

Generated buffer must start `%PDF-`, contain a final `%%EOF`, and generated document row must be `status='finalized'` with SHA-256 and storage path.

- [ ] **Step 2: Write RED backup tests**

Backup directory contract:

```text
backup-<timestamp>/
  clinical.sqlite
  clinical-assets/...
  manifest.json
```

`manifest.json`:

```json
{
  "version": 1,
  "createdAt": "ISO-8601",
  "files": [{ "path": "clinical.sqlite", "sha256": "...", "bytes": 123 }]
}
```

After modifying one copied file, `verifyBackup()` must return `{ valid: false }`.

- [ ] **Step 3: Run RED**

Run: `node --test test/f4-export.test.js`
Expected: FAIL.

- [ ] **Step 4: Implement minimal PDF writer without external dependency**

`pdf.js` creates a single-page/multi-line text PDF using built-in Helvetica and escapes `(`, `)`, `\\`. Content must include patient, encounter date, protocol/version, equipment/applicator, planned/applied parameters and recorded outcomes.

- [ ] **Step 5: Implement backup helper**

Use `fs.cpSync`/`fs.copyFileSync`, recursive file enumeration, SHA-256, stable relative paths and manifest verification.

- [ ] **Step 6: Add service methods + routes**

Routes:
- `POST /api/encounters/:id/pdf`
- `POST /api/backup`
- `POST /api/backup/verify` with `{ backupPath }` restricted to paths created under configured backup root.

- [ ] **Step 7: Run GREEN**

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/core/pdf.js src/core/backup.js src/app/f4-service.js src/app/server.js test/f4-export.test.js
git commit -m "feat: add local clinical PDF and verified backup"
```

### Task 7: F4 MVP UI, application points and full E2E milestone

**Files:**
- Create: `src/app/public/f4-ui.js`
- Modify: `src/app/public/index.html`
- Modify: `src/app/f4-service.js`
- Modify: `src/app/server.js`
- Modify: `test/e2e/ui.spec.js`

**Interfaces:**
- Adds `recordApplicationPoint(sessionId, { sequenceNumber, bodyRegion, anatomicalLabel, parameters }, actorId)`.
- HTTP: `POST /api/sessions/:id/application-points`.

- [ ] **Step 1: Write RED E2E for complete MVP flow**

Scenario must perform:
1. login;
2. create patient;
3. accept consent;
4. create/open encounter;
5. select F2 protocol;
6. select F3 equipment/applicator and preview adaptation;
7. create treatment session using confirmed derived planning snapshot;
8. add at least two textual application points;
9. upload one small fixture image;
10. record a basic outcome/narrative;
11. finalize encounter PDF;
12. create backup;
13. open patient history and assert consent, session, points, image metadata, document and audit are visible.

- [ ] **Step 2: Run RED**

Run: `npm run test:e2e`
Expected: FAIL on missing F4 controls/routes.

- [ ] **Step 3: Implement application point write path**

Persist `sequence_number`, `body_region`, `anatomical_label`, `parameters_json`, `applied_at` and audit `application_point.created`.

- [ ] **Step 4: Implement `f4-ui.js`**

Add focused UI blocks inside patient/session workspace:
- consent card;
- media upload card;
- application points editor;
- `Gerar PDF` action;
- `Criar backup local` action.

No cloud buttons or implicit sync.

- [ ] **Step 5: Mark MVP in UI/status**

`getStatus()` returns F4 plus `milestone: 'MVP'`; shell badge renders `F4 · MVP`.

- [ ] **Step 6: Run F4 gate**

```bash
npm run check
npm run test:unit
npm run test:e2e
npm run smoke
```

Expected: all PASS on one commit.

- [ ] **Step 7: Commit**

```bash
git add src/app/public/f4-ui.js src/app/public/index.html src/app/f4-service.js src/app/server.js test/e2e/ui.spec.js
git commit -m "feat: complete F4 MVP clinical workflow"
```

### Task 8: F5 migration + outcome validation domain

**Files:**
- Create: `src/db/migrations/0006_f5.sql`
- Create: `src/domain/outcomes.js`
- Create: `test/f5-outcomes.test.js`
- Modify: `test/schema.test.js`

**Interfaces:**
- Consumes existing `outcomes` table.
- Produces `normalizeOutcome(input)` and responsible-professional link.

- [ ] **Step 1: Write RED validation tests**

```js
import { normalizeOutcome } from '../src/domain/outcomes.js';

assert.deepEqual(normalizeOutcome({ type: 'vas_pain', value: 7 }), { type: 'vas_pain', value: 7, unit: '0-10', narrative: null });
assert.throws(() => normalizeOutcome({ type: 'vas_pain', value: 11 }), /0.*10/i);
assert.throws(() => normalizeOutcome({ type: 'rom', value: Number.NaN, unit: 'deg' }), /finite/i);
```

Also test custom numeric and structured text outcome.

- [ ] **Step 2: Run RED**

Run: `node --test test/f5-outcomes.test.js`
Expected: FAIL.

- [ ] **Step 3: Add `0006_f5.sql`**

```sql
ALTER TABLE outcomes ADD COLUMN professional_id TEXT REFERENCES professionals(id) ON DELETE RESTRICT;
ALTER TABLE outcomes ADD COLUMN baseline_group TEXT;
CREATE INDEX idx_outcomes_patient_type_time ON outcomes(patient_id, metric_type, measured_at);
```

Advance migration expectation to `0006_f5`.

- [ ] **Step 4: Implement `normalizeOutcome`**

Supported canonical types:
- `vas_pain`: numeric 0–10, unit `0-10`;
- `functional_numeric`: finite numeric, user-provided unit optional;
- `edema`: finite numeric, unit required;
- `rom`: finite numeric, unit `deg` by default;
- `text`: `value=null`, non-empty narrative required.

- [ ] **Step 5: Run GREEN**

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/db/migrations/0006_f5.sql src/domain/outcomes.js test/f5-outcomes.test.js test/schema.test.js
git commit -m "feat: add F5 outcome validation model"
```

### Task 9: F5 service/API, timeline and comparison series

**Files:**
- Create: `src/app/f5-service.js`
- Create: `test/f5-service-http.test.js`
- Modify: `src/app/server.js`

**Interfaces:**
- Consumes: `createF4Service(db, options)` and `normalizeOutcome()`.
- Produces:
  - `recordOutcome(input, actorId)`
  - `listPatientOutcomes(patientId)`
  - `getPatientTimeline(patientId)`
  - `getOutcomeSeries(patientId, metricType)`.

- [ ] **Step 1: Write RED service tests**

Timeline must contain mixed events sorted ascending by canonical timestamp:

```js
assert.deepEqual(timeline.map((e) => e.type), ['assessment', 'session', 'outcome', 'media']);
assert.ok(timeline.every((e, i, arr) => i === 0 || arr[i - 1].occurredAt <= e.occurredAt));
```

Series contract:

```js
assert.deepEqual(series, [
  { measuredAt: '...', value: 8, unit: '0-10' },
  { measuredAt: '...', value: 5, unit: '0-10' }
]);
```

- [ ] **Step 2: Run RED**

Run: `node --test test/f5-service-http.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement F5 composition**

```js
export function createF5Service(db, options = {}) {
  const base = createF4Service(db, options);
  return {
    ...base,
    getStatus() { return { ...base.getStatus(), phase: 'F5', milestone: 'post-MVP' }; },
    recordOutcome,
    listPatientOutcomes,
    getPatientTimeline,
    getOutcomeSeries
  };
}
```

Audit `outcome.created` for every write.

- [ ] **Step 4: Add authenticated routes**

- `POST /api/patients/:id/outcomes`
- `GET /api/patients/:id/outcomes`
- `GET /api/patients/:id/timeline`
- `GET /api/patients/:id/outcome-series?metricType=vas_pain`

Switch server to F5 only after tests for service/routes pass.

- [ ] **Step 5: Run GREEN/regression**

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/f5-service.js src/app/server.js test/f5-service-http.test.js
git commit -m "feat: add F5 longitudinal outcome service"
```

### Task 10: F5 longitudinal UI + final branch gate

**Files:**
- Create: `src/app/public/f5-ui.js`
- Modify: `src/app/public/index.html`
- Modify: `src/app/public/styles.css`
- Modify: `test/e2e/ui.spec.js`
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/domain-model.md`

**Interfaces:**
- Consumes F5 timeline/outcome-series endpoints.
- Produces final patient evolution workspace.

- [ ] **Step 1: Write RED E2E for longitudinal evolution**

Playwright scenario:
1. open existing patient;
2. record VAS 8 before treatment;
3. record another PBM session;
4. record VAS 5 after treatment;
5. add ROM 70°;
6. open evolution/timeline;
7. assert both VAS values are shown in chronological order;
8. assert comparison summary renders `8 → 5` without text claiming causality;
9. assert timeline includes assessment, PBM session, outcome and clinical image.

- [ ] **Step 2: Run RED**

Run: `npm run test:e2e`
Expected: FAIL on missing F5 UI.

- [ ] **Step 3: Implement F5 UI module**

`f5-ui.js` adds to patient workspace:
- outcome form with type/value/unit/narrative;
- chronological timeline;
- comparison table;
- simple SVG/polyline chart generated locally from `outcome-series` data, no chart dependency;
- copy: `Evolução registrada`; never `melhora causada pelo tratamento`.

- [ ] **Step 4: Update shell/docs**

- shell/title badge → `F5`;
- README lists F3 equipment adaptation, F4 MVP milestone and F5 evolution;
- architecture documents composition chain `F2 → F3 → F4 → F5`;
- domain model documents equipment adaptation snapshots, consent/media/documents and outcomes.

- [ ] **Step 5: Run final full verification**

Run fresh on the final commit:

```bash
npm run check
npm run test:unit
npm run test:e2e
npm run smoke
```

Expected:
- syntax: PASS;
- all unit/domain/HTTP tests: PASS;
- all Chromium E2E including F0–F5: PASS;
- smoke: PASS.

- [ ] **Step 6: Inspect final diff for forbidden scope**

Run:

```bash
git diff --stat feat/f2-protocol-engine...HEAD
git diff feat/f2-protocol-engine...HEAD -- package.json src docs test
```

Verify manually:
- no paid runtime dependency added;
- no automatic prescribing/dose recommendation;
- no F6/F7/F9/F10/F11 scope leaked in;
- protocol reference parameters are never overwritten.

- [ ] **Step 7: Commit final docs/UI**

```bash
git add src/app/public/f5-ui.js src/app/public/index.html src/app/public/styles.css test/e2e/ui.spec.js README.md docs/architecture.md docs/domain-model.md
git commit -m "feat: complete F5 longitudinal clinical evolution"
```
