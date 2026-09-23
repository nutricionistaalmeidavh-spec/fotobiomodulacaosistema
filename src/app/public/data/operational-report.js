function normalizeDay(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const day = raw.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(new Date(`${day}T00:00:00Z`).getTime())) {
    throw new TypeError('Período inválido.');
  }
  return day;
}

export function validateReportPeriod(filters = {}) {
  const from = normalizeDay(filters.from);
  const to = normalizeDay(filters.to);
  if (from && to && from > to) throw new TypeError('Período inválido: a data inicial deve ser anterior ou igual à final.');
  return { from, to };
}

function sessionDay(session) {
  const value = session?.startedAt || session?.completedAt || session?.createdAt || session?.date || '';
  return String(value).slice(0, 10);
}

function inPeriod(session, period) {
  if (!period.from && !period.to) return true;
  const day = sessionDay(session);
  if (!day) return false;
  if (period.from && day < period.from) return false;
  if (period.to && day > period.to) return false;
  return true;
}

function energyDiverges(session) {
  const planned = Number(session?.plannedParameters?.energyJ);
  const applied = Number(session?.appliedParameters?.energyJ);
  return Number.isFinite(planned) && Number.isFinite(applied) && planned !== applied;
}

export function deriveOperationalReport({ patients = [], sessions = [], protocols = [], filters = {} } = {}) {
  const period = validateReportPeriod(filters);
  const selectedSessions = sessions.filter((session) => inPeriod(session, period));
  const usage = new Map();

  for (const session of selectedSessions) {
    const name = String(session?.protocolTitle || session?.protocolId || 'Sem protocolo').trim() || 'Sem protocolo';
    usage.set(name, (usage.get(name) || 0) + 1);
  }

  const protocolUsage = [...usage.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'));

  return {
    filters: period,
    sessionCount: selectedSessions.length,
    activePatientCount: patients.filter((patient) => patient.status === 'active').length,
    pendingFollowUpCount: patients.filter((patient) => patient.status === 'active' && (patient.pendingItems?.length || 0) > 0).length,
    divergenceCount: selectedSessions.filter(energyDiverges).length,
    protocolUsage,
    protocolCount: protocols.length,
    basis: { patients: 'local', sessions: 'persisted', protocols: 'persisted' }
  };
}
