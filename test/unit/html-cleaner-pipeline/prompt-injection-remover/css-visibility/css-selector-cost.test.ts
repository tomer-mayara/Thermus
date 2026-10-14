import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createPipeline } from './helpers/css-pipeline.ts';
import { assertWorkPassesInChild } from './helpers/pipeline-child.ts';

const selectorWorkTimeLimitMs = 3000;

describe('CSS selector cost limit', () => {
  for (const { combinators, limit } of [
    { combinators: 32, limit: 'work' },
    { combinators: 100, limit: 'size' },
  ]) {
    test(`rejects ${combinators} repeated descendant combinators within the time limit`, async () => {
      const html = '<style>' + '.x '.repeat(combinators) + '.x{display:none}</style>'
        + '<div class=x>'.repeat(combinators + 2) + 'TARGET' + '</div>'.repeat(combinators + 2);
      const ordinaryHtml = '<!doctype html><html><head><title>Budget reset</title>'
        + '<style>.payload{display:none}</style></head><body><main>'
        + '<p class=payload>Hidden after budget reset</p><p>Visible after budget reset</p>'
        + '</main></body></html>';
      await assertWorkPassesInChild(`
        const pipeline = createPipeline();
        await assert.rejects(
          pipeline.process('https://example.com/selector-cost', ${JSON.stringify(html)}),
          { name: 'RangeError', message: 'CSS selector ${limit} limit exceeded' },
        );
        const result = await pipeline.process('https://example.com/selector-cost-reset', ${JSON.stringify(ordinaryHtml)});
        assert.doesNotMatch(result.html, /Hidden after budget reset/);
        assert.doesNotMatch(result.markdown ?? '', /Hidden after budget reset/);
        assert.match(result.html, /Visible after budget reset/);
        assert.match(result.markdown ?? '', /Visible after budget reset/);
        assert.deepEqual(result.found, ['hidden-html']);
        assert.equal(result.skipped, 0);
      `, selectorWorkTimeLimitMs);
    });
  }

  test('rejects selectors that exceed the source length limit', async () => {
    const selector = `[data-x="${'x'.repeat(5000)}"]`;
    const html = `<style>${selector}{display:none}</style><p data-x="${'x'.repeat(5000)}">Target</p>`;
    await assertWorkPassesInChild(`
      await assert.rejects(
        createPipeline().process('https://example.com/selector-length', ${JSON.stringify(html)}),
        { name: 'RangeError', message: 'CSS selector size limit exceeded' },
      );
    `, selectorWorkTimeLimitMs);
  });

  test('keeps ordinary descendant and sibling selectors working', async () => {
    const html = [
      '<!doctype html><html><head><title>Selector cost control</title>',
      '<style>main section .payload, .before + .adjacent, .before ~ .sibling {display:none}</style>',
      '</head><body><main><section><p class="payload">Hidden descendant</p></section>',
      '<p class="before">Visible selector control</p>',
      '<p class="adjacent">Hidden adjacent</p><p class="sibling">Hidden sibling</p>',
      '</main></body></html>',
    ].join('');

    const result = await createPipeline().process('https://example.com/selectors', html);

    assert.doesNotMatch(result.html, /Hidden (descendant|adjacent|sibling)/);
    assert.doesNotMatch(result.markdown ?? '', /Hidden (descendant|adjacent|sibling)/);
    assert.match(result.markdown ?? '', /Visible selector control/);
    assert.deepEqual(result.found, ['hidden-html']);
    assert.equal(result.skipped, 0);
  });
});
