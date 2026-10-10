function latin1(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
}

function pdfEscape(value) {
  return latin1(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function jsonSummary(value) {
  if (value == null) return '—';
  if (typeof value !== 'object') return String(value);
  return Object.entries(value).map(([key, item]) => `${key}: ${item ?? '—'}`).join(' | ') || '—';
}

function encounterLines(data = {}) {
  const patient = data.patient ?? {};
  const encounter = data.encounter ?? {};
  const assessment = data.assessment ?? {};
  const sessions = Array.isArray(data.sessions) ? data.sessions : [];
  const applicationPoints = Array.isArray(data.applicationPoints) ? data.applicationPoints : [];
  const outcomes = Array.isArray(data.outcomes) ? data.outcomes : [];
  const lines = [
    'ArtiSys Fotobiomodulacao - Registro clinico',
    `Paciente: ${patient.fullName ?? patient.full_name ?? '—'}`,
    `Atendimento: ${encounter.id ?? '—'}`,
    `Inicio: ${encounter.startedAt ?? encounter.started_at ?? '—'}`,
    `Queixa principal: ${assessment.chiefComplaint ?? assessment.chief_complaint ?? '—'}`,
    `Escore de dor: ${assessment.painScore ?? assessment.pain_score ?? '—'}`,
    `Notas: ${encounter.notes ?? '—'}`,
    ''
  ];

  sessions.forEach((session, index) => {
    lines.push(`Sessao ${index + 1}: ${session.protocolTitle ?? session.protocol_title ?? 'Sem protocolo'}`);
    lines.push(`Versao do protocolo: ${session.protocolVersionNumber ?? session.version_number ?? '—'}`);
    const equipment = [session.equipmentManufacturer, session.equipmentModel].filter(Boolean).join(' ');
    if (equipment) lines.push(`Equipamento: ${equipment}`);
    if (session.applicatorName) lines.push(`Aplicador: ${session.applicatorName}`);
    lines.push(`Planejado: ${jsonSummary(session.plannedParameters ?? session.planned_parameters)}`);
    lines.push(`Aplicado: ${jsonSummary(session.appliedParameters ?? session.applied_parameters)}`);
    if (session.professionalAdjustmentReason ?? session.professional_adjustment_reason) {
      lines.push(`Justificativa: ${session.professionalAdjustmentReason ?? session.professional_adjustment_reason}`);
    }
  });

  if (applicationPoints.length) {
    lines.push('', 'Pontos de aplicacao:');
    applicationPoints.forEach((point) => {
      lines.push(`#${point.sequenceNumber ?? point.sequence_number ?? '—'} ${point.bodyRegion ?? point.body_region ?? point.anatomicalLabel ?? point.anatomical_label ?? '—'} | ${jsonSummary(point.parameters ?? point.parameters_json)}`);
    });
  }

  if (outcomes.length) {
    lines.push('', 'Evolucao clinica:');
    outcomes.forEach((outcome) => {
      const metric = outcome.metricType ?? outcome.metric_type ?? 'registro';
      const numeric = outcome.metricValue ?? outcome.metric_value;
      const unit = outcome.metricUnit ?? outcome.metric_unit ?? '';
      const narrative = outcome.narrative ?? outcome.notes ?? '';
      lines.push(`${metric}: ${numeric ?? ''}${numeric != null && unit ? ` ${unit}` : ''}${narrative ? ` - ${narrative}` : ''}`);
    });
  }

  return lines;
}

export function generateEncounterPdf(data = {}) {
  const lines = encounterLines(data).slice(0, 55);
  const commands = ['BT', '/F1 10 Tf', '50 790 Td', '13 TL'];
  for (const line of lines) {
    commands.push(`(${pdfEscape(line)}) Tj`, 'T*');
  }
  commands.push('ET');
  const stream = `${commands.join('\n')}\n`;

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
  ];

  let output = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(output, 'latin1'));
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(output, 'latin1');
  output += `xref\n0 ${objects.length + 1}\n`;
  output += '0000000000 65535 f \n';
  for (let index = 1; index <= objects.length; index += 1) {
    output += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(output, 'latin1');
}
