import test from 'node:test';
import assert from 'node:assert/strict';
import { BODY_MAP_CATALOG, normalizeBodyMapPoint } from '../src/domain/body-map.js';

test('F7 exposes a deterministic local anatomical catalog', () => {
  assert.ok(BODY_MAP_CATALOG.some((region) => region.id === 'cervical'));
  assert.ok(BODY_MAP_CATALOG.some((region) => region.id === 'knee'));
  assert.ok(BODY_MAP_CATALOG.every((region) => Array.isArray(region.views) && region.views.length));
});

test('F7 normalizes an anatomical point without recommending treatment parameters', () => {
  const point = normalizeBodyMapPoint({
    regionId: 'cervical',
    view: 'posterior',
    laterality: 'midline',
    x: 0.5,
    y: 0.18,
    anatomicalLabel: 'C4-C5'
  });

  assert.deepEqual(point, {
    regionId: 'cervical',
    regionLabel: 'Cervical',
    view: 'posterior',
    laterality: 'midline',
    x: 0.5,
    y: 0.18,
    anatomicalLabel: 'C4-C5'
  });
  assert.equal('dose' in point, false);
  assert.equal('energyJ' in point, false);
});

test('F7 rejects invalid view, laterality and coordinates', () => {
  assert.throws(() => normalizeBodyMapPoint({ regionId: 'cervical', view: 'lateral', laterality: 'midline', x: 0.5, y: 0.5 }), /view/i);
  assert.throws(() => normalizeBodyMapPoint({ regionId: 'cervical', view: 'anterior', laterality: 'superior', x: 0.5, y: 0.5 }), /laterality/i);
  assert.throws(() => normalizeBodyMapPoint({ regionId: 'unknown', view: 'anterior', laterality: 'midline', x: 0.5, y: 0.5 }), /region/i);
  assert.throws(() => normalizeBodyMapPoint({ regionId: 'cervical', view: 'anterior', laterality: 'midline', x: 1.2, y: 0.5 }), /coordinates/i);
});
