function positiveFinite(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function round(value, digits = 4) {
  return Number(Number(value).toFixed(digits));
}

export function calculateDosimetry({ powerMw, timeSeconds, areaCm2, energyJ } = {}) {
  const power = positiveFinite(powerMw);
  const area = positiveFinite(areaCm2);
  const suppliedTime = positiveFinite(timeSeconds);
  const suppliedEnergy = positiveFinite(energyJ);
  const errors = [];

  if (!power) errors.push('Informe uma potência positiva e finita.');
  if (!area) errors.push('Informe uma área positiva e finita.');
  if (!suppliedTime && !suppliedEnergy) errors.push('Informe tempo ou energia positiva e finita.');

  if (errors.length) {
    return { valid: false, errors, energyJ: null, fluenceJcm2: null, timeSeconds: null };
  }

  const resolvedEnergy = suppliedTime ? (power / 1000) * suppliedTime : suppliedEnergy;
  const resolvedTime = suppliedTime || suppliedEnergy / (power / 1000);
  const fluence = resolvedEnergy / area;

  if (![resolvedEnergy, resolvedTime, fluence].every((value) => Number.isFinite(value) && value > 0)) {
    return { valid: false, errors: ['Os valores informados não produzem um cálculo finito e positivo.'], energyJ: null, fluenceJcm2: null, timeSeconds: null };
  }

  return {
    valid: true,
    errors: [],
    energyJ: round(resolvedEnergy),
    fluenceJcm2: round(fluence),
    timeSeconds: round(resolvedTime)
  };
}

export function renderDosimetryCalculator() {
  return `<section class="card dosimetry-card" data-dosimetry-calculator>
    <div class="section-head"><div><span class="eyebrow">CÁLCULO TRANSPARENTE</span><h2>Calculadora de dosimetria</h2></div><span class="status-badge status-info">Aritmética</span></div>
    <p class="muted">Calcula relações matemáticas entre potência, tempo, energia e área. O resultado <strong>não é recomendação clínica</strong>, não escolhe protocolo e não substitui decisão profissional.</p>
    <div class="form-grid dosimetry-grid">
      <label>Potência (mW)<input type="number" min="0" step="any" value="100" data-dosimetry-power></label>
      <label>Tempo (s)<input type="number" min="0" step="any" value="40" data-dosimetry-time></label>
      <label>Área (cm²)<input type="number" min="0" step="any" value="1" data-dosimetry-area></label>
      <label>Energia (J) <span class="muted">opcional se houver tempo</span><input type="number" min="0" step="any" data-dosimetry-energy></label>
    </div>
    <div class="actions"><button type="button" class="secondary" data-dosimetry-calculate>Calcular dosimetria</button></div>
    <div class="dosimetry-output" aria-live="polite">
      <p data-dosimetry-error hidden></p>
      <div data-dosimetry-result><span class="muted">Preencha os valores e execute o cálculo.</span></div>
    </div>
  </section>`;
}

export function bindDosimetryCalculator(root = document) {
  const card = root.querySelector('[data-dosimetry-calculator]');
  if (!card) return;
  card.querySelector('[data-dosimetry-calculate]')?.addEventListener('click', () => {
    const result = calculateDosimetry({
      powerMw: card.querySelector('[data-dosimetry-power]')?.value,
      timeSeconds: card.querySelector('[data-dosimetry-time]')?.value,
      areaCm2: card.querySelector('[data-dosimetry-area]')?.value,
      energyJ: card.querySelector('[data-dosimetry-energy]')?.value
    });
    const error = card.querySelector('[data-dosimetry-error]');
    const output = card.querySelector('[data-dosimetry-result]');
    if (!result.valid) {
      error.hidden = false;
      error.className = 'field-error';
      error.textContent = result.errors.join(' ');
      output.innerHTML = '<span class="muted">Nenhum resultado calculado.</span>';
      return;
    }
    error.hidden = true;
    error.textContent = '';
    output.innerHTML = `<div class="dosimetry-results"><strong>Energia: ${result.energyJ} J</strong><strong>Fluência: ${result.fluenceJcm2} J/cm²</strong><strong>Tempo: ${result.timeSeconds} s</strong></div>`;
  });
}
