import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { serveSearchDebugSite } from '../../support/in-process/search-debug-site.ts';
import { serveFetchUrlOAuthSite } from '../../support/in-process/fetch-url-oauth-site.ts';
import { fetchUrlState } from '../../support/isolation/fetch-url-state.ts';
import { runSearch } from '../../support/processes/search-command.ts';
import { runFetchUrl } from '../../support/processes/fetch-url-command.ts';

test('Given a saved OAuth grant, when search runs non-interactively, then it sends the saved Bearer token and preserves the grant', async (t) => {
  const site = await serveSearchDebugSite(t);
  const stateDirectory = await fetchUrlState(t);
  const directory = join(stateDirectory, 'thermus/mcp-fetch');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const profile = { endpoint: site.endpoint, issuer: 'https://oauth.example', clientId: 'test-search-client' };
  const record = JSON.stringify({ version: 1, binding: profile, status: 'ready', accessToken: 'test-search-token', expiresAt: Date.now() + 300_000 });
  const path = join(directory, 'grant.json');
  await writeFile(path, record, { mode: 0o600 });
  const result = await runSearch(t, ['--endpoint', site.endpoint, '--query', 'Browser', '--reason', 'Find documentation', '--non-interactive'], { stateDirectory, oauth: { profile, interactive: false } });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout, '# Results\n\n[Browser](https://example.com/browser)\n');
  assert.deepEqual(site.calls, [{ query: 'Browser', reason: 'Find documentation' }]);
  assert.equal(await readFile(path, 'utf8'), record);
  assert.ok(site.requests.every(({ authorization }) => authorization === 'Bearer test-search-token'));
});

test('Given search browser login, when fetch reuses its grant and search logs out, then both commands share the local grant', { timeout: 15_000 }, async (t) => {
  const site = await serveFetchUrlOAuthSite(t);
  const stateDirectory = await fetchUrlState(t);
  const control = ['--endpoint', site.profile.endpoint];
  const login = await runSearch(t, [...control, '--login'], { stateDirectory, oauth: site });
  assert.equal(login.code, 0, login.stderr);
  assert.equal(login.stdout, '');
  assert.match(login.stderr, /Hosted login saved/);
  const fetched = await runFetchUrl(t, [...control, '--url', 'https://example.com', '--reason', 'Read documentation', '--non-interactive'], { stateDirectory, oauth: site });
  assert.equal(fetched.code, 0, fetched.stderr);
  assert.equal(site.requests.filter(({ path }) => path === '/token').length, 1);
  const beforeLogout = site.requests.length;
  const logout = await runSearch(t, [...control, '--logout', '--non-interactive'], { stateDirectory, oauth: site });
  assert.equal(logout.code, 0, logout.stderr);
  assert.equal(logout.stdout, '');
  assert.match(logout.stderr, /Local grant deleted/);
  assert.equal(site.requests.length, beforeLogout);
  await assert.rejects(() => readFile(join(stateDirectory, 'thermus/mcp-fetch/grant.json')), { code: 'ENOENT' });
  assert.doesNotMatch(login.stderr + fetched.stderr + logout.stderr, /oauth-access|oauth-refresh|test-code/);
});
