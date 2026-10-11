import assert from 'node:assert/strict';
import { test } from 'node:test';
import adblockRust from 'adblock-rs';
import { CleanHtmlAdsAdblockRs } from '../../src/html-cleaner-pipeline/ad-cleaner/adb/clean-html-ads-adblock-rs.ts';
import { createContext } from '../support/html-cleaner-context.ts';

test('counts unsupported selector and procedural attempts on each invocation', async (t) => {
  t.mock.method(adblockRust.Engine.prototype, 'urlCosmeticResources', () => ({
    hide_selectors: ['.ad', '.ad:unsupported'], procedural_actions: ['unsupported action'],
    exceptions: [], injected_script: '', generichide: true,
  }));
  const cleaner = new CleanHtmlAdsAdblockRs('');
  const input = createContext('<div class="ad">Ad</div><p>Visible</p>', {
    removed: 4, skipped: 3, found: ['hidden-html'], warnings: ['Existing warning'],
  });
  const original = structuredClone(input);

  const result = await cleaner.invoke(input);
  const repeated = await cleaner.invoke(result);

  assert.equal(result.html, '<p>Visible</p>');
  assert.equal(result.removed, 5);
  assert.equal(result.skipped, 5);
  assert.equal(repeated.removed, 5);
  assert.equal(repeated.skipped, 7);
  assert.deepEqual(result.found, input.found);
  assert.deepEqual(result.warnings, input.warnings);
  assert.deepEqual(input, original);
});
