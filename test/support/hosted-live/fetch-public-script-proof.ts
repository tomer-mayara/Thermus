import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WorkOS } from '@workos-inc/node';
import { decodeJwt } from 'jose';
import { LiveBrowser } from './live-browser.ts';
import { LocalHttpsSite, selfSignedCertificate } from './local-https-site.ts';
import { assertProviderPasswordProfile } from './password-profile.ts';
import { field, queryWidgetGraph } from './workos-api.ts';
import { mcpRequest } from '../drivers/mcp/mcp-http-request.ts';
import { runPublicFetchCommand } from './fetch-public-script-client.ts';
import { mcpResource } from './settings.ts';

const profile = { endpoint: mcpResource, issuer: 'https://reasonable-field-33-staging.authkit.app', clientId: 'client_01M561HD70DB58BEKMSF8GCAQN' };
const command = ['--endpoint', profile.endpoint];
const fetchArguments = [...command, '--url', 'https://example.com/', '--reason', 'Prove the Staging public OAuth fetch command'];

interface OwnedFixture {
  readonly user: { readonly id: string; readonly email: string; readonly password: string };
  readonly organizations: readonly { readonly id: string; readonly name: string }[];
  readonly memberships: readonly { readonly id: string }[];
}

async function createFixture(workos: WorkOS, owned: Array<() => Promise<unknown>>): Promise<OwnedFixture> {
  const runId = `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
  const organizations = [];
  for (const label of ['A', 'B']) {
    const organization = await workos.organizations.createOrganization({ name: `Thermus script proof ${runId} ${label}` });
    organizations.push(organization);
    owned.unshift(() => workos.organizations.deleteOrganization(organization.id));
  }
  const password = `Tf-${randomBytes(24).toString('base64url')}-9a`;
  const user = await workos.userManagement.createUser({ email: `thermus-script-proof-${runId}@example.net`, password, emailVerified: true, firstName: 'Thermus', lastName: 'Script proof' });
  owned.unshift(() => workos.userManagement.deleteUser(user.id));
  const memberships = [];
  for (const organization of organizations) memberships.push(await workos.userManagement.createOrganizationMembership({ organizationId: organization.id, userId: user.id, roleSlugs: ['user', 'admin'] }));
  const { token } = await workos.widgets.createToken({ userId: user.id, organizationId: organizations[0].id, scopes: ['widgets:users-table:manage'] });
  const data = await queryWidgetGraph(token, 'query { authenticationSettings { passwordAuthEnabled mfaEnabled mfaRequired } }');
  assertProviderPasswordProfile(field(data, 'authenticationSettings'));
  return { user: { ...user, password }, organizations, memberships };
}

interface PrivateGrant {
  readonly status: string;
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly expiresAt: number;
}

function grantPath(directory: string): string {
  return join(directory, 'state', 'thermus', 'mcp-fetch', 'grant.json');
}

async function readGrant(directory: string): Promise<PrivateGrant> {
  return JSON.parse(await readFile(grantPath(directory), 'utf8')) as PrivateGrant;
}

async function ageSavedExpiry(directory: string): Promise<void> {
  const grant = await readGrant(directory);
  await writeFile(grantPath(directory), JSON.stringify({ ...grant, expiresAt: Date.now() - 1 }), { mode: 0o600 });
}

async function authorizedApplications(apiKey: string, userId: string): Promise<readonly Record<string, unknown>[]> {
  const response = await fetch(`https://api.workos.com/user_management/users/${userId}/authorized_applications`, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(15_000) });
  assert.equal(response.status, 200, 'The proof could not read its owned authorizations.');
  return (await response.json() as { data: Array<Record<string, unknown>> }).data;
}

