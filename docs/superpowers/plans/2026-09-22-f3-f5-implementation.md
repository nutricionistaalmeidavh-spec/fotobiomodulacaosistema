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
- Quando o aplicador trabalha com faixa de potência, o sistema exige potência escolhida pelo profissional; nunca seleciona automaticamente a potência máxima.
- Sessão deve preservar snapshots separados de parâmetros planejados e aplicados.
- Mudanças clínicas relevantes exigem justificativa e auditoria.
- Histórico clínico/versionado permanece imutável.
- Sem body map visual, biblioteca científica aprofundada, IA/RAG, agenda/financeiro completo ou RBAC avançado nesta entrega.
- Cada fase deve passar por RED → GREEN → regressão completa antes da próxima.

## Review Focus

1. **Equipamento incompatível ou parcialmente configurado** — adaptação deve retornar `warnings`, exigir potência explícita em aplicadores de faixa e nunca fabricar compatibilidade; Task 2 cobre wavelength/mode/frequency/power.
2. **Mídia clínica inválida ou grande demais** — upload local rejeita MIME não permitido, base64 inválido e payload > 5 MiB decodificado; Task 5 cobre os três casos.
3. **Consentimento revogado** — revogação não apaga o aceite original nem permite mutação destrutiva; Task 4 cobre histórico accepted→revoked.
4. **Backup incompleto/corrompido** — snapshot SQLite consistente + manifest SHA-256 deve falhar se um item mudar; Task 6 cobre adulteração.
5. **Escalas clínicas fora do domínio** — EVA/VAS aceita apenas 0–10 e ROM/medidas exigem número finito; Task 8 cobre limites e valores inválidos.

---

### Task 1: F3 migration e capacidade persistente de equipamento/aplicador

**Files:**
- Create: `src/db/migrations/0004_f3.sql`
- Create: `test/f3-equipment-schema.test.js`
- Modify: `test/schema.test.js`

**Interfaces:**
- Consumes: `equipment`, `applicators`, `treatment_sessions` de `0001_f0.sql`.
- Produces: campos estruturados usados pelo motor F3.

- [ ] **Step 1: Write RED schema tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/db/database.js';

test('F3 adds structured equipment/applicator capability fields', () => {
  const db = openDatabase(':memory:');
  const equipment = db.prepare("PRAGMA table_info('equipment')").all().map((r) => r.name);
  const applicators = db.prepare("PRAGMA table_info('applicators')").all().map((r) => r.name);
  assert.ok(equipment.includes('notes'));
  for (const name of ['wavelengths_json','min_power_mw','fixed_power_mw','frequencies_json','limitations']) {
    assert.ok(applicators.includes(name), name);
  }
  db.close();
});
```

- [ ] **Step 2: Run RED**

Run: `node --test test/f3-equipment-schema.test.js`
Expected: FAIL because `0004_f3` is absent.

- [ ] **Step 3: Add `0004_f3.sql`**

```sql
ALTER TABLE equipment ADD COLUMN notes TEXT;
ALTER TABLE applicators ADD COLUMN wavelengths_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE applicators ADD COLUMN min_power_mw REAL CHECK (min_power_mw IS NULL OR min_power_mw > 0);
ALTER TABLE applicators ADD COLUMN fixed_power_mw REAL CHECK (fixed_power_mw IS NULL OR fixed_power_mw > 0);
ALTER TABLE applicators ADD COLUMN frequencies_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE applicators ADD COLUMN limitations TEXT;

CREATE INDEX idx_equipment_owner_active ON equipment(owner_professional_id, active);
CREATE INDEX idx_applicators_equipment_active ON applicators(equipment_id, active);
```

`wavelength_nm` continua aceito como comprimento principal legado; `wavelengths_json` suporta aplicadores multiemissores.

- [ ] **Step 4: Advance migration regression**

`test/schema.test.js` passa a esperar:

```js
['0001_f0', '0002_f1', '0003_f2', '0004_f3']
```

- [ ] **Step 5: Run GREEN/regression**

Run: `npm run test:unit`
Expected: all tests PASS.

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
- Produces: `adaptProtocolToApplicator({ referenceParameters, applicator, selectedPowerMw }) -> { compatible, referenceParameters, equipmentDerivedParameters, warnings }`.

- [ ] **Step 1: Write RED test for fixed-power applicator**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptProtocolToApplicator } from '../src/domain/equipment-adaptation.js';

test('F3 derives time without mutating reference protocol', () => {
  const reference = Object.freeze({ wavelengthNm: 808, energyJ: 4, powerMw: 100, timeS: 40, areaCm2: 0.5, mode: 'continuous', frequencyHz: null });
  const result = adaptProtocolToApplicator({
    referenceParameters: reference,
    applicator: { wavelengthsNm: [808], fixedPowerMw: 200, spotAreaCm2: 0.5, modes: ['continuous'], frequenciesHz: [] }
  });
  assert.equal(result.compatible, true);
  assert.equal(result.equipmentDerivedParameters.timeS, 20);
  assert.equal(result.equipmentDerivedParameters.energyJ, 4);
  assert.equal(reference.timeS, 40);
});
```

- [ ] **Step 2: Write RED tests for safety/compatibility**

Cover:

```js
assert.ok(result.warnings.includes('wavelength_incompatible'));
assert.ok(result.warnings.includes('mode_incompatible'));
assert.ok(result.warnings.includes('frequency_incompatible'));
```

For a range applicator `{ minPowerMw: 50, maxPowerMw: 300, fixedPowerMw: null }`:
- no `selectedPowerMw` → warning `power_selection_required`, `timeS=null`;
- `selectedPowerMw: 400` → warning `power_out_of_range`;
- `selectedPowerMw: 200` → derive time normally.

Missing spot area → `spot_area_missing`, with irradiance/fluence `null`.

- [ ] **Step 3: Run RED**

Run: `node --test test/f3-adaptation.test.js`
Expected: FAIL because module is absent.

- [ ] **Step 4: Implement deterministic engine**

```js
function round(value) { return Number(Number(value).toFixed(6)); }

export function adaptProtocolToApplicator({ referenceParameters, applicator, selectedPowerMw = null }) {
  const warnings = [];
  const wavelengths = applicator.wavelengthsNm?.length ? applicator.wavelengthsNm : [applicator.wavelengthNm].filter(Boolean);
  if (!wavelengths.map(Number).includes(Number(referenceParameters.wavelengthNm))) warnings.push('wavelength_incompatible');
  if (!(applicator.modes || []).includes(referenceParameters.mode)) warnings.push('mode_incompatible');
  if (referenceParameters.mode === 'pulsed' && referenceParameters.frequencyHz != null && !(applicator.frequenciesHz || []).map(Number).includes(Number(referenceParameters.frequencyHz))) warnings.push('frequency_incompatible');

  let powerMw = Number(applicator.fixedPowerMw || 0);
  if (!powerMw && (applicator.minPowerMw || applicator.maxPowerMw)) {
    if (!(Number(selectedPowerMw) > 0)) warnings.push('power_selection_required');
    else if (Number(selectedPowerMw) < Number(applicator.minPowerMw || selectedPowerMw) || Number(selectedPowerMw) > Number(applicator.maxPowerMw || selectedPowerMw)) warnings.push('power_out_of_range');
    else powerMw = Number(selectedPowerMw);
  }
  if (!powerMw && !warnings.includes('power_selection_required')) warnings.push('power_missing');

  const areaCm2 = Number(applicator.spotAreaCm2 || 0);
  if (!(areaCm2 > 0)) warnings.push('spot_area_missing');
  const energyJ = Number(referenceParameters.energyJ || 0);
  const timeS = powerMw > 0 && energyJ > 0 ? round((energyJ * 1000) / powerMw) : null;

  return Object.freeze({
    compatible: !warnings.some((w) => ['wavelength_incompatible','mode_incompatible','frequency_incompatible','power_selection_required','power_out_of_range','power_missing'].includes(w)),
    referenceParameters,
    equipmentDerivedParameters: {
      powerMw: powerMw || null,
      timeS,
      energyJ: energyJ || null,
      areaCm2: areaCm2 || null,
      irradianceMwCm2: powerMw > 0 && areaCm2 > 0 ? round(powerMw / areaCm2) : null,
      fluenceJcm2: energyJ > 0 && areaCm2 > 0 ? round(energyJ / areaCm2) : null
    },
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
  - `adaptProtocolVersion(protocolVersionId, applicatorId, selectedPowerMw)`
  - routes `POST /api/equipment`, `PATCH /api/equipment/:id`, `POST /api/equipment/:id/applicators`, `POST /api/protocol-versions/:id/adapt`.

- [ ] **Step 1: Write failing service/HTTP tests**

Fixed-power case:

```js
assert.equal(result.referenceParameters.energyJ, 4);
assert.equal(result.equipmentDerivedParameters.timeS, 20);
assert.equal(result.referenceParameters.timeS, 40);
assert.equal(result.compatible, true);
```

Range-power case must require `selectedPowerMw`.
HTTP status must expose `phase: 'F3'`.

- [ ] **Step 2: Run RED**

Run: `node --test test/f3-service-http.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement F3 by composition**

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

