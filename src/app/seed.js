export const SEED_IDS = Object.freeze({
  professional: 'prof-demo',
  patient: 'patient-demo',
  assessment: 'assessment-demo',
  encounter: 'encounter-demo',
  condition: 'condition-demo',
  equipment: 'equipment-demo',
  applicator: 'applicator-demo',
  protocol: 'protocol-demo',
  protocolVersion: 'protocol-version-demo-v1'
});

export function ensureSeedData(db) {
  const ids = SEED_IDS;
  db.exec('BEGIN IMMEDIATE;');
  try {
    db.prepare(`
      INSERT OR IGNORE INTO professionals(id, name, registration_type, registration_number, email)
      VALUES (?, ?, ?, ?, ?)
    `).run(ids.professional, 'Profissional Demo', 'demo', '0000', 'demo@local.invalid');

    db.prepare(`
      INSERT OR IGNORE INTO patients(id, full_name, notes)
      VALUES (?, ?, ?)
    `).run(ids.patient, 'Paciente Demo', 'Registro local criado para validar a fundação F0.');

    db.prepare(`
      INSERT OR IGNORE INTO conditions(id, canonical_name, category, description)
      VALUES (?, ?, ?, ?)
    `).run(ids.condition, 'Dor musculoesquelética', 'dor', 'Condição demonstrativa para a fundação.');

    db.prepare(`
      INSERT OR IGNORE INTO assessments(id, patient_id, professional_id, chief_complaint, pain_score)
      VALUES (?, ?, ?, ?, ?)
    `).run(ids.assessment, ids.patient, ids.professional, 'Queixa demonstrativa', 6);

    db.prepare(`
      INSERT OR IGNORE INTO encounters(id, patient_id, professional_id, assessment_id, encounter_type, status, notes)
      VALUES (?, ?, ?, ?, 'clinical', 'open', ?)
    `).run(ids.encounter, ids.patient, ids.professional, ids.assessment, 'Atendimento aberto para testes da F0.');

    db.prepare(`
      INSERT OR IGNORE INTO equipment(id, owner_professional_id, manufacturer, model, serial_number, specifications_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      ids.equipment,
      ids.professional,
      'Equipamento Demo',
      'PBM Local 808',
      'DEMO-001',
      JSON.stringify({ wavelengthsNm: [808], maxPowerMw: 100 })
    );

    db.prepare(`
      INSERT OR IGNORE INTO applicators(id, equipment_id, name, wavelength_nm, max_power_mw, spot_area_cm2, modes_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(ids.applicator, ids.equipment, 'Ponteira 808 nm', 808, 100, 0.04, JSON.stringify(['continuous']));

    db.prepare(`
      INSERT OR IGNORE INTO protocols(id, title, status, created_by, current_version_id)
      VALUES (?, ?, 'draft', ?, NULL)
    `).run(ids.protocol, 'Protocolo demonstrativo F0', ids.professional);

    db.prepare(`
      INSERT OR IGNORE INTO protocol_versions(
        id, protocol_id, version_number, status, change_summary, source_type, clinical_rationale, parameters_json
      ) VALUES (?, ?, 1, 'draft', ?, 'system', ?, ?)
    `).run(
      ids.protocolVersion,
      ids.protocol,
      'Versão inicial demonstrativa',
      'Registro estrutural, sem prescrição automática.',
      JSON.stringify({ wavelengthNm: 808, energyJ: 4, points: 6 })
    );

    db.prepare(`UPDATE protocols SET current_version_id = ? WHERE id = ? AND current_version_id IS NULL`)
      .run(ids.protocolVersion, ids.protocol);

    db.exec('COMMIT;');
  } catch (error) {
    db.exec('ROLLBACK;');
    throw error;
  }
  return ids;
}
