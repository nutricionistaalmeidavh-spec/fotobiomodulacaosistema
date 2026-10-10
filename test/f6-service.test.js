import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/db/database.js';
import { createF6Service } from '../src/app/f6-service.js';

test('F6 creates and searches structured scientific evidence locally', () => {
  const db = openDatabase();
  const service = createF6Service(db);
  service.ensureSeedData();

  const evidence = service.createEvidence({
    title: 'Photobiomodulation for cervical pain',
    authors: 'Equipe Clínica',
    publicationYear: 2025,
    sourceName: 'Journal PBM',
    studyType: 'randomized_trial',
    doi: '10.1000/pbm.f6.1',
    url: 'https://example.test/pbm-f6',
    abstractText: 'Estudo sobre fotobiomodulação e dor cervical.',
    conditions: ['cervicalgia'],
    bodyRegions: ['cervical'],
    wavelengthsNm: [808]
  });

  assert.equal(service.getStatus().phase, 'F6');
  assert.equal(evidence.title, 'Photobiomodulation for cervical pain');
  assert.deepEqual(evidence.conditions, ['cervicalgia']);
  assert.deepEqual(evidence.bodyRegions, ['cervical']);
  assert.deepEqual(evidence.wavelengthsNm, [808]);

  assert.equal(service.listEvidence({ query: 'cervical' }).length, 1);
  assert.equal(service.listEvidence({ studyType: 'randomized_trial' }).length, 1);
  assert.equal(service.listEvidence({ condition: 'cervicalgia' }).length, 1);
  assert.equal(service.listEvidence({ bodyRegion: 'cervical' }).length, 1);
  assert.equal(service.listEvidence({ wavelengthNm: 808 }).length, 1);
  assert.equal(service.listEvidence({ wavelengthNm: 660 }).length, 0);
});

test('F6 links evidence to an exact immutable protocol version without mutating protocol parameters', () => {
  const db = openDatabase();
  const service = createF6Service(db);
  service.ensureSeedData();

  const protocol = service.createProtocol({
    title: 'Protocolo científico F6',
    changeSummary: 'Referência original',
    parameters: {
      wavelengthNm: 808,
      powerMw: 100,
      timeS: 40,
      areaCm2: 0.5,
      mode: 'continuous',
      points: 4,
      technique: 'contact'
    }
  });
  const version = service.listProtocolVersions(protocol.id)[0];
  const before = service.getProtocolVersion(version.id);

  const evidence = service.createEvidence({
    title: 'Evidence F6',
    studyType: 'systematic_review',
    publicationYear: 2024
  });
  const link = service.linkEvidenceToProtocolVersion(version.id, evidence.id, {
    relationType: 'supports',
    note: 'Referência documental; sem alteração automática do protocolo.'
  });

  assert.equal(link.protocolVersionId, version.id);
  assert.equal(link.evidenceId, evidence.id);
  assert.equal(link.relationType, 'supports');
  assert.equal(service.listProtocolEvidence(version.id).length, 1);
  assert.deepEqual(service.getProtocolVersion(version.id).parameters, before.parameters);

  const audit = service.getAuditState();
  assert.equal(audit.valid, true);
  assert.ok(audit.events.some((event) => event.action === 'evidence.created'));
  assert.ok(audit.events.some((event) => event.action === 'protocol_evidence.linked'));
});
