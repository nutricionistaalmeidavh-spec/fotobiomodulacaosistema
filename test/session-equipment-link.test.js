import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/db/database.js';
import { createF3Service } from '../src/app/f3-service.js';

function buildClinicalContext(service) {
  const patient = service.createPatient({ fullName: 'Paciente vínculo equipamento' });
  const encounter = service.startEncounter(patient.id, { assessment: { chiefComplaint: 'Dor em ombro' } });
  const protocol = service.createProtocol({
    title: 'Protocolo vínculo equipamento',
    changeSummary: 'v1',
    parameters: {
      wavelengthNm: 808,
      powerMw: 100,
      timeS: 40,
      areaCm2: 0.5,
      mode: 'continuous',
      points: 1,
      technique: 'contact'
    }
  });
  const version = service.listProtocolVersions(protocol.id)[0];
  return { patient, encounter, protocol, version };
}

test('treatment session persists the explicitly selected equipment and applicator', () => {
  const db = openDatabase(':memory:');
  const service = createF3Service(db);
  service.ensureSeedData();
  const { encounter, version } = buildClinicalContext(service);
  const equipment = service.createEquipment({ manufacturer: 'T8', model: 'Laser selecionado' });
  const applicator = service.createApplicator(equipment.id, {
    name: 'Ponteira 808', wavelengthNm: 808, fixedPowerMw: 200, spotAreaCm2: 0.5, modes: ['continuous']
  });

  const session = service.createTreatmentSession({
    encounterId: encounter.id,
    protocolVersionId: version.id,
    equipmentId: equipment.id,
    applicatorId: applicator.id,
    plannedEnergyJ: 4,
    appliedEnergyJ: 4
  });

  assert.equal(session.equipmentId, equipment.id);
  assert.equal(session.applicatorId, applicator.id);
  db.close();
});

test('treatment session rejects an applicator that does not belong to the selected equipment without partial write', () => {
  const db = openDatabase(':memory:');
  const service = createF3Service(db);
  service.ensureSeedData();
  const { encounter, version } = buildClinicalContext(service);
  const first = service.createEquipment({ manufacturer: 'T8', model: 'Equipamento A' });
  const second = service.createEquipment({ manufacturer: 'T8', model: 'Equipamento B' });
  const applicator = service.createApplicator(second.id, {
    name: 'Ponteira B', wavelengthNm: 808, fixedPowerMw: 100, spotAreaCm2: 0.5, modes: ['continuous']
  });
  const before = service.listSessions().length;

  assert.throws(() => service.createTreatmentSession({
    encounterId: encounter.id,
    protocolVersionId: version.id,
    equipmentId: first.id,
    applicatorId: applicator.id,
    plannedEnergyJ: 4,
    appliedEnergyJ: 4
  }), /applicator.*equipment|equipamento|aplicador/i);
  assert.equal(service.listSessions().length, before);
  db.close();
});
