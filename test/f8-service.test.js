import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../src/db/database.js';
import { createF8Service } from '../src/app/f8-service.js';

function createProtocol(service, overrides = {}) {
  const protocol = service.createProtocol({
    title: overrides.title || 'Cervicalgia F8',
    changeSummary: 'v1 F8',
    parameters: {
      wavelengthNm: overrides.wavelengthNm || 808,
      powerMw: 100,
      timeS: 40,
      areaCm2: 0.5,
      mode: 'continuous',
      points: 4,
      technique: 'contact'
    },
    indications: [{
      condition: 'cervicalgia',
      symptom: 'dor cervical',
      bodyRegion: 'cervical',
      therapeuticGoal: 'analgesia',
      clinicalPhase: 'aguda',
      minAgeYears: 18,
      maxAgeYears: 70,
      professionalArea: 'fisioterapia'
    }]
  });
  return service.listProtocolVersions(protocol.id)[0];
}

test('F8 filters structured clinical protocols by age, professional area and wavelength without ranking', () => {
  const db = openDatabase();
  const service = createF8Service(db);
  service.ensureSeedData();
  const version = createProtocol(service);

  assert.equal(service.getStatus().phase, 'F8');
  assert.equal(version.indications[0].minAgeYears, 18);
  assert.equal(version.indications[0].maxAgeYears, 70);
  assert.equal(version.indications[0].professionalArea, 'fisioterapia');

  const matched = service.searchClinicalProtocols({
    query: 'cervical',
    ageYears: 45,
    professionalArea: 'fisioterapia',
    wavelengthNm: 808
  });
  assert.equal(matched.length, 1);
  assert.equal(matched[0].protocol.title, 'Cervicalgia F8');
  assert.equal(Object.hasOwn(matched[0], 'score'), false);
  assert.equal(Object.hasOwn(matched[0], 'recommendation'), false);

  assert.equal(service.searchClinicalProtocols({ ageYears: 17, professionalArea: 'fisioterapia' }).length, 0);
  assert.equal(service.searchClinicalProtocols({ ageYears: 71, professionalArea: 'fisioterapia' }).length, 0);
  assert.equal(service.searchClinicalProtocols({ ageYears: 18, professionalArea: 'fisioterapia' }).length, 1);
  assert.equal(service.searchClinicalProtocols({ ageYears: 70, professionalArea: 'fisioterapia' }).length, 1);
  assert.equal(service.searchClinicalProtocols({ ageYears: 45, professionalArea: 'odontologia' }).length, 0);
  assert.equal(service.searchClinicalProtocols({ ageYears: 45, wavelengthNm: 660 }).length, 0);

  db.close();
});

test('F8 exposes exact-version contraindications and explicit applicator compatibility', () => {
  const db = openDatabase();
  const service = createF8Service(db);
  service.ensureSeedData();
  const version = createProtocol(service, { title: 'Protocolo F8 compatibilidade' });

  db.prepare(`
    INSERT INTO protocol_contraindications(id, protocol_version_id, label, severity, rationale, source_reference)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), version.id, 'Fotossensibilidade medicamentosa', 'precaution', 'Revisar medicação antes da aplicação.', 'Fonte clínica F8');

  const equipment = service.createEquipment({ manufacturer: 'ArtiSys', model: 'PBM F8' });
  const applicator = service.createApplicator(equipment.id, {
    name: '808 nm fixo', wavelengthNm: 808, fixedPowerMw: 100, spotAreaCm2: 0.5, modes: ['continuous']
  });

  const [result] = service.searchClinicalProtocols({ query: 'compatibilidade', applicatorId: applicator.id });
  assert.equal(result.version.id, version.id);
  assert.equal(result.contraindications.length, 1);
  assert.equal(result.contraindications[0].severity, 'precaution');
  assert.equal(result.equipmentCompatibility.compatible, true);
  assert.deepEqual(result.equipmentCompatibility.referenceParameters, version.parameters);

  db.close();
});
