import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createPipeline } from './helpers/css-pipeline.ts';

describe('CSS visibility on explicit document elements', () => {
  for (const tag of ['html', 'body']) {
    for (const selector of [tag, '.payload']) {
      test(`removes the content of ${tag} hidden by ${selector}`, async () => {
        const htmlAttributes = tag === 'html' ? ' class="payload"' : '';
        const bodyAttributes = tag === 'body' ? ' class="payload"' : '';
        const html = [
          `<!doctype html><html${htmlAttributes}><head><title>Document visibility</title>`,
          `<style>${selector}{display:none}</style></head><body${bodyAttributes}>`,
          'HIDDEN DIRECT TEXT<main style="display:block"><p>HIDDEN PAYLOAD</p></main>',
          '</body></html>',
        ].join('');

        const result = await createPipeline().process('https://example.com/hidden-document', html);

        assert.doesNotMatch(result.html, /HIDDEN DIRECT TEXT|HIDDEN PAYLOAD/);
        assert.equal(result.markdown, '');
        assert.deepEqual(result.found, ['hidden-html']);
        assert.equal(result.skipped, 1);
      });
    }

    for (const hidden of [true, false]) {
      test(`applies inline importance on ${tag} when hidden=${hidden}`, async () => {
        const style = hidden ? 'display:none!important;display:block'
          : 'display:block!important;display:none';
        const htmlAttributes = tag === 'html' ? ` style="${style}"` : '';
        const bodyAttributes = tag === 'body' ? ` style="${style}"` : '';
        const html = [
          `<!doctype html><html${htmlAttributes}><head><title>Inline visibility</title>`,
          `</head><body${bodyAttributes}><main><p>Document content</p></main></body></html>`,
        ].join('');

        const result = await createPipeline().process('https://example.com/inline-document', html);

        assert.equal(result.html.includes('Document content'), !hidden);
        assert.equal(result.markdown?.includes('Document content'), !hidden);
        assert.deepEqual(result.found, hidden ? ['hidden-html'] : []);
        assert.equal(result.skipped, Number(hidden));
      });
    }
  }
});
