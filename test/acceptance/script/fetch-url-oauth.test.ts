import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { serveFetchUrlOAuthSite } from '../../support/in-process/fetch-url-oauth-site.ts';
import { fetchUrlState } from '../../support/isolation/fetch-url-state.ts';
import { runFetchUrl } from '../../support/processes/fetch-url-command.ts';

test('Given no saved credentials, when an interactive hosted fetch authorizes through the browser, then it sends one tool call and exact Markdown', { timeout: 15_000 }, async (t) => {
  const site = await serveFetchUrlOAuthSite(t);
  const result = await runFetchUrl(t, ['--endpoint', site.profile.endpoint, '--url', 'https://example.com', '--reason', 'Inspect the page'], { oauth: site });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout, '# Page\n\nExact Markdown.\n');
  assert.deepEqual(site.calls, [{ url: 'https://example.com', reason: 'Inspect the page' }]);
  assert.equal(site.requests.filter(({ path }) => path === '/token').length, 1);
  assert.doesNotMatch(result.stderr, /oauth-access|oauth-refresh|test-code|private-token-secret/);
});


const fetchArgs = (endpoint: string) => ['--endpoint', endpoint, '--url', 'https://example.com', '--reason', 'Inspect the page'];
const recordPath = (directory: string) => join(directory, 'thermus/mcp-fetch/grant.json');
async function expire(directory: string) {
  const path = recordPath(directory);
  const record = JSON.parse(await readFile(path, 'utf8'));
  await writeFile(path, JSON.stringify({ ...record, expiresAt: Date.now() + 1_000 }));
}

test('Given a saved hosted grant, when non-interactive fetch runs, then it reuses the unchanged absolute expiry without browser or refresh', async (t) => {
  const site = await serveFetchUrlOAuthSite(t);
  const stateDirectory = await fetchUrlState(t);
  const args = fetchArgs(site.profile.endpoint);
  assert.equal((await runFetchUrl(t, args, { oauth: site, stateDirectory })).code, 0);
  const first = await readFile(recordPath(stateDirectory), 'utf8');
  const result = await runFetchUrl(t, [...args, '--non-interactive'], { oauth: site, stateDirectory });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout, '# Page\n\nExact Markdown.\n');
  assert.equal(await readFile(recordPath(stateDirectory), 'utf8'), first);
  assert.equal(site.requests.filter(({ path }) => path === '/authorize').length, 1);
  assert.equal(site.requests.filter(({ path }) => path === '/token').length, 1);
});

test('Given expiring access and a saved refresh token, when non-interactive fetch runs, then one refresh saves the rotated grant before the tool', async (t) => {
  const site = await serveFetchUrlOAuthSite(t);
  const stateDirectory = await fetchUrlState(t);
  const args = fetchArgs(site.profile.endpoint);
  assert.equal((await runFetchUrl(t, args, { oauth: site, stateDirectory })).code, 0);
  await expire(stateDirectory);
  const result = await runFetchUrl(t, [...args, '--non-interactive'], { oauth: site, stateDirectory });
  assert.equal(result.code, 0, result.stderr);
  const saved = JSON.parse(await readFile(recordPath(stateDirectory), 'utf8'));
  assert.equal(saved.refreshToken, 'oauth-refresh-2');
  const refresh = site.requests.filter(({ form }) => form?.grant_type === 'refresh_token');
  assert.equal(refresh.length, 1);
  assert.equal(refresh[0]?.form?.resource, site.profile.endpoint);
  assert.equal(site.requests.filter(({ path }) => path === '/authorize').length, 1);
  assert.equal(site.calls.length, 2);
  assert.doesNotMatch(result.stderr, /oauth-access|oauth-refresh|private-token-secret/);
});

test('Given a refresh refusal, when fetch fails and is repeated interactively, then the marker prevents another refresh or browser fallback', async (t) => {
  const site = await serveFetchUrlOAuthSite(t, { refreshFailure: true });
  const stateDirectory = await fetchUrlState(t);
  const args = fetchArgs(site.profile.endpoint);
  assert.equal((await runFetchUrl(t, args, { oauth: site, stateDirectory })).code, 0);
  await expire(stateDirectory);
  const first = await runFetchUrl(t, args, { oauth: site, stateDirectory });
  assert.equal(first.code, 1);
  assert.match(first.stderr, /--login/);
  const marker = JSON.parse(await readFile(recordPath(stateDirectory), 'utf8'));
  assert.equal(marker.status, 'login-required');
  assert.equal(marker.refreshToken, undefined);
  const repeated = await runFetchUrl(t, args, { oauth: site, stateDirectory });
  assert.equal(repeated.code, 1);
  assert.equal(repeated.stdout, '');
  assert.equal(site.requests.filter(({ form }) => form?.grant_type === 'refresh_token').length, 1);
  assert.equal(site.requests.filter(({ path }) => path === '/authorize').length, 1);
  assert.equal(site.calls.length, 1);
  assert.doesNotMatch(first.stderr + repeated.stderr, /private-token-secret|oauth-refresh/);
});

test('Given access without refresh credentials, when it nears expiry, then fetch requires explicit login without inventing offline support', async (t) => {
  const site = await serveFetchUrlOAuthSite(t, { omitRefresh: true });
  const stateDirectory = await fetchUrlState(t);
  const args = fetchArgs(site.profile.endpoint);
  assert.equal((await runFetchUrl(t, args, { oauth: site, stateDirectory })).code, 0);
  await expire(stateDirectory);
  const result = await runFetchUrl(t, args, { oauth: site, stateDirectory });
  assert.equal(result.code, 1);
  assert.match(result.stderr, /--login/);
  assert.equal(site.requests.filter(({ path }) => path === '/token').length, 1);
  assert.equal(site.calls.length, 1);
});

