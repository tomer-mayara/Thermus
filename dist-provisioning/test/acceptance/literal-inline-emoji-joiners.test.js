import assert from 'node:assert/strict';
import { test } from 'node:test';
import { processHtml } from '../helpers/process-html.js';
for (const [name, body] of [
    ['a joiner-only span', '👩<span>JOINER</span>💻'],
    ['a joiner-only text node', '<span>👩</span>JOINER<span>💻</span>'],
    ['three spans', '<span>👩</span><span>JOINER</span><span>💻</span>'],
]) {
    test(`given literal or encoded emoji joiners across ${name}, when the pipeline runs, then Markdown and findings agree`, async () => {
        const results = [];
        for (const joiner of ['\u200d', '&#8205;', '&#x200D;']) {
            results.push(await processHtml(`<html><body><main><p>${body.replace('JOINER', joiner)}</p></main></body></html>`));
        }
        for (const result of results) {
            assert.deepEqual(Array.from(result.markdown ?? '', (character) => character.codePointAt(0)), [
                0x1f469, 0x200d, 0x1f4bb,
            ]);
            assert.deepEqual(result.found, []);
            assert.deepEqual(result.warnings, []);
            assert.equal(result.removed, 0);
            assert.equal(result.skipped, 0);
        }
    });
}
//# sourceMappingURL=literal-inline-emoji-joiners.test.js.map