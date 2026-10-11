import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createPipeline } from './helpers/css-pipeline.ts';

const formatWarning = 'Stripped: Format chars (Cf) — inspect the removed bytes with a hex dump (xxd / od -c), which survives sanitization';

describe('findings for cleared inline styles', () => {
  test('reports a decoded control from a visible style that the scanner clears', async () => {
    const result = await createPipeline().process(
      'https://example.com/style-control',
      '<html><body><p style="color:red&#x200b;">Visible ordinary style</p></body></html>',
    );

    assert.match(result.html, /<p style="">Visible ordinary style<\/p>/);
    assert.equal(result.markdown, 'Visible ordinary style');
    assert.equal(result.skipped, 0);
    assert.deepEqual(result.found, ['cf-format']);
    assert.deepEqual(result.warnings, [formatWarning]);
  });

  test('reports decoded controls from duplicate body style tokens once', async () => {
    const result = await createPipeline().process(
      'https://example.com/duplicate-body-style',
      '<html><body style="color:red&#x200b;"><body style="color:blue&#x200b;">'
        + '<p>Visible duplicate body style</p></body></html>',
    );

    assert.doesNotMatch(result.html, /&#x200b;/);
    assert.equal(result.markdown, 'Visible duplicate body style');
    assert.equal(result.skipped, 0);
    assert.deepEqual(result.found, ['cf-format']);
    assert.deepEqual(result.warnings, [formatWarning]);
  });

  test('does not count the decoded style finding twice when raw text already reported it', async () => {
    const result = await createPipeline().process(
      'https://example.com/style-control-dedupe',
      '<html><body><p>left\u200bright</p>'
        + '<p style="color:red&#x200b;">Visible ordinary style</p></body></html>',
    );

    assert.equal(result.markdown, 'leftright\n\nVisible ordinary style');
    assert.equal(result.skipped, 0);
    assert.deepEqual(result.found, ['cf-format']);
    assert.deepEqual(result.warnings, [formatWarning]);
  });

  test('does not decode an escaped entity example in a cleared style twice', async () => {
    const result = await createPipeline().process(
      'https://example.com/style-escaped-example',
      '<html><body><p style="color:red&amp;#x200b;">Visible escaped entity example</p></body></html>',
    );

    assert.equal(result.markdown, 'Visible escaped entity example');
    assert.equal(result.skipped, 0);
    assert.deepEqual(result.found, []);
    assert.deepEqual(result.warnings, []);
  });
});
