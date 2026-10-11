import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Defuddle } from 'defuddle/node';
import { parseHTML } from 'linkedom';

const bodies = [
  ['literal emoji', '👩\u200d💻'],
  ['decimal references', '&#128105;&#8205;&#128187;'],
  ['hexadecimal references', '&#x1F469;&#x200D;&#x1F4BB;'],
  ['a joiner-only span', '👩<span>\u200d</span>💻'],
  ['a joiner-only text node', '<span>👩</span>\u200d<span>💻</span>'],
  ['three spans', '<span>👩</span><span>\u200d</span><span>💻</span>'],
] as const;

for (const [name, body] of bodies) {
  test(`Defuddle keeps woman-technologist code points from ${name}`, async () => {
    const { document } = parseHTML(`<html><body><main><p>${body}</p></main></body></html>`);

    const result = await Defuddle(document, 'https://example.com/', {
      markdown: true,
      useAsync: false,
    });

    assert.deepEqual(Array.from(result.content, (character) => character.codePointAt(0)), [
      0x1f469, 0x200d, 0x1f4bb,
    ]);
  });
}