Audit writes: `equipment.created`, `equipment.updated`, `applicator.created`. Adaptation preview is read-only; do not emit audit noise until the professional uses derived parameters in a session.

- [ ] **Step 4: Activate F3 routes**

`POST /api/protocol-versions/:id/adapt` body:

```json
{ "applicatorId": "...", "selectedPowerMw": 200 }
```

- [ ] **Step 5: Run unit/HTTP GREEN**

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 6: Add F3 UI**

`f3-ui.js` owns equipment/adaptation UX:
- create/edit/deactivate equipment;
- create applicators;
- choose applicator in protocol/session flow;
- if power is a range, show explicit `Potência selecionada (mW)` input;
- preview two columns: `Referência` and `Calculado para equipamento`;
- render warnings as compatibility notices, not treatment advice.

- [ ] **Step 7: Add F3 E2E**

Flow:
1. create equipment `Laser F3`;
2. create fixed 808 nm/200 mW/0.5 cm² applicator;
3. open 4 J protocol;
4. assert reference `40 s` and derived `20 s` simultaneously;
5. assert reference values unchanged;
6. create range-power applicator and assert selection is required;
7. create incompatible 660 nm applicator and assert `wavelength_incompatible`.

- [ ] **Step 8: Run F3 gate**

```bash
npm run check
npm run test:unit
npm run test:e2e
npm run smoke
```

Expected: all PASS on one commit.

- [ ] **Step 9: Commit**

```bash
git add src/app/f3-service.js src/app/server.js src/app/public/f3-ui.js src/app/public/index.html test/f3-service-http.test.js test/e2e/ui.spec.js
git commit -m "feat: complete F3 equipment adaptation workflow"
```

### Task 4: F4 migration + immutable consent history

**Files:**
- Create: `src/db/migrations/0005_f4.sql`
- Create: `test/f4-consent.test.js`
- Modify: `test/schema.test.js`

**Interfaces:**
- Consumes: `consents`, `clinical_media`, `documents`, `application_points`, `outcomes`.
- Produces: immutable consent history and clinical asset metadata.

- [ ] **Step 1: Write RED consent tests**

```js
assert.equal(history[0].status, 'accepted');
assert.equal(history[1].status, 'revoked');
assert.throws(() => db.prepare('DELETE FROM consents WHERE id = ?').run(history[0].id), /immutable/i);
```

- [ ] **Step 2: Run RED**

Run: `node --test test/f4-consent.test.js`
Expected: FAIL.

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

- [ ] **Step 4: Advance migration expectation**

Expected versions end with `0005_f4`.

