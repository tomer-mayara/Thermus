import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { serveFetchUrlOAuthSite } from '../../support/in-process/fetch-url-oauth-site.ts';
import { serveFetchUrlDebugSite } from '../../support/in-process/fetch-url-debug-site.ts';
import { fetchUrlState } from '../../support/isolation/fetch-url-state.ts';
import { runFetchUrl } from '../../support/processes/fetch-url-command.ts';

const args = (endpoint: string) => ['--endpoint', endpoint, '--url', 'https://example.com', '--reason', 'Inspect the page'];
const grantPath = (directory: string) => join(directory, 'thermus/mcp-fetch/grant.json');
async function expire(directory: string) {
  const path = grantPath(directory);
  const record = JSON.parse(await readFile(path, 'utf8'));
  await writeFile(path, JSON.stringify({ ...record, expiresAt: Date.now() + 1_000 }));
}

test('Given ready credentials, when refresh and MCP requests arrive, then the marker precedes refresh and durable matching ready state precedes MCP', async (t) => {
  const stateDirectory = await fetchUrlState(t);
  const markers: string[] = [];
  const readyMatches: boolean[] = [];
  const site = await serveFetchUrlOAuthSite(t, {
    onToken: async (form) => { if (form.grant_type === 'refresh_token') markers.push(JSON.parse(await readFile(grantPath(stateDirectory), 'utf8')).status); },
    onMcp: async (authorization) => { const ready = JSON.parse(await readFile(grantPath(stateDirectory), 'utf8')); readyMatches.push(ready.status === 'ready' && authorization === `Bearer ${ready.accessToken}`); },
  });
  assert.equal((await runFetchUrl(t, args(site.profile.endpoint), { oauth: site, stateDirectory })).code, 0);
  await expire(stateDirectory);
  const result = await runFetchUrl(t, args(site.profile.endpoint), { oauth: site, stateDirectory });
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(markers, ['login-required']);
  assert.ok(readyMatches.length > 1 && readyMatches.every(Boolean));
});

test('Given failed marker persistence, when expiring credentials need refresh, then no refresh POST is sent', async (t) => {
  const site = await serveFetchUrlOAuthSite(t);
  const stateDirectory = await fetchUrlState(t);
  assert.equal((await runFetchUrl(t, args(site.profile.endpoint), { oauth: site, stateDirectory })).code, 0);
  await expire(stateDirectory);
  const result = await runFetchUrl(t, args(site.profile.endpoint), { oauth: { ...site, failSync: true }, stateDirectory });
  assert.equal(result.code, 1);
  assert.equal(result.stdout, '');
  assert.equal(site.requests.filter(({ form }) => form?.grant_type === 'refresh_token').length, 0);
  assert.equal(site.calls.length, 1);
});

test('Given a lost refresh response, when fetch is repeated, then the marker stops replay of the uncertain refresh', async (t) => {
  const site = await serveFetchUrlOAuthSite(t, { loseRefreshResponse: true });
  const stateDirectory = await fetchUrlState(t);
  assert.equal((await runFetchUrl(t, args(site.profile.endpoint), { oauth: site, stateDirectory })).code, 0);
  await expire(stateDirectory);
  assert.equal((await runFetchUrl(t, args(site.profile.endpoint), { oauth: site, stateDirectory })).code, 1);
  assert.equal(JSON.parse(await readFile(grantPath(stateDirectory), 'utf8')).status, 'login-required');
  const repeated = await runFetchUrl(t, args(site.profile.endpoint), { oauth: site, stateDirectory });
  assert.equal(repeated.code, 1);
  assert.match(repeated.stderr, /--login/);
  assert.equal(site.requests.filter(({ form }) => form?.grant_type === 'refresh_token').length, 1);
});

test('Given discovery failure before refresh, when fetch stops, then the previous record remains without a marker or token request', async (t) => {
  const behavior = { badIssuer: false };
  const site = await serveFetchUrlOAuthSite(t, behavior);
  const stateDirectory = await fetchUrlState(t);
  assert.equal((await runFetchUrl(t, args(site.profile.endpoint), { oauth: site, stateDirectory })).code, 0);
  await expire(stateDirectory);
  const previous = await readFile(grantPath(stateDirectory), 'utf8');
  behavior.badIssuer = true;
  const result = await runFetchUrl(t, args(site.profile.endpoint), { oauth: site, stateDirectory });
  assert.equal(result.code, 1);
  assert.equal(await readFile(grantPath(stateDirectory), 'utf8'), previous);
  assert.equal(site.requests.filter(({ path }) => path === '/token').length, 1);
});

test('Given a malformed saved record, when interactive fetch runs, then it reports recovery without browser or network fallback', async (t) => {
  const site = await serveFetchUrlOAuthSite(t);
  const stateDirectory = await fetchUrlState(t);
  assert.equal((await runFetchUrl(t, args(site.profile.endpoint), { oauth: site, stateDirectory })).code, 0);
  await writeFile(grantPath(stateDirectory), '{"private-token-secret":"invalid"}');
  const before = site.requests.length;
  const result = await runFetchUrl(t, args(site.profile.endpoint), { oauth: site, stateDirectory });
  assert.equal(result.code, 1);
  assert.match(result.stderr, /--login/);
  assert.doesNotMatch(result.stderr, /private-token-secret/);
  assert.equal(site.requests.length, before);
});

test('Given unusable OAuth cache and an explicit credential, when stdin selects Bearer mode, then OAuth files and endpoints stay untouched', async (t) => {
  const site = await serveFetchUrlDebugSite(t);
  const stateDirectory = await fetchUrlState(t);
  await mkdir(join(stateDirectory, 'thermus/mcp-fetch'), { recursive: true });
  await writeFile(grantPath(stateDirectory), 'private-unused-invalid-cache');
  const result = await runFetchUrl(t, [...args(site.endpoint), '--api-key-stdin'], { stateDirectory, input: 'test-debug-token', credential: 'private-wrong-env' });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout, '# Page\n\nExact Markdown.\n');
  assert.equal(await readFile(grantPath(stateDirectory), 'utf8'), 'private-unused-invalid-cache');
});
