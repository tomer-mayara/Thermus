import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withPreload } from '../../support/processes/server-preloads.ts';

test('Given settings without a preload, when a test adds one, then it keeps the settings and selects that preload', () => {
  assert.deepEqual(withPreload({ DEPLOYMENT: 'hosted' }, 'file:///fixture.js'), {
    DEPLOYMENT: 'hosted', NODE_OPTIONS: '--import=file:///fixture.js',
  });
});

test('Given settings with an existing preload, when a test adds another, then it keeps both in order', () => {
  const settings = { NODE_OPTIONS: '--import=file:///portal.js', DEPLOYMENT: 'hosted' };

  assert.deepEqual(withPreload(settings, 'file:///held-work.js'), {
    DEPLOYMENT: 'hosted', NODE_OPTIONS: '--import=file:///portal.js --import=file:///held-work.js',
  });
  assert.equal(settings.NODE_OPTIONS, '--import=file:///portal.js');
});
