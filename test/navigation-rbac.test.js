import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canAccessRoute,
  visiblePrimaryNavigation,
  visibleSecondaryNavigation
} from '../src/app/public/ui/navigation.js';

function ids(items) {
  return items.map((item) => item.id);
}

test('admin sees every currently implemented main route', () => {
  assert.deepEqual(ids(visiblePrimaryNavigation('admin')), [
    'dashboard', 'patients', 'agenda', 'protocols', 'equipment', 'reports', 'settings'
  ]);
  assert.deepEqual(ids(visibleSecondaryNavigation('admin')), ['sessions', 'audit']);
});

test('professional sees clinical routes but not finance reports, audit or administration placeholder', () => {
  assert.deepEqual(ids(visiblePrimaryNavigation('professional')), [
    'dashboard', 'patients', 'agenda', 'protocols', 'equipment'
  ]);
  assert.deepEqual(ids(visibleSecondaryNavigation('professional')), ['sessions']);
  assert.equal(canAccessRoute('professional', 'reports'), false);
  assert.equal(canAccessRoute('professional', 'audit'), false);
  assert.equal(canAccessRoute('professional', 'settings'), false);
});

test('reception sees administrative patient directory, agenda and reports without clinical routes', () => {
  assert.deepEqual(ids(visiblePrimaryNavigation('reception')), [
    'dashboard', 'patients', 'agenda', 'reports'
  ]);
  assert.deepEqual(ids(visibleSecondaryNavigation('reception')), []);
  for (const route of ['protocols', 'equipment', 'sessions', 'audit', 'settings', 'patient-workspace']) {
    assert.equal(canAccessRoute('reception', route), false, `${route} must stay unavailable to reception`);
  }
});
