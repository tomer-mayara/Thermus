import assert from 'node:assert/strict';
import { test } from 'node:test';
import { processHtml } from '../helpers/process-html.js';
const formatWarning = 'Stripped: Format chars (Cf) — inspect the removed bytes with a hex dump (xxd / od -c), which survives sanitization';
const encodings = [
    { name: 'literal', emoji: '👩\u200d💻', joiner: '\u200d', bidi: '\u202e' },
    { name: 'decimal', emoji: '&#128105;&#8205;&#128187;', joiner: '&#8205;', bidi: '&#8238;' },
    { name: 'hexadecimal', emoji: '&#x1F469;&#x200D;&#x1F4BB;', joiner: '&#x200D;', bidi: '&#x202E;' },
];
for (const { name, emoji, joiner, bidi } of encodings) {
    test(`given a ${name} woman-technologist emoji, when the pipeline converts HTML, then Markdown keeps its joiner`, async () => {
        const result = await processHtml(`<html><body><main><p>${emoji}</p></main></body></html>`);
        assert.deepEqual(Array.from(result.markdown ?? '', (character) => character.codePointAt(0)), [
            0x1f469, 0x200d, 0x1f4bb,
        ]);
        assert.equal(result.removed, 0);
        assert.equal(result.skipped, 0);
        assert.deepEqual(result.found, []);
        assert.deepEqual(result.warnings, []);
    });
    test(`given a ${name} prohibited bidi control, when the pipeline converts HTML, then it removes and reports the control`, async () => {
        const result = await processHtml(`<html><body><main><p>left${bidi}right.</p></main></body></html>`);
        assert.equal(result.markdown, 'leftright.');
        assert.deepEqual(result.found, ['cf-format']);
        assert.deepEqual(result.warnings, [formatWarning]);
    });
    test(`given a ${name} joiner in an ASCII word, when the pipeline converts HTML, then it removes and reports the joiner`, async () => {
        const result = await processHtml(`<html><body><main><p>left${joiner}right.</p></main></body></html>`);
        assert.equal(result.markdown, 'leftright.');
        assert.deepEqual(result.found, ['cf-format']);
        assert.deepEqual(result.warnings, [formatWarning]);
    });
}
for (const [name, body] of [
    ['a joiner-only span', '👩<span>&#x200D;</span>💻'],
    ['a joiner-only text node', '<span>👩</span>&#8205;<span>💻</span>'],
    ['three spans', '<span>👩</span><span>&#x200D;</span><span>💻</span>'],
]) {
    test(`given an emoji split across ${name}, when the pipeline converts HTML, then Markdown keeps its sequence`, async () => {
        const result = await processHtml(`<html><body><main><p>${body}</p></main></body></html>`);
        assert.deepEqual(Array.from(result.markdown ?? '', (character) => character.codePointAt(0)), [
            0x1f469, 0x200d, 0x1f4bb,
        ]);
        assert.deepEqual(result.found, []);
        assert.deepEqual(result.warnings, []);
    });
}
//# sourceMappingURL=emoji-joiners.test.js.map