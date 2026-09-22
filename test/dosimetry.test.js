import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDosimetry, renderDosimetryCalculator } from '../src/app/public/features/dosimetry.js';

test('calculates energy and fluence from power, time and area', () => {
  const result = calculateDosimetry({ powerMw: 100, timeSeconds: 40, areaCm2: 2 });
  assert.equal(result.valid, true);
  assert.equal(result.energyJ, 4);
  assert.equal(result.fluenceJcm2, 2);
  assert.equal(result.timeSeconds, 40);
  assert.equal('recommendation' in result, false);
});

test('derives time from energy and power without creating a treatment recommendation', () => {
  const result = calculateDosimetry({ powerMw: 200, energyJ: 6, areaCm2: 3 });
  assert.equal(result.valid, true);
  assert.equal(result.timeSeconds, 30);
  assert.equal(result.fluenceJcm2, 2);
  assert.equal('recommendation' in result, false);
});

test('rejects zero, negative and non-finite inputs without NaN or Infinity outputs', () => {
  for (const input of [
    { powerMw: 0, timeSeconds: 40, areaCm2: 2 },
    { powerMw: 100, timeSeconds: -1, areaCm2: 2 },
    { powerMw: 100, timeSeconds: 40, areaCm2: 0 },
    { powerMw: Infinity, timeSeconds: 40, areaCm2: 2 }
  ]) {
    const result = calculateDosimetry(input);
    assert.equal(result.valid, false);
    assert.equal(result.energyJ, null);
    assert.equal(result.fluenceJcm2, null);
    assert.equal(result.timeSeconds, null);
  }
});

test('calculator copy states that arithmetic is not a clinical recommendation', () => {
  const html = renderDosimetryCalculator();
  assert.match(html, /Calculadora de dosimetria/);
  assert.match(html, /não é recomendação clínica/i);
});
