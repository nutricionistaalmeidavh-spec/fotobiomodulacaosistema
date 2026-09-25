import { createF7Service } from './f7-service.js';
import { adaptProtocolToApplicator } from '../domain/equipment-adaptation.js';

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function includesText(value, expected) {
  if (!expected) return true;
  return normalizeText(value).includes(expected);
}

function finiteNonNegative(value, label) {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`${label} must be a non-negative number`);
  return number;
}

function mapContraindication(row) {
  return {
    id: row.id,
    protocolVersionId: row.protocol_version_id,
    label: row.label,
    severity: row.severity,
    rationale: row.rationale,
    sourceReference: row.source_reference
  };
}

function matchesIndication(indication, filters) {
  if (filters.condition && !includesText(indication.condition, filters.condition)) return false;
  if (filters.symptom && !includesText(indication.symptom, filters.symptom)) return false;
  if (filters.bodyRegion && !includesText(indication.bodyRegion, filters.bodyRegion)) return false;
  if (filters.therapeuticGoal && !includesText(indication.therapeuticGoal, filters.therapeuticGoal)) return false;
  if (filters.clinicalPhase && !includesText(indication.clinicalPhase, filters.clinicalPhase)) return false;

  if (filters.ageYears != null) {
    if (indication.minAgeYears != null && filters.ageYears < indication.minAgeYears) return false;
    if (indication.maxAgeYears != null && filters.ageYears > indication.maxAgeYears) return false;
  }

  if (filters.professionalArea && indication.professionalArea && !includesText(indication.professionalArea, filters.professionalArea)) {
    return false;
  }

  return true;
}

export function createF8Service(db) {
  const base = createF7Service(db);

  const service = {
    ...base,

    getStatus() {
      return { ...base.getStatus(), phase: 'F8' };
    },

    searchClinicalProtocols(input = {}) {
      const filters = {
        query: normalizeText(input.query),
        condition: normalizeText(input.condition),
        symptom: normalizeText(input.symptom),
        bodyRegion: normalizeText(input.bodyRegion),
        therapeuticGoal: normalizeText(input.therapeuticGoal),
        clinicalPhase: normalizeText(input.clinicalPhase),
        professionalArea: normalizeText(input.professionalArea),
        ageYears: finiteNonNegative(input.ageYears, 'Age'),
        wavelengthNm: finiteNonNegative(input.wavelengthNm, 'Wavelength'),
        applicatorId: String(input.applicatorId ?? '').trim() || null,
        selectedPowerMw: input.selectedPowerMw == null || input.selectedPowerMw === ''
          ? null
          : Number(input.selectedPowerMw)
      };
      if (filters.selectedPowerMw != null && (!Number.isFinite(filters.selectedPowerMw) || filters.selectedPowerMw <= 0)) {
        throw new Error('Selected power must be greater than zero');
      }

      const applicator = filters.applicatorId
        ? base.listEquipmentDetailed().flatMap((equipment) => equipment.applicators || []).find((item) => item.id === filters.applicatorId)
        : null;
      if (filters.applicatorId && !applicator) throw new Error('Applicator not found');

      const protocols = base.listProtocols();
      const results = [];

      for (const protocol of protocols) {
        const version = base.listProtocolVersions(protocol.id)
          .find((item) => item.id === protocol.currentVersionId);
        if (!version) continue;
        const indications = version.indications || [];
        const indicationCandidates = indications.length ? indications : [{}];
        if (!indicationCandidates.some((item) => matchesIndication(item, filters))) continue;

        if (filters.wavelengthNm != null) {
          const protocolWavelength = Number(version.parameters?.wavelengthNm);
          if (!Number.isFinite(protocolWavelength) || protocolWavelength !== filters.wavelengthNm) continue;
        }

        if (filters.query) {
          const searchable = [
            protocol.title,
            version.changeSummary,
            version.clinicalRationale,
            ...indications.flatMap((item) => [
              item.condition,
              item.symptom,
              item.bodyRegion,
              item.therapeuticGoal,
              item.clinicalPhase,
              item.professionalArea
            ])
          ];
          if (!searchable.some((value) => includesText(value, filters.query))) continue;
        }

        const contraindications = db.prepare(`
          SELECT * FROM protocol_contraindications
          WHERE protocol_version_id = ?
          ORDER BY CASE severity WHEN 'absolute' THEN 1 WHEN 'relative' THEN 2 ELSE 3 END, rowid
        `).all(version.id).map(mapContraindication);

        const equipmentCompatibility = applicator
          ? adaptProtocolToApplicator({
              referenceParameters: version.parameters || {},
              applicator,
              selectedPowerMw: filters.selectedPowerMw
            })
          : null;

        results.push({
          protocol: {
            id: protocol.id,
            title: protocol.title,
            status: protocol.status,
            currentVersionId: protocol.currentVersionId
          },
          version,
          indications,
          contraindications,
          equipmentCompatibility
        });
      }

      return results.sort((a, b) => a.protocol.title.localeCompare(b.protocol.title, 'pt-BR'));
    }
  };

  return service;
}
