import test from 'node:test';
import assert from 'node:assert/strict';
import * as protocolDomain from '../src/domain/protocols.js';
import { openDatabase } from '../src/db/database.js';
import { createF0Service } from '../src/app/f0-service.js';

function requireFunction(name) {
  assert.equal(typeof protocolDomain[name], 'function', `${name} must be implemented in F2`);
  return protocolDomain[name];
}

test('F2 calculates PBM energy from power in mW and time in seconds', () => {
  const calculateEnergyJ = requireFunction('calculateEnergyJ');
  assert.equal(calculateEnergyJ({ powerMw: 100, timeS: 40 }), 4);
  assert.throws(() => calculateEnergyJ({ powerMw: 0, timeS: 40 }), /power/i);
  assert.throws(() => calculateEnergyJ({ powerMw: 100, timeS: 0 }), /time/i);
});

test('F2 calculates fluence and irradiance using the application area', () => {
  const calculateFluenceJcm2 = requireFunction('calculateFluenceJcm2');
  const calculateIrradianceMwCm2 = requireFunction('calculateIrradianceMwCm2');
  assert.equal(calculateFluenceJcm2({ energyJ: 4, areaCm2: 0.5 }), 8);
  assert.equal(calculateIrradianceMwCm2({ powerMw: 100, areaCm2: 0.5 }), 200);
  assert.throws(() => calculateFluenceJcm2({ energyJ: 4, areaCm2: 0 }), /area/i);
});

test('F2 normalizes complete PBM parameters and rejects inconsistent dose math', () => {
  const normalizePbmParameters = requireFunction('normalizePbmParameters');
  const normalized = normalizePbmParameters({
    wavelengthNm: 808,
    powerMw: 100,
    timeS: 40,
    areaCm2: 0.5,
    mode: 'continuous',
    points: 4,
    technique: 'contact'
  });
  assert.deepEqual(normalized, {
    wavelengthNm: 808,
    powerMw: 100,
    irradianceMwCm2: 200,
    fluenceJcm2: 8,
    energyJ: 4,
    timeS: 40,
    areaCm2: 0.5,
    mode: 'continuous',
    frequencyHz: null,
    points: 4,
    technique: 'contact'
  });

  assert.throws(() => normalizePbmParameters({
    wavelengthNm: 808,
    powerMw: 100,
    timeS: 40,
    areaCm2: 0.5,
    energyJ: 9,
    mode: 'continuous',
    points: 1,
    technique: 'contact'
  }), /energy.*inconsistent/i);
});

test('F2 stores structured indications and searches protocols by clinical context', () => {
  const db = openDatabase();
  const service = createF0Service(db);
  service.ensureSeedData();
  assert.equal(typeof service.searchProtocols, 'function', 'searchProtocols must be implemented in F2');

  const protocol = service.createProtocol({
    title: 'Referência cervical F2',
    changeSummary: 'Versão inicial estruturada',
    parameters: {
      wavelengthNm: 808, powerMw: 100, timeS: 40, areaCm2: 0.5,
      mode: 'continuous', points: 4, technique: 'contact'
    },
    indications: [{
      condition: 'Cervicalgia',
      symptom: 'Dor cervical',
      bodyRegion: 'Cervical',
      therapeuticGoal: 'Analgesia',
      clinicalPhase: 'aguda'
    }]
  });

  const [version] = service.listProtocolVersions(protocol.id);
  assert.equal(version.parameters.energyJ, 4);
  assert.equal(version.parameters.fluenceJcm2, 8);
  assert.equal(version.indications[0].condition, 'Cervicalgia');
  assert.equal(version.indications[0].clinicalPhase, 'aguda');

  const matches = service.searchProtocols({ symptom: 'dor cervical', bodyRegion: 'cervical', clinicalPhase: 'aguda' });
  assert.ok(matches.some((item) => item.id === protocol.id));
  const misses = service.searchProtocols({ symptom: 'dor lombar' });
  assert.equal(misses.some((item) => item.id === protocol.id), false);
  db.close();
});

test('F2 copies structured indication metadata into a new immutable version when not overridden', () => {
  const db = openDatabase();
  const service = createF0Service(db);
  service.ensureSeedData();
  const protocol = service.createProtocol({
    title: 'Versionamento F2',
    changeSummary: 'v1',
    parameters: { wavelengthNm: 660, powerMw: 100, timeS: 20, areaCm2: 1, mode: 'continuous', points: 1, technique: 'contact' },
    indications: [{ condition: 'Condição teste', symptom: 'Sintoma teste', bodyRegion: 'Região teste', therapeuticGoal: 'Objetivo teste', clinicalPhase: 'subaguda' }]
  });
  service.createProtocolVersion(protocol.id, { changeSummary: 'v2 documental' });
  const versions = service.listProtocolVersions(protocol.id);
  assert.equal(versions.length, 2);
  assert.deepEqual(versions[1].indications, versions[0].indications.map(({ id, protocolVersionId, ...rest }) => rest));
  assert.throws(() => db.prepare('UPDATE protocol_indications SET symptom = ? WHERE protocol_version_id = ?').run('alterado', versions[0].id), /immutable/i);
  db.close();
});
