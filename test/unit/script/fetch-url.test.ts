import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runFetchUrl } from '../../support/processes/fetch-url-command.ts';

const valid = ['--url', 'https://example.com', '--reason', 'Debug fetch'];

test('Given no credential, when help is requested, then it explains the tool and current authentication', async (t) => {
  const result = await runFetchUrl(t, ['--help']);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /getURLAsMarkdown/);
  assert.match(result.stdout, /Connect OAuth/);
  assert.match(result.stdout, /THERMUS_API_KEY/);
  assert.equal(result.stderr, '');
});

for (const [name, args, credential, diagnostic] of [
  ['missing credential', valid, undefined, /credential/i],
  ['missing URL', ['--reason', 'Debug fetch'], 'test-token', /URL/],
  ['blank reason', ['--url', 'https://example.com', '--reason', '  '], 'test-token', /reason/],
  ['missing reason', ['--url', 'https://example.com'], 'test-token', /reason/],
  ['invalid page URL', ['--url', 'file:///tmp/page', '--reason', 'Debug'], 'test-token', /URL/],
  ['insecure endpoint', [...valid, '--endpoint', 'http://example.com/mcp'], 'test-token', /HTTPS|loopback/],
  ['embedded endpoint credential', [...valid, '--endpoint', 'https://name:private@localhost/mcp'], 'test-token', /endpoint/i],
  ['endpoint fragment', [...valid, '--endpoint', 'https://example.com/mcp#secret'], 'test-token', /endpoint/i],
  ['invalid timeout', [...valid, '--timeout-ms', '0'], 'test-token', /timeout/],
  ['unbounded timeout', [...valid, '--timeout-ms', '99999999'], 'test-token', /timeout/],
  ['unknown option', [...valid, '--api-key', 'private-value'], 'test-token', /option|argument/i],
  ['invalid credential', valid, 'private-value\nHeader: value', /credential/i],
] as const) {
  test(`Given ${name}, when the command runs, then it fails without revealing input`, async (t) => {
    const result = await runFetchUrl(t, args, { credential });
    assert.equal(result.code, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, diagnostic);
    assert.doesNotMatch(result.stderr, /private|Header: value|test-token/);
  });
}

test('Given an open credential pipe, when the deadline passes, then the command exits with a timeout', { timeout: 5_000 }, async (t) => {
  const result = await runFetchUrl(t, [...valid, '--api-key-stdin', '--timeout-ms', '150'], { keepInputOpen: true });
  assert.equal(result.code, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /timed out/i);
});

for (const input of ['', 'x'.repeat(65_537)]) {
  test(`Given ${input.length ? 'oversized' : 'empty'} stdin, when the command reads the credential, then it refuses without using the environment credential`, async (t) => {
    const result = await runFetchUrl(t, [...valid, '--api-key-stdin'], { input, credential: 'private-env-token' });
    assert.equal(result.code, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /credential/);
    assert.doesNotMatch(result.stderr, /private-env-token/);
  });
}
