import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchToolInputSchema, isValidFetchUrl, parseFetchToolArguments } from '../../../src/mcp/fetch-tool-schema.ts';

const validUrl = 'https://example.com/page';

test('Given the fetch tool schema, when inspected, then url and reason are the only required string properties', () => {
  assert.equal(fetchToolInputSchema.type, 'object');
  assert.deepEqual(fetchToolInputSchema.required, ['url', 'reason']);
  assert.equal(fetchToolInputSchema.additionalProperties, false);
  assert.deepEqual(Object.keys(fetchToolInputSchema.properties), ['url', 'reason']);
  assert.equal(fetchToolInputSchema.properties.url.maxLength, 8_192);
  assert.equal(fetchToolInputSchema.properties.reason.maxLength, 2_000);
});

for (const argumentsValue of [
  undefined, null, [], {}, { url: validUrl }, { url: validUrl, reason: '' }, { url: validUrl, reason: ' \n\t\u2003' },
  { url: validUrl, reason: 'x'.repeat(2_001) }, { url: validUrl, reason: '😀'.repeat(2_001) },
  { url: validUrl, reason: 1 }, { url: validUrl, reason: 'read', extra: 'secret' },
  { url: '', reason: 'read' }, { url: 1, reason: 'read' }, { reason: 'read' },
  { url: 'https://example.com/' + 'x'.repeat(8_192), reason: 'read' },
]) {
  test(`Given invalid argument shape ${JSON.stringify(argumentsValue)?.slice(0, 75)}, when parsed, then it is rejected`, async () => {
    assert.equal(await parseFetchToolArguments(argumentsValue), undefined);
  });
}

for (const url of ['/page', 'example.com', 'file:///page', 'ftp://example.com', 'https:', 'https:///page', 'https://user:pass@example.com/page', 'https://@example.com', 'https://example.com\n/secret', ' https://example.com']) {
  test(`Given invalid URL ${JSON.stringify(url)}, when checked, then dispatch and operation URL validation both reject it`, async () => {
    assert.equal(isValidFetchUrl(url), false);
    assert.equal(await parseFetchToolArguments({ url, reason: 'Read this page' }), undefined);
  });
}

for (const reason of ['a', '😀', 'x'.repeat(2_000), '😀'.repeat(2_000), 'a\nline']) {
  test(`Given a valid reason of ${Array.from(reason).length} code points, when parsed, then the complete spelling is kept`, async () => {
    const args = { url: validUrl, reason };
    assert.deepEqual(await parseFetchToolArguments(args), args);
  });
}

test('Given a URL of exactly 8192 code points with supplementary characters, when parsed, then the complete URL is kept and one more code point is rejected', async () => {
  const prefix = 'HTTPS://Example.COM/';
  const url = prefix + '😀'.repeat(8_192 - prefix.length);
  assert.deepEqual(await parseFetchToolArguments({ url, reason: 'read' }), { url, reason: 'read' });
  assert.equal(await parseFetchToolArguments({ url: url + '😀', reason: 'read' }), undefined);
});