async function removeAuthorization(apiKey: string, userId: string, applicationId: string): Promise<void> {
  const response = await fetch(`https://api.workos.com/user_management/users/${userId}/authorized_applications/${applicationId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(15_000) });
  await response.body?.cancel();
  assert.equal(response.status, 204, 'The proof could not revoke its owned authorization.');
}

type CommandRun = (args: readonly string[]) => ReturnType<typeof runPublicFetchCommand>;

async function proveReuseAndRefresh(run: CommandRun, directory: string, organizationId: string) {
  const initial = await run(fetchArguments);
  assert.equal(initial.status, 0, 'Actual-script fetch failed.');
  assert.ok(initial.stdout.trim().length > 0, 'The rendered fetch returned no Markdown.');
  assert.equal(initial.browserCalls, 0);
  const saved = await readGrant(directory);
  assert.equal(decodeJwt(saved.accessToken).org_id, organizationId, 'The browser selected another workspace.');
  const reused = await run([...fetchArguments, '--non-interactive']);
  assert.equal(reused.status, 0, 'Saved-grant reuse failed.');
  assert.equal(reused.browserCalls, 0);
  assert.equal(reused.stdout, initial.stdout, 'Saved-grant fetch changed the returned Markdown.');
  assert.ok((await readGrant(directory)).accessToken === saved.accessToken, 'Saved reuse replaced the fresh access token.');
  await ageSavedExpiry(directory);
  const refreshed = await run([...fetchArguments, '--non-interactive']);
  assert.equal(refreshed.status, 0, 'Actual-script forced refresh failed.');
  assert.equal(refreshed.browserCalls, 0);
  assert.equal(refreshed.stdout, initial.stdout, 'Refreshed fetch changed the returned Markdown.');
  const after = await readGrant(directory);
  assert.ok(after.accessToken !== saved.accessToken, 'Forced expiry did not replace the access token.');
  assert.ok(after.refreshToken !== saved.refreshToken, 'WorkOS did not rotate this refresh token.');
  assert.equal(decodeJwt(after.accessToken).org_id, organizationId, 'Refresh changed the workspace.');
}

async function proveFreshLogin(run: CommandRun, directory: string): Promise<void> {
  const before = await readGrant(directory);
  const login = await run([...command, '--login']);
  assert.equal(login.status, 0, 'Fresh actual-script login failed.');
  assert.equal(login.stdout, '');
  assert.equal(login.browserCalls, 1, 'Fresh login did not open browser authorization.');
  assert.ok((await readGrant(directory)).accessToken !== before.accessToken, 'Fresh login reused the old access token.');
}

async function proveRemoteRevocation(run: CommandRun, parts: { directory: string; apiKey: string; userId: string; applicationId: string }): Promise<void> {
  await removeAuthorization(parts.apiKey, parts.userId, parts.applicationId);
  assert.equal((await authorizedApplications(parts.apiKey, parts.userId)).length, 0, 'Remote authorization stayed after removal.');
  const stillSigned = await run([...fetchArguments, '--non-interactive']);
  assert.equal(stillSigned.status, 0, 'The backend unexpectedly introspected remote consent for an unexpired JWT.');
  await ageSavedExpiry(parts.directory);
  const refused = await run([...fetchArguments, '--non-interactive']);
  assert.equal(refused.status, 1, 'The script accepted refresh after remote authorization removal.');
  assert.equal(refused.stdout, '');
  assert.equal(refused.browserCalls, 0);
  assert.equal((await readGrant(parts.directory)).status, 'login-required', 'The script kept a revoked grant ready.');
  const recovery = await run([...command, '--login']);
  assert.equal(recovery.status, 0, 'Fresh login did not recover from removed remote authorization.');
  assert.equal(recovery.browserCalls, 1);
}

async function proveLocalLogout(run: CommandRun, parts: { directory: string; apiKey: string; userId: string; backend: URL }): Promise<void> {
  const before = await readGrant(parts.directory);
  const authorizations = await authorizedApplications(parts.apiKey, parts.userId);
  assert.equal(authorizations.length, 1, 'The owned user has an unexpected remote authorization count.');
  const logout = await run([...command, '--logout']);
  assert.equal(logout.status, 0, 'Actual-script logout failed.');
  assert.equal(logout.stdout, '');
  assert.equal(logout.browserCalls, 0);
  assert.match(logout.stderr, /Remote authorization/);
  assert.deepEqual(await authorizedApplications(parts.apiKey, parts.userId), authorizations, 'Local logout changed remote authorization.');
  await assert.rejects(readFile(grantPath(parts.directory)), { code: 'ENOENT' });
  const unavailable = await run([...fetchArguments, '--non-interactive']);
  assert.equal(unavailable.status, 1, 'Non-interactive fetch after local logout did not fail.');
  assert.equal(unavailable.stdout, '');
  assert.equal(unavailable.browserCalls, 0);
  const retained = await fetch(mcpRequest({ url: new URL('mcp', parts.backend).href, method: 'server/discover', token: before.accessToken }));
  await retained.body?.cancel();
  assert.equal(retained.status, 200, 'Local logout invalidated a copied access token.');
}

export async function proveFirstPartyFetchScript(diagnostic: (message: string) => void) {
  const apiKey = process.env.WORKOS_API_KEY ?? '';
  assert.ok(apiKey.startsWith('sk_test_'), 'The actual-script proof requires Staging credentials.');
  assert.equal(process.env.WORKOS_CLIENT_ID, 'client_01M4VDKB7C7T2GV2NWPS84HADP', 'The proof requires the designated Staging environment.');
  const settings = { apiKey, clientId: process.env.WORKOS_CLIENT_ID, authkitIssuer: profile.issuer };
  const workos = new WorkOS({ apiKey, clientId: settings.clientId, maxRetries: 0, timeout: 15_000 });
  const owned: Array<() => Promise<unknown>> = [];
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'thermus-fetch-script-proof-')));
  owned.unshift(() => rm(directory, { recursive: true, force: true }));
  const browser = new LiveBrowser(async () => undefined);
  owned.unshift(() => browser.close());
  try {
    const fixture = await createFixture(workos, owned);
    const registered = await workos.connect.getApplication({ id: profile.clientId });
    assert.equal(registered.clientId, profile.clientId);
    assert.equal(registered.applicationType, 'oauth');
    assert.equal(registered.isFirstParty, true);
    assert.equal(registered.usesPkce, true);
    const certificate = await selfSignedCertificate(directory);
    await writeFile(join(directory, 'certificate.pem'), certificate.cert, { mode: 0o600 });
    const site = await LocalHttpsSite.start(settings, { certificate, rendererExecutable: process.env.LIGHTPANDA_BIN });
    owned.unshift(() => site.close());
    const parts = { directory, browser, user: fixture.user, organizationName: fixture.organizations[1].name, profile };
    const run = (args: readonly string[]) => runPublicFetchCommand(args, parts);
    const login = await run([...command, '--login']);
    assert.equal(login.status, 0, 'Actual-script login failed.');
    assert.equal(login.stdout, '', 'Login printed to stdout.');
    assert.equal(login.browserCalls, 1);
    diagnostic(`Actual-script initial login passed; pages: ${login.pages.join(' > ')}.`);
    assert.ok(login.pages.includes('/organization-selection') || login.pages.includes('/application-authorization'), 'The two-workspace login showed no workspace selection.');
    await proveReuseAndRefresh(run, directory, fixture.organizations[1].id);
    diagnostic('Actual-script fetch, saved reuse, and refresh passed. Only the private cached expiry was aged; no wall-clock expiry claim.');
    await proveFreshLogin(run, directory);
    await proveRemoteRevocation(run, { directory, apiKey, userId: fixture.user.id, applicationId: registered.id });
    diagnostic('Remote authorization removal left the unexpired JWT usable, then refused forced refresh; fresh login recovered.');
    await proveLocalLogout(run, { directory, apiKey, userId: fixture.user.id, backend: site.thermusUrl });
    const completions = site.log.lines.filter((line) => line.includes('"event":"mcp.tool.completed"')).map((line) => JSON.parse(line.slice('INFO '.length)) as Record<string, unknown>);
    assert.ok(completions.length >= 4, 'The real renderer recorded fewer completed calls than the script made.');
    for (const record of completions) {
      assert.equal(record.status, 'success', 'A renderer-backed script call failed.');
      assert.equal(record.subject, fixture.user.id, 'The backend used another user.');
      assert.equal(record.tenantId, `workos:${settings.clientId}:${fixture.organizations[1].id}`, 'The backend used another workspace.');
    }
    return { actualScript: true, renderedFetch: true, savedReuse: true, refreshAfterExpiry: true, expiryAgedInPrivateCache: true,
      freshLogin: true, localOnlyLogout: true, remoteRevocation: true, selectedWorkspace: 'B', memberships: 2, initialPages: login.pages };
  } catch (error) {
    if (error instanceof assert.AssertionError) throw new Error(`Actual-script proof assertion failed: ${error.message.split('\n')[0]}`);
    throw new Error(`Actual-script Staging proof failed (${error instanceof Error ? error.name : 'Error'}).`);
  } finally {
    const failures: unknown[] = [];
    for (const close of owned) await close().catch((error: unknown) => { failures.push(error); });
    if (failures.length > 0) throw new Error(`Actual-script proof could not clean ${failures.length} owned resources.`);
  }
}
