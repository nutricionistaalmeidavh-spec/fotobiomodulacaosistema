import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOutcome } from '../src/domain/outcomes.js';

test('F5 normalizes VAS pain to canonical 0-10 unit', () => {
  assert.deepEqual(
    normalizeOutcome({ type: 'vas_pain', value: 7 }),
    { type: 'vas_pain', value: 7, unit: '0-10', narrative: null }
  );
  assert.deepEqual(
    normalizeOutcome({ type: 'vas_pain', value: '4', unit: 'ignored', narrative: 'Antes da sessão' }),
    { type: 'vas_pain', value: 4, unit: '0-10', narrative: 'Antes da sessão' }
  );
  assert.throws(() => normalizeOutcome({ type: 'vas_pain', value: 11 }), /0.*10/i);
  assert.throws(() => normalizeOutcome({ type: 'vas_pain', value: -1 }), /0.*10/i);
});

test('F5 validates finite functional numeric outcomes with optional unit', () => {
  assert.deepEqual(
    normalizeOutcome({ type: 'functional_numeric', value: 42, unit: 'points' }),
    { type: 'functional_numeric', value: 42, unit: 'points', narrative: null }
  );
  assert.deepEqual(
    normalizeOutcome({ type: 'functional_numeric', value: '3.5' }),
    { type: 'functional_numeric', value: 3.5, unit: null, narrative: null }
  );
  assert.throws(() => normalizeOutcome({ type: 'functional_numeric', value: Number.POSITIVE_INFINITY }), /finite/i);
});

test('F5 requires a unit for edema measurements', () => {
  assert.deepEqual(
    normalizeOutcome({ type: 'edema', value: 2.3, unit: 'cm', narrative: 'Perimetria' }),
    { type: 'edema', value: 2.3, unit: 'cm', narrative: 'Perimetria' }
  );
  assert.throws(() => normalizeOutcome({ type: 'edema', value: 2.3 }), /unit/i);
  assert.throws(() => normalizeOutcome({ type: 'edema', value: Number.NaN, unit: 'cm' }), /finite/i);
});

test('F5 defaults ROM unit to degrees and rejects non-finite values', () => {
  assert.deepEqual(
    normalizeOutcome({ type: 'rom', value: 70 }),
    { type: 'rom', value: 70, unit: 'deg', narrative: null }
  );
  assert.deepEqual(
    normalizeOutcome({ type: 'rom', value: 1.2, unit: 'rad' }),
    { type: 'rom', value: 1.2, unit: 'rad', narrative: null }
  );
  assert.throws(() => normalizeOutcome({ type: 'rom', value: Number.NaN, unit: 'deg' }), /finite/i);
});

test('F5 text outcomes require narrative and never keep a numeric value', () => {
  assert.deepEqual(
    normalizeOutcome({ type: 'text', value: 99, unit: 'ignored', narrative: 'Evolução registrada.' }),
    { type: 'text', value: null, unit: null, narrative: 'Evolução registrada.' }
  );
  assert.throws(() => normalizeOutcome({ type: 'text', narrative: '   ' }), /narrative/i);
});

test('F5 rejects unsupported outcome types', () => {
  assert.throws(() => normalizeOutcome({ type: 'unknown', value: 1 }), /unsupported/i);
});