- [ ] **Step 5: Run GREEN**

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/db/migrations/0005_f4.sql test/f4-consent.test.js test/schema.test.js
git commit -m "feat: add F4 consent and clinical asset schema"
```

### Task 5: F4 consent, media and basic evolution service

**Files:**
- Create: `src/app/f4-service.js`
- Create: `src/core/clinical-storage.js`
- Create: `test/f4-assets.test.js`
- Modify: `src/app/server.js`

**Interfaces:**
- Consumes: `createF3Service(db)`, storage root default `data/clinical-assets`.
- Produces:
  - `createF4Service(db, { storageRoot, backupRoot })`
  - `acceptConsent(input, actorId)`
  - `revokeConsent(consentId, reason, actorId)`
  - `listConsents(patientId)`
  - `storeClinicalImage(input, actorId)`
  - `listClinicalMedia(patientId)`
  - `recordBasicOutcome({ patientId, encounterId, treatmentSessionId, metricType, metricValue, metricUnit, narrative }, actorId)`.

- [ ] **Step 1: Write RED media validation tests**

Allowed MIME: `image/jpeg`, `image/png`, `image/webp`.
Reject MIME invalid, malformed base64 and decoded payload > 5 MiB.

```js
await assert.rejects(() => storeClinicalImage({ mimeType: 'text/html', dataBase64: 'PGgxPg==' }), /mime/i);
await assert.rejects(() => storeClinicalImage({ mimeType: 'image/jpeg', dataBase64: 'not-base64!!' }), /base64/i);
```

- [ ] **Step 2: Write RED basic-outcome test**

```js
const outcome = service.recordBasicOutcome({ patientId, encounterId, metricType: 'clinical_note', narrative: 'Resposta clínica registrada.' }, professionalId);
assert.equal(outcome.narrative, 'Resposta clínica registrada.');
```

F4 basic outcome is storage/traceability only; strict scale semantics arrive in F5.

- [ ] **Step 3: Run RED**

Run: `node --test test/f4-assets.test.js`
Expected: FAIL.

- [ ] **Step 4: Implement local storage helper**

`clinical-storage.js`:
- strict base64 decode;
- MIME whitelist;
- max 5 MiB decoded;
- path `storageRoot/media/<patientId>/<uuid>.<ext>`;
- SHA-256 + byte size.

- [ ] **Step 5: Implement F4 service methods**

Consent revocation appends a second row with `status='revoked'`; original accepted row remains untouched.
Basic outcome writes to existing `outcomes` table and audits `outcome.created`.

- [ ] **Step 6: Add routes and activate F4**

- `GET/POST /api/patients/:id/consents`
- `POST /api/consents/:id/revoke`
- `GET/POST /api/patients/:id/media`
- `POST /api/patients/:id/basic-outcomes`

`/api/status` becomes F4 only after unit/HTTP tests pass.

- [ ] **Step 7: Run GREEN/regression**

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/f4-service.js src/core/clinical-storage.js src/app/server.js test/f4-assets.test.js
git commit -m "feat: add local consent media and basic evolution workflows"
```

### Task 6: F4 PDF + consistent local backup

**Files:**
- Create: `src/core/pdf.js`
- Create: `src/core/backup.js`
- Create: `test/f4-export.test.js`
- Modify: `src/app/f4-service.js`
- Modify: `src/app/server.js`

**Interfaces:**
- Produces:
  - `generateEncounterPdf(data) -> Buffer`
  - `createBackup({ db, assetRoot, destinationRoot }) -> { backupPath, manifest }`
  - `verifyBackup(backupPath) -> { valid, errors }`
  - `finalizeEncounterPdf(encounterId, actorId)`
  - `createLocalBackup(actorId)`.

- [ ] **Step 1: Write RED PDF tests**

Buffer begins `%PDF-`, ends with `%%EOF`; document row is `finalized` with SHA-256 and storage path.

- [ ] **Step 2: Write RED backup tests**

Backup layout:

```text
backup-<timestamp>/
  clinical.sqlite
  clinical-assets/...
  manifest.json
```

Manifest:

