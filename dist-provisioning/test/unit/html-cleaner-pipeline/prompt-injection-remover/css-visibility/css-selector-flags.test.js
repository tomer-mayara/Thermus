import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createPipeline } from './helpers/css-pipeline.js';
describe('CSS attribute selector flags', () => {
    test('decodes escaped insensitive and sensitive flags', async () => {
        const html = String.raw `<html><head><title>Flag test</title><style>[data-insensitive="a" \69], [data-sensitive="a" \73] { display:none; }</style></head><body>
      <p data-insensitive="A">Hidden escaped insensitive text</p>
      <p data-sensitive="A">Visible escaped sensitive control</p>
      <p data-sensitive="a">Hidden escaped sensitive text</p>
      <p>Visible paragraph control</p></body></html>`;
        const result = await createPipeline().process('https://example.com/', html);
        assert.doesNotMatch(result.markdown ?? '', /Hidden escaped insensitive text/);
        assert.doesNotMatch(result.markdown ?? '', /Hidden escaped sensitive text/);
        assert.match(result.markdown ?? '', /Visible escaped sensitive control/);
        assert.match(result.markdown ?? '', /Visible paragraph control/);
        assert.ok(result.found?.includes('hidden-html'));
    });
    test('keeps plain insensitive and sensitive flag behavior', async () => {
        const html = `<html><head><title>Flag test</title><style>[data-insensitive="a" i], [data-sensitive="a" s] { display:none; }</style></head><body>
      <p data-insensitive="A">Hidden plain insensitive text</p>
      <p data-sensitive="A">Visible plain sensitive control</p>
      <p data-sensitive="a">Hidden plain sensitive text</p></body></html>`;
        const result = await createPipeline().process('https://example.com/', html);
        assert.doesNotMatch(result.markdown ?? '', /Hidden plain insensitive text/);
        assert.doesNotMatch(result.markdown ?? '', /Hidden plain sensitive text/);
        assert.match(result.markdown ?? '', /Visible plain sensitive control/);
        assert.ok(result.found?.includes('hidden-html'));
    });
});
//# sourceMappingURL=css-selector-flags.test.js.map