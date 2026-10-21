import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertUsefulLightpandaResult } from '../../support/dsl/search-results.ts';

test('Given a numbered Lightpanda result with its own useful description, when the live result is checked, then it passes', () => {
  const markdown = '1. [Lightpanda browser project](https://example.org/project)\n\n'
    + '   An open source headless browser built for fast automation and machine use.';

  assert.doesNotThrow(() => assertUsefulLightpandaResult(markdown));
});

test('Given a numbered Lightpanda result without a description, when only the next row has one, then the live result check fails', () => {
  const markdown = '1. [Lightpanda browser project](https://example.org/project)\n\n'
    + '2. [Other browser project](https://example.net/other)\n\n'
    + '   A different headless browser built for fast automation and machine use.';

  assert.throws(() => assertUsefulLightpandaResult(markdown));
});

test('Given a numbered Lightpanda result whose description has a safe inline link, when the live result is checked, then it passes', () => {
  const markdown = '1. [Lightpanda browser project](https://example.org/project)\n\n'
    + '   Explore [an open source headless browser built for fast automation and machine use](https://example.org/guide).';

  assert.doesNotThrow(() => assertUsefulLightpandaResult(markdown));
});

test('Given two result links in one numbered row, when only the other result has a description, then the live result check fails', () => {
  const markdown = '1. [Lightpanda browser project](https://example.org/project) '
    + '[Other browser project](https://example.net/other) '
    + 'A different headless browser built for fast automation and machine use.';

  assert.throws(() => assertUsefulLightpandaResult(markdown));
});

test('Given a useful external Lightpanda title followed by its description, when the live result is checked, then it passes', () => {
  const markdown = '[Lightpanda browser project](https://example.org/project)\n\n'
    + 'An open source headless browser built for fast automation and machine use.';

  assert.doesNotThrow(() => assertUsefulLightpandaResult(markdown));
});

test('Given a useful external Lightpanda title with its description in the same paragraph, when the live result is checked, then it passes', () => {
  const markdown = '[Lightpanda browser guide](https://example.org/guide) '
    + 'Learn how this headless browser supports automation with a small memory footprint.';

  assert.doesNotThrow(() => assertUsefulLightpandaResult(markdown));
});

test('Given a Lightpanda result without a description and an unrelated footer paragraph, when the live result is checked, then it fails', () => {
  const markdown = '[Lightpanda browser project](https://example.org/project)\n\n'
    + '## Footer\n\n'
    + 'This search site uses browser settings to manage your preferences and privacy choices.';

  assert.throws(() => assertUsefulLightpandaResult(markdown));
});

test('Given a Lightpanda result without a description before another result, when only the other result has a description, then it fails', () => {
  const markdown = '[Lightpanda browser project](https://example.org/project)\n\n'
    + '[Other browser project](https://example.net/other)\n\n'
    + 'A different headless browser built for fast automation and machine use.';

  assert.throws(() => assertUsefulLightpandaResult(markdown));
});

test('Given a Lightpanda result followed by another result and its description in one paragraph, when checked, then it fails', () => {
  const markdown = '[Lightpanda browser project](https://example.org/project)\n\n'
    + '[Other browser project](https://example.net/other) '
    + 'A different headless browser built for fast automation and machine use.';

  assert.throws(() => assertUsefulLightpandaResult(markdown));
});

test('Given a useful description after a Brave navigation link, when the live result is checked, then it fails', () => {
  const markdown = '[Lightpanda browser search](https://search.brave.com/search?q=lightpanda)\n\n'
    + 'An open source headless browser built for fast automation and machine use.';

  assert.throws(() => assertUsefulLightpandaResult(markdown));
});

test('Given a useful description only inside a result title, when the live result is checked, then it fails', () => {
  const markdown = '[Lightpanda is an open source headless browser built for fast automation and machine use.](https://example.org/project)';

  assert.throws(() => assertUsefulLightpandaResult(markdown));
});

test('Given a Lightpanda result and a useful paragraph after a rule, when the live result is checked, then it fails', () => {
  const markdown = '[Lightpanda browser project](https://example.org/project)\n\n'
    + '---\n\n'
    + 'This search site uses browser settings to manage your preferences and privacy choices.';

  assert.throws(() => assertUsefulLightpandaResult(markdown));
});

test('Given two result links in one paragraph with only the other result description, when the live result is checked, then it fails', () => {
  const markdown = '[Lightpanda browser project](https://example.org/project) '
    + '[Other browser project](https://example.net/other) '
    + 'A different headless browser built for fast automation and machine use.';

  assert.throws(() => assertUsefulLightpandaResult(markdown));
});