```json
{ "version": 1, "createdAt": "ISO-8601", "files": [{ "path": "clinical.sqlite", "sha256": "...", "bytes": 123 }] }
```

After mutating one backup file, `verifyBackup()` returns `valid: false`.

- [ ] **Step 3: Run RED**

Run: `node --test test/f4-export.test.js`
Expected: FAIL.

- [ ] **Step 4: Implement PDF writer**

Use no external dependency. Build a valid text PDF with built-in Helvetica/WinAnsi, escaping `(`, `)`, `\\`. Include patient, encounter, protocol/version, equipment/applicator, planned/applied parameters, application points and basic outcomes.

- [ ] **Step 5: Implement consistent SQLite backup**

Do **not** copy the live SQLite file directly. Create snapshot inside destination using the live DB handle:

```js
const snapshotPath = path.join(backupDir, 'clinical.sqlite');
db.prepare('VACUUM INTO ?').run(snapshotPath);
```

Then copy `clinical-assets`, enumerate files, hash each file and write `manifest.json`.

- [ ] **Step 6: Add service methods/routes**

- `POST /api/encounters/:id/pdf`
- `POST /api/backup`
- `POST /api/backup/verify`

Verification accepts only backup paths under configured backup root.

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
- Route: `POST /api/sessions/:id/application-points`.

- [ ] **Step 1: Write RED full MVP E2E**

Flow:
1. login;
2. create patient;
3. accept consent;
4. start encounter;
5. choose F2 protocol;
6. choose F3 applicator and preview derived parameters;
7. create session preserving reference/derived planning snapshot;
8. add two textual application points;
9. upload a 1x1 PNG using a fixed base64 constant in the test;
10. record basic outcome narrative;
11. generate encounter PDF;
12. create local backup;
13. assert patient history shows consent, session, points, image metadata, outcome, document and audit events.

Use fixture payload directly in test:

```js
const ONE_PIXEL_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=';
```

- [ ] **Step 2: Run RED**

Run: `npm run test:e2e`
Expected: FAIL on F4 controls/routes.

- [ ] **Step 3: Implement application-point path**

Persist `sequence_number`, `body_region`, `anatomical_label`, `parameters_json`, `applied_at`; audit `application_point.created`.

- [ ] **Step 4: Implement `f4-ui.js`**

Patient/session blocks:
- consent;
- clinical image upload;
- application points;
- basic evolution note;
- `Gerar PDF`;
- `Criar backup local`.

- [ ] **Step 5: Mark MVP**

`getStatus()` returns `{ phase: 'F4', milestone: 'MVP' }`; shell badge renders `F4 · MVP`.

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

### Task 8: F5 migration + strict outcome validation

**Files:**
- Create: `src/db/migrations/0006_f5.sql`
- Create: `src/domain/outcomes.js`
- Create: `test/f5-outcomes.test.js`
- Modify: `test/schema.test.js`

**Interfaces:**
- Consumes: existing `outcomes` table and F4 basic outcomes.
- Produces: `normalizeOutcome(input)` and responsible-professional link.

- [ ] **Step 1: Write RED tests**

```js
assert.deepEqual(normalizeOutcome({ type: 'vas_pain', value: 7 }), { type: 'vas_pain', value: 7, unit: '0-10', narrative: null });
assert.throws(() => normalizeOutcome({ type: 'vas_pain', value: 11 }), /0.*10/i);
assert.throws(() => normalizeOutcome({ type: 'rom', value: Number.NaN, unit: 'deg' }), /finite/i);
```

Also cover `functional_numeric`, `edema`, `rom` and `text`.

- [ ] **Step 2: Run RED**

Run: `node --test test/f5-outcomes.test.js`
Expected: FAIL.

- [ ] **Step 3: Add `0006_f5.sql`**

```sql
ALTER TABLE outcomes ADD COLUMN professional_id TEXT REFERENCES professionals(id) ON DELETE RESTRICT;
ALTER TABLE outcomes ADD COLUMN baseline_group TEXT;
CREATE INDEX idx_outcomes_patient_type_time ON outcomes(patient_id, metric_type, measured_at);
```