test('Given a saved grant, when fresh login and local logout run, then login replaces it and logout retains the lock inode without remote calls', async (t) => {
  const site = await serveFetchUrlOAuthSite(t);
  const stateDirectory = await fetchUrlState(t);
  const control = ['--endpoint', site.profile.endpoint];
  assert.equal((await runFetchUrl(t, [...control, '--login'], { oauth: site, stateDirectory })).code, 0);
  const first = await readFile(recordPath(stateDirectory), 'utf8');
  assert.equal((await runFetchUrl(t, [...control, '--login'], { oauth: site, stateDirectory })).code, 0);
  assert.notEqual(await readFile(recordPath(stateDirectory), 'utf8'), first);
  const lock = join(stateDirectory, 'thermus/mcp-fetch/grant.lock');
  const inode = (await stat(lock)).ino;
  const before = site.requests.length;
  const result = await runFetchUrl(t, [...control, '--logout', '--non-interactive'], { oauth: site, stateDirectory });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /Remote authorization.*remain/);
  await assert.rejects(() => readFile(recordPath(stateDirectory)), { code: 'ENOENT' });
  assert.equal((await stat(lock)).ino, inode);
  assert.equal(site.requests.length, before);
  assert.equal(site.calls.length, 0);
});

for (const fault of ['badIssuer', 'badResource', 'denied'] as const) {
  test(`Given ${fault} authorization, when interactive fetch runs, then it fails without tool work or remote diagnostics`, async (t) => {
    const site = await serveFetchUrlOAuthSite(t, { [fault]: true });
    const result = await runFetchUrl(t, fetchArgs(site.profile.endpoint), { oauth: site });
    assert.equal(result.code, 1);
    assert.equal(result.stdout, '');
    assert.equal(site.calls.length, 0);
    assert.equal(site.requests.filter(({ path }) => path === '/token').length, 0);
    assert.doesNotMatch(result.stderr, /evil.example|access_denied|private-token-secret/);
  });
}


test('Given refresh without a replacement refresh token, when it succeeds, then the saved grant retains the existing refresh token', async (t) => {
  const site = await serveFetchUrlOAuthSite(t, { omitRefreshOnRefresh: true });
  const stateDirectory = await fetchUrlState(t);
  const args = fetchArgs(site.profile.endpoint);
  assert.equal((await runFetchUrl(t, args, { oauth: site, stateDirectory })).code, 0);
  await expire(stateDirectory);
  const result = await runFetchUrl(t, args, { oauth: site, stateDirectory });
  assert.equal(result.code, 0, result.stderr);
  const record = JSON.parse(await readFile(recordPath(stateDirectory), 'utf8'));
  assert.equal(record.accessToken, 'oauth-access-2');
  assert.equal(record.refreshToken, 'oauth-refresh-1');
});

test('Given an existing grant, when fresh login is denied, then the prior record stays and no tool runs', async (t) => {
  const behavior = { denied: false };
  const site = await serveFetchUrlOAuthSite(t, behavior);
  const stateDirectory = await fetchUrlState(t);
  const args = ['--endpoint', site.profile.endpoint, '--login'];
  assert.equal((await runFetchUrl(t, args, { oauth: site, stateDirectory })).code, 0);
  const previous = await readFile(recordPath(stateDirectory), 'utf8');
  behavior.denied = true;
  const result = await runFetchUrl(t, args, { oauth: site, stateDirectory });
  assert.equal(result.code, 1);
  assert.match(result.stderr, /denied/);
  assert.equal(await readFile(recordPath(stateDirectory), 'utf8'), previous);
  assert.equal(site.calls.length, 0);
});

for (const action of ['wait', 'cancel'] as const) {
  test(`Given pending browser ${action}, when authorization ends, then a later login can reacquire the listener and lock`, { timeout: 5_000 }, async (t) => {
    const site = await serveFetchUrlOAuthSite(t);
    const stateDirectory = await fetchUrlState(t);
    const args = ['--endpoint', site.profile.endpoint, '--login'];
    const result = await runFetchUrl(t, args, { stateDirectory, oauth: { ...site, ...(action === 'wait' ? { authTimeoutMs: 150 } : {}), browserAction: action } });
    assert.equal(result.code, 1);
    assert.match(result.stderr, action === 'wait' ? /timed out/ : /cancelled/);
    assert.equal(result.stdout, '');
    const recovered = await runFetchUrl(t, args, { stateDirectory, oauth: site });
    assert.equal(recovered.code, 0, recovered.stderr);
  });
}

test('Given a busy callback port, when login starts, then it fails before opening the browser or exchanging a code', async (t) => {
  const site = await serveFetchUrlOAuthSite(t);
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(Number(new URL(site.redirectUrl).port), '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const result = await runFetchUrl(t, ['--endpoint', site.profile.endpoint, '--login'], { oauth: site });
  assert.equal(result.code, 1);
  assert.match(result.stderr, /busy/);
  assert.equal(site.requests.filter(({ path }) => path === '/authorize' || path === '/token').length, 0);
});

test('Given a token response without expiry, when authorization exchanges the code, then it fails without saving or running a tool', async (t) => {
  const site = await serveFetchUrlOAuthSite(t, { tokenResponse: { expires_in: null, id_token: 'private-token-secret' } });
  const stateDirectory = await fetchUrlState(t);
  const result = await runFetchUrl(t, fetchArgs(site.profile.endpoint), { oauth: site, stateDirectory });
  assert.equal(result.code, 1);
  assert.equal(result.stdout, '');
  assert.equal(site.calls.length, 0);
  await assert.rejects(() => readFile(recordPath(stateDirectory)), { code: 'ENOENT' });
  assert.doesNotMatch(result.stderr, /private-token-secret|oauth-refresh|oauth-access/);
});
