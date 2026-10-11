import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createPipeline } from './helpers/css-pipeline.ts';

const threatUrl = `https://attacker.example/?payload=${'a'.repeat(128)}`;

describe('CSS visibility for duplicate document source tags', () => {
  for (const document of ['html', 'body', 'implied-body']) {
    for (const formed of [false, true]) {
      test(`removes hidden attributes from ${document} duplicates when formed=${formed}`, async () => {
        const tag = document === 'implied-body' ? 'body' : document;
        const start = document === 'implied-body' ? '' : `<${tag}>`;
        const end = document === 'implied-body' ? '' : `</${tag}>`;
        const cut = formed ? '<span hidden>HIDDEN CUT</span>' : '';
        const html = `${start}<main><style>.payload{display:none}</style><p>HIDDEN ORIGINAL</p>`
          + `<${cut}${tag} class="payload" title="SECRET_TITLE" href="${threatUrl}">`
          + `<p>HIDDEN LATER</p></main>${end}`;

        const result = await createPipeline().process('https://example.com/duplicate-source', html);

        assert.doesNotMatch(result.html, /SECRET_TITLE|HIDDEN ORIGINAL|HIDDEN LATER|HIDDEN CUT/);
        assert.ok(!result.html.includes(threatUrl));
        assert.equal(result.markdown, '');
        assert.deepEqual([...result.found ?? []].sort(), ['exfil-urls', 'hidden-html']);
        assert.equal(result.skipped, 0);
        const warnings = result.warnings?.join('\n') ?? '';
        assert.match(warnings, /link to attacker\.example: suspicious query parameter/);
        assert.equal(warnings.match(/link to attacker\.example: suspicious query parameter/g)?.length, 1);
        assert.doesNotMatch(warnings, /scan failed|scan limit/);
      });
    }
  }

  for (const tag of ['html', 'body']) {
    test(`keeps visible duplicate ${tag} source tags and attributes`, async () => {
      const html = `<${tag}><main><p>VISIBLE BEFORE</p>`
        + `<${tag} title="VISIBLE TITLE" href="https://example.com/visible">`
        + `<p>VISIBLE AFTER</p></main></${tag}>`;

      const result = await createPipeline().process('https://example.com/visible-duplicate', html);

      assert.equal(result.html, html);
      assert.match(result.markdown ?? '', /VISIBLE BEFORE/);
      assert.match(result.markdown ?? '', /VISIBLE AFTER/);
      assert.deepEqual(result.found, []);
      assert.equal(result.skipped, 0);
    });
  }

  for (const prefix of ['<body>', '']) {
    test(`normalizes a visible style on a duplicate body with prefix=${prefix}`, async () => {
      const html = `${prefix}<main><p>VISIBLE BEFORE</p>`
        + '<body style="display:block!important;display:none"><p>VISIBLE AFTER</p></main></body>';

      const result = await createPipeline().process('https://example.com/visible-duplicate-style', html);

      assert.match(result.html, /VISIBLE BEFORE/);
      assert.match(result.html, /VISIBLE AFTER/);
      assert.match(result.markdown ?? '', /VISIBLE BEFORE/);
      assert.match(result.markdown ?? '', /VISIBLE AFTER/);
      assert.deepEqual(result.found, []);
      assert.equal(result.skipped, 0);
    });
  }
});