Advance migration expectation through `0006_f5`.

- [ ] **Step 4: Implement canonical validation**

- `vas_pain`: numeric 0–10, unit `0-10`;
- `functional_numeric`: finite numeric, optional unit;
- `edema`: finite numeric, unit required;
- `rom`: finite numeric, default unit `deg`;
- `text`: `value=null`, non-empty narrative.

- [ ] **Step 5: Run GREEN**

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/db/migrations/0006_f5.sql src/domain/outcomes.js test/f5-outcomes.test.js test/schema.test.js
git commit -m "feat: add F5 outcome validation model"
```

### Task 9: F5 service/API, unified timeline and comparison series

**Files:**
- Create: `src/app/f5-service.js`
- Create: `test/f5-service-http.test.js`
- Modify: `src/app/server.js`

**Interfaces:**
- Consumes: `createF4Service(db, options)`, `normalizeOutcome()`.
- Produces:
  - `recordOutcome(input, actorId)`
  - `listPatientOutcomes(patientId)`
  - `getPatientTimeline(patientId)`
  - `getOutcomeSeries(patientId, metricType)`.

- [ ] **Step 1: Write RED timeline/series tests**

Timeline must merge and sort assessment, session, outcome, media/document events by canonical timestamp.

```js
assert.ok(timeline.every((event, index, all) => index === 0 || all[index - 1].occurredAt <= event.occurredAt));
```

Series contract:

```js
assert.deepEqual(series.map(({ value, unit }) => ({ value, unit })), [
  { value: 8, unit: '0-10' },
  { value: 5, unit: '0-10' }
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

Every write audits `outcome.created`.

- [ ] **Step 4: Add routes**

- `POST /api/patients/:id/outcomes`
- `GET /api/patients/:id/outcomes`
- `GET /api/patients/:id/timeline`
- `GET /api/patients/:id/outcome-series?metricType=vas_pain`

Activate F5 server only after service/HTTP GREEN.

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

- [ ] **Step 1: Write RED longitudinal E2E**

Flow:
1. open patient;
2. record VAS 8 before treatment;
3. record another PBM session;
4. record VAS 5 after treatment;
5. add ROM 70°;
6. open timeline/evolution;
7. assert VAS values chronological;
8. assert comparison renders `8 → 5` without causal language;
9. assert timeline includes assessment, session, outcome and clinical image.

- [ ] **Step 2: Run RED**

Run: `npm run test:e2e`
Expected: FAIL on F5 UI.

- [ ] **Step 3: Implement `f5-ui.js`**

Add:
- outcome form type/value/unit/narrative;
- chronological timeline;
- comparison table;
- local SVG/polyline chart from outcome-series, no chart dependency;
- copy `Evolução registrada`, never causal treatment claims.

- [ ] **Step 4: Update shell/docs**

- badge/title → F5;
- README documents F3/F4 MVP/F5;
- architecture documents `F2 → F3 → F4 → F5`;
- domain model documents adaptation snapshots, consent/media/documents/outcomes.

- [ ] **Step 5: Run fresh final verification**

```bash
npm run check
npm run test:unit
npm run test:e2e
npm run smoke
```

Expected: syntax, all unit/domain/HTTP, all Chromium E2E F0–F5 and smoke PASS on the same final commit.

- [ ] **Step 6: Inspect final diff for scope leakage**

```bash
git diff --stat feat/f2-protocol-engine...HEAD
git diff feat/f2-protocol-engine...HEAD -- package.json src docs test
```

Verify:
- no paid runtime dependency;
- no automatic prescribing/dose recommendation;
- no F6/F7/F9/F10/F11 scope;
- no mutation of protocol reference parameters.

- [ ] **Step 7: Commit final UI/docs**

```bash
git add src/app/public/f5-ui.js src/app/public/index.html src/app/public/styles.css test/e2e/ui.spec.js README.md docs/architecture.md docs/domain-model.md
git commit -m "feat: complete F5 longitudinal clinical evolution"
```
