import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSearch } from '../../support/processes/search-command.ts';

const valid = ['--query', 'Browser documentation', '--reason', 'Find the official documentation'];

test('Given no credential, when search help is requested, then it explains the hosted command and authentication', async (t) => {
  const result = await runSearch(t, ['--help']);
  assert.equal(result.code, 0, result.stderr);
  for (const text of ['--query', '--reason', 'https://app.thermus.ai/mcp', 'Connect OAuth', '--login', '--logout', '--non-interactive', 'THERMUS_API_KEY']) assert.ok(result.stdout.includes(text), text);
  assert.equal(result.stderr, '');
});

for (const [name, args, diagnostic] of [
  ['missing query', ['--reason', 'Find documentation'], /query/],
  ['blank query', ['--query', '  ', '--reason', 'Find documentation'], /query/],
  ['oversized query', ['--query', '🐼'.repeat(513), '--reason', 'Find documentation'], /query/],
  ['missing reason', ['--query', 'Browser'], /reason/],
  ['oversized reason', ['--query', 'Browser', '--reason', '🐼'.repeat(2001)], /reason/],
  ['blank reason', ['--query', 'Browser', '--reason', '  '], /reason/],
  ['insecure endpoint', [...valid, '--endpoint', 'http://private.example/mcp'], /HTTPS|loopback/],
  ['endpoint userinfo', [...valid, '--endpoint', 'https://user:private@localhost/mcp'], /endpoint/],
  ['endpoint fragment', [...valid, '--endpoint', 'https://localhost/mcp#private'], /fragment/],
  ['invalid timeout', [...valid, '--timeout-ms', '99'], /timeout/],
  ['excess timeout', [...valid, '--timeout-ms', '300001'], /timeout/],
  ['credential argument', [...valid, '--api-key', 'private-token'], /argument/],
  ['conflicting control options', ['--login', '--logout'], /alone|unset/],
] as const) {
  test(`Given ${name}, when search runs, then it rejects the input without exposing it`, async (t) => {
    const result = await runSearch(t, args, { credential: 'test-search-token' });
    assert.equal(result.code, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, diagnostic);
    assert.doesNotMatch(result.stderr, /private|test-search-token/);
  });
}

test('Given no saved hosted grant, when search runs non-interactively, then it requests login without opening a browser', async (t) => {
  const result = await runSearch(t, [...valid, '--non-interactive']);
  assert.equal(result.code, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /--login/);
});

test('Given a custom endpoint and no explicit credential, when search runs, then it refuses hosted OAuth', async (t) => {
  const result = await runSearch(t, [...valid, '--endpoint', 'http://127.0.0.1:1/mcp']);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /explicit Bearer/);
});

for (const credential of ['', 'private-token\nHeader: value']) {
  test(`Given ${credential ? 'an invalid' : 'an empty'} explicit credential, when search runs, then it fails without OAuth or private text`, async (t) => {
    const result = await runSearch(t, valid, { credential });
    assert.equal(result.code, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /credential/);
    assert.doesNotMatch(result.stderr, /private-token|Header: value/);
  });
}
