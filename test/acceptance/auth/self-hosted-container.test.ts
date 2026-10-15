import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { after, before, describe, test, type TestContext } from 'node:test';
import { UnauthorizedError, type CallToolResult, type Client } from '@modelcontextprotocol/client';
import { jwtClaims } from '../../support/drivers/browser/better-auth-agents.ts';
import { authIssuer, mcpResourceUrl, publicBaseUrl, type AccountCredentials } from '../../support/in-process/better-auth-local.ts';
import { assertExit, assertRevealsNone, type CommandResult } from '../../support/processes/command-process.ts';
import {
  buildGateImages,
  buildWithLightpandaAsset,
  containerAdRulesFile,
  containerDataDirectory,
  probeImage,
  removeGateResources,
  repositoryRoot,
  type GateImages,
} from '../../support/container/container-gate.ts';
import { ContainerSite } from '../../support/container/container-site.ts';
import { dockerOutput } from '../../support/container/docker-cli.ts';
import { workOSSettings } from '../../support/hosted-placeholder.ts';
import { addUser, listedAccounts, registerArgs, registeredClientId, type Operator } from '../../support/dsl/local-commands.ts';
import { LocalMcpUser, type McpConnection } from '../../support/dsl/local-mcp-user.ts';
import type { ServerContainer } from '../../support/container/server-container.ts';

const alice: AccountCredentials = { email: 'alice@example.com', password: 'alice-password-1' };
const bob: AccountCredentials = { email: 'bob@example.com', password: 'bob-password-1' };
const localTenant = /^local:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const lockError = /in use by another Thermus process/;
// Only the dedicated command arms the gate. npm test and npm run test:acceptance report these tests as skipped.
const gateArmed = process.env.THERMUS_CONTAINER_GATE === '1';
const hostedSettings = { DEPLOYMENT: 'hosted', PUBLIC_BASE_URL: 'https://thermus.example', ...workOSSettings };
// The hosted and paid capabilities: WorkOS sign-in, onboarding, organizations, grants, invitations, seats, and
// billing, with the provider routes that could add them. The self-hosted composition routes none of them.
const hostedAndPaidPaths = [
  ['GET', '/auth/callback?code=hosted-code&state=hosted-state'],
  ['GET', '/auth/sign-in'],
  ['POST', '/auth/logout'],
  ['GET', '/onboarding'],
  ['GET', '/organizations'],
  ['POST', '/organizations/select'],
  ['POST', '/organizations/grants'],
  ['POST', '/organizations/invitations'],
  ['GET', '/account/seats'],
  ['POST', '/billing/seats'],
  ['POST', '/api/auth/organization/create'],
  ['POST', '/api/auth/organization/invite-member'],
  ['POST', '/api/auth/organization/set-active'],
  ['POST', '/api/auth/admin/create-user'],
  ['POST', '/api/auth/admin/set-role'],
  ['POST', '/api/auth/oauth2/register'],
  ['POST', '/api/auth/sign-up/email'],
  ['POST', '/api/auth/subscription/upgrade'],
] as const;

let images: GateImages;
const fetchToolNames = ['getURLAsMarkdown'];
const fetchReason = 'Read the rendered page for the task';
const pinnedRenderer = '/opt/lightpanda/1.0.0/lightpanda';
// The page of the test-only seam in container-page.ts, on port 8090 of a server container.
const containerPage = 'http://localhost:8090';
const storyMarkdown = '## Runtime story\n\nThe script rendered this paragraph with enough words to keep it.\n\nFinal host target\n\n'
  + `Related [article](${containerPage}/related) and [root](${containerPage}/root).`;

interface Installation {
  readonly site: ContainerSite;
  readonly volume: string;
  readonly operator: Operator;
  readonly clientIds: readonly string[];
  readonly userIds: ReadonlyMap<string, string>;
  readonly commands: readonly CommandResult[];
}

interface ImageFacts {
  readonly applicationEntries: readonly string[];
  readonly distEntries: readonly string[];
  readonly compiledSource: Readonly<Record<string, string>>;
  readonly migrations: Readonly<Record<string, string>>;
  readonly developmentPackages: readonly string[];
  readonly pinnedPackages: Readonly<Record<string, string>>;
  readonly adBlockerSelectors: readonly string[];
  // The contents of AD_RULES_FILE, or null when the image has no file there.
  readonly adRulesFile: string | null;
  readonly renderer: RendererFacts | null;
  readonly userId: number;
  readonly dataDirectory: { readonly path: string; readonly ownerId: number; readonly mode: string; readonly entries: readonly string[] };
}

interface RendererFacts {
  readonly path: string;
  readonly ownerId: number;
  readonly groupId: number;
  readonly mode: string;
  readonly writablePaths: readonly string[];
  readonly version: string;
  readonly offlineHttpsLog: readonly string[];
}

interface ImageConfig {
  readonly User: string;
  readonly Env: readonly string[];
  readonly Entrypoint: readonly string[];
  readonly Cmd?: readonly string[] | null;
  readonly ExposedPorts: Readonly<Record<string, unknown>>;
}

interface ComposeService {
  readonly build: { readonly context: string; readonly dockerfile: string };
  readonly init?: boolean;
  readonly environment: Readonly<Record<string, string>>;
  readonly ports: readonly { readonly host_ip?: string; readonly target: number; readonly published: string }[];
  readonly volumes: readonly { readonly type: string; readonly source: string; readonly target: string; readonly read_only?: boolean; readonly bind?: unknown }[];
}

interface ComposeConfig {
  readonly services: Readonly<Record<string, ComposeService>>;
  readonly volumes: Readonly<Record<string, unknown>>;
}

async function installation(t: TestContext, accounts: readonly AccountCredentials[] = [alice, bob]): Promise<Installation> {
  const site = await ContainerSite.open(t, images.current);
  const volume = await site.volume();
  const operator = site.operator(volume);
  const commands: CommandResult[] = [];
  for (const account of accounts) commands.push(await addUser(operator, account));
  for (const account of accounts) commands.push(await operator(registerArgs(account), [account.password]));
  for (const result of commands) assertExit(result, 0);
  const clientIds = commands.slice(accounts.length).map(registeredClientId);
  const userIds = new Map((await listedAccounts(operator)).map(({ email, id }) => [email, id] as const));
  return { site, volume, operator, clientIds, userIds, commands };
}

function mcpUsers(setup: Installation, accounts: readonly AccountCredentials[] = [alice, bob]): LocalMcpUser[] {
  return accounts.map((account, index) => new LocalMcpUser(setup.site.address, setup.clientIds[index] ?? '', account));
}

async function toolNames(user: LocalMcpUser, t: TestContext): Promise<string[]> {
  const { tools } = await (await user.connectWithSavedToken(t)).listTools();
  return tools.map(({ name }) => name);
}

// With a live browser session and a stored consent, the provider gives the code at once, without the pages.
async function reauthorize(t: TestContext, users: readonly LocalMcpUser[]): Promise<string[][]> {
  const pages = [];
  for (const user of users) {
    user.oauth.expireAccessToken();
    pages.push([...(await user.connect(t)).pages]);
  }
  return pages;
}

async function returningUsers(t: TestContext, users: readonly LocalMcpUser[]): Promise<{ tools: string[][]; pages: string[][] }> {
  const tools = [];
  for (const user of users) tools.push(await toolNames(user, t));
  return { tools, pages: await reauthorize(t, users) };
}

function assertRenewedToken(user: LocalMcpUser, owner: { readonly userId?: string; readonly clientId?: string }, firstToken: string): void {
  const claims = jwtClaims(user.accessToken);
  assert.equal(claims.sub, owner.userId);
  assert.equal(claims.client_id, owner.clientId);
  assert.equal(claims.iss, authIssuer);
  assert.ok(Array.isArray(claims.aud) && claims.aud.includes(mcpResourceUrl), JSON.stringify(claims.aud));
  assert.equal(user.oauth.savedTokens().refresh_token, undefined);
  assert.notEqual(user.accessToken, firstToken);
  assert.equal(claims.sid, jwtClaims(firstToken).sid);
}

function seamLines(server: ServerContainer, event: 'renderer launch' | 'page connection' | 'page request'): string[] {
  return [...server.output.matchAll(new RegExp(`^Container ${event}(?: (.*))?$`, 'gm'))].map((line) => line[1] ?? '');
}

async function fetchPage(client: Client, url: string): Promise<CallToolResult> {
  return await client.callTool({ name: 'getURLAsMarkdown', arguments: { url, reason: fetchReason } }) as CallToolResult;
}

async function refreshAttempt(site: ContainerSite, clientId: string, token: string): Promise<{ status: number; error?: string }> {
  const response = await fetch(new URL('/api/auth/oauth2/token', site.address()), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: token, client_id: clientId, resource: mcpResourceUrl }),
  });
  return { status: response.status, error: (await response.json() as { error?: string }).error };
}

function accountIds(accounts: readonly { email: string; id: string }[]): Map<string, string> {
  return new Map(accounts.map(({ email, id }) => [email, id]));
}

function fileHashes(directory: string): Record<string, string> {
  const files = readdirSync(directory, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile());
  return Object.fromEntries(files.map((entry) => {
    const path = join(entry.parentPath, entry.name);
    return [relative(directory, path), createHash('sha256').update(readFileSync(path)).digest('hex')];
  }).sort(([first = ''], [second = '']) => first.localeCompare(second)));
}

function hostPackageVersion(name: string): string {
  return (JSON.parse(readFileSync(join(repositoryRoot, 'node_modules', name, 'package.json'), 'utf8')) as { version: string }).version;
}

// The compose file as Compose reads it, without a .env file or a PUBLIC_BASE_URL from the test environment.
async function composeConfig(): Promise<ComposeConfig> {
  const environment = { ...process.env };
  delete environment.PUBLIC_BASE_URL;
  const output = await dockerOutput(
    ['compose', '--project-directory', repositoryRoot, '--file', join(repositoryRoot, 'compose.yaml'), '--env-file', '/dev/null', 'config', '--format', 'json'],
    { environment },
  );
  return JSON.parse(output) as ComposeConfig;
}

describe('Self-hosted evaluation container without outbound access', { skip: gateArmed ? false : 'The container gate runs only with npm run test:container.' }, () => {
  before(async () => {
    images = await buildGateImages();
  }, { timeout: 1_800_000 });

  after(() => removeGateResources());

  test('Given a fresh image and data volume with outbound access denied and the production telemetry settings of the image, when stopped-server command containers add two users and register a native client for each and the server container starts, then each user signs in and consents on the bundled pages, and each SDK client works with a resource-bound token for its own user, client, and browser session in the one shared tenant; a fetch tool call for a public address gets the fixed fetch failure, because the container has no route out, and the server log gets no renderer setup report, because the renderer of the image starts; a token that is no longer accepted leads to a new authorization without the pages, no refresh grant exists, and no container tries an outbound connection', { timeout: 300_000 }, async (t) => {
    const setup = await installation(t);
    const server = await setup.site.startServer(setup.volume);
    const users = mcpUsers(setup);

    const connections = [];
    for (const user of users) connections.push(await user.connect(t));
    const [{ client }] = connections as [McpConnection];
    // An address literal needs no DNS lookup, so the renderer tries the connection without an outbound query.
    const fetchCall = await client.callTool({ name: 'getURLAsMarkdown', arguments: { url: 'https://93.184.216.34/page', reason: 'Show the network limit' } });
    const firstTokens = users.map((user) => user.accessToken);
    const reauthorizations = await reauthorize(t, users);
    const refreshes = [];
    for (const [index, token] of firstTokens.entries()) refreshes.push(await refreshAttempt(setup.site, setup.clientIds[index] ?? '', token));
    const tenant = server.tenant();
    const exit = await server.stop();

    assert.deepEqual(connections.map(({ pages }) => pages), [['/sign-in', '/consent'], ['/sign-in', '/consent']]);
    assert.deepEqual([fetchCall.content, fetchCall.isError], [[{ type: 'text', text: 'Page fetch failed' }], true]);
    assert.match(server.output, /"tool":"getURLAsMarkdown","url":"https:\/\/93\.184\.216\.34\/page".*"status":"fetch_failed"/);
    assert.doesNotMatch(server.output, /Renderer setup failure/);
    assert.notEqual(setup.clientIds[0], setup.clientIds[1]);
    assert.notEqual(jwtClaims(firstTokens[0] ?? '').sid, jwtClaims(firstTokens[1] ?? '').sid);
    assert.deepEqual(reauthorizations, [[], []]);
    for (const [index, user] of users.entries()) {
      assertRenewedToken(user, { userId: setup.userIds.get(user.account.email), clientId: setup.clientIds[index] }, firstTokens[index] ?? '');
    }
    assert.deepEqual(refreshes, [{ status: 400, error: 'unsupported_grant_type' }, { status: 400, error: 'unsupported_grant_type' }]);
    assert.match(tenant, localTenant);
    assert.equal(server.output.match(/uses tenant local:/g)?.length, 1);
    assert.deepEqual(exit, { code: 0, signal: null });
    assertRevealsNone(setup.commands, [alice.password, bob.password]);
    await setup.site.assertNoOutboundRequests();
  });

  test('Given two users with tokens and consents, when the server container restarts, is replaced by a new container, and is replaced by a container of a rebuilt image on the same volume, then after each change the tenant, the user IDs, the native clients, the signing keys, the browser sessions, the consents, and the tokens of both users stay usable', { timeout: 300_000 }, async (t) => {
    const setup = await installation(t);
    let server = await setup.site.startServer(setup.volume);
    const users = mcpUsers(setup);
    for (const user of users) await user.connect(t);
    const tenant = server.tenant();
    const first = { container: await server.inspect('Id'), image: await server.inspect('Image') };
    const changes: readonly (readonly [string, () => Promise<void>])[] = [
      ['restart', async () => {
        await server.stop();
        await server.start();
      }],
      ['container replacement', async () => {
        await server.stop();
        await server.remove();
        server = await setup.site.startServer(setup.volume);
      }],
      ['image replacement', async () => {
        await server.stop();
        await server.remove();
        server = await setup.site.startServer(setup.volume, { image: images.rebuilt });
      }],
    ];

    const outcomes = [];
    for (const [change, apply] of changes) {
      await apply();
      const container = await server.inspect('Id');
      const image = await server.inspect('Image');
      outcomes.push({ change, tenant: server.tenant(), container, image, ...(await returningUsers(t, users)) });
    }
    await server.stop();
    const accounts = await listedAccounts(setup.operator);

    for (const { change, ...outcome } of outcomes) {
      assert.equal(outcome.tenant, tenant, change);
      assert.deepEqual(outcome.tools, [fetchToolNames, fetchToolNames], change);
      assert.deepEqual(outcome.pages, [[], []], change);
    }
    assert.deepEqual(outcomes.map(({ container }) => container === first.container), [true, false, false]);
    assert.deepEqual(outcomes.map(({ image }) => image === first.image), [true, true, false]);
    for (const user of users) assert.equal(jwtClaims(user.accessToken).sub, setup.userIds.get(user.account.email));
    assert.deepEqual(accountIds(accounts), setup.userIds);
    await setup.site.assertNoOutboundRequests();
  });

  test('Given two users with tokens and a stopped server, when the operator backs up the complete data volume and restores it into a new volume for a new server container, then both users keep their IDs, the tenant, their tokens, browser sessions, and consents; a fresh volume starts a new tenant, and a restored volume without its installation identity or without auth.secret stops the server before it listens, asks for a restore, and gets no new identity', { timeout: 300_000 }, async (t) => {
    const setup = await installation(t);
    const original = await setup.site.startServer(setup.volume);
    const users = mcpUsers(setup);
    for (const user of users) await user.connect(t);
    const tenant = original.tenant();
    await original.stop();

    const archive = await setup.site.backup(setup.volume);
    const restored = await setup.site.restore(archive);
    const restoredServer = await setup.site.startServer(restored);
    const returning = await returningUsers(t, users);
    const restoredTenant = restoredServer.tenant();
    await restoredServer.stop();
    const restoredAccounts = await listedAccounts(setup.site.operator(restored));
    const freshServer = await setup.site.startServer(await setup.site.volume());
    const freshTenant = freshServer.tenant();
    await freshServer.stop();
    const withoutSecret = await setup.site.restore(archive, ['auth.secret']);
    const withoutIdentity = await setup.site.restore(archive);
    await probeImage(images.current, 'remove-installation-identity', withoutIdentity);
    const refused = [];
    for (const volume of [withoutSecret, withoutIdentity]) {
      const server = await setup.site.createServer(volume);
      server.launch();
      refused.push({ listening: await server.listeningOrExit(), exit: await server.exited(), output: server.output });
    }

    assert.equal(restoredTenant, tenant);
    assert.deepEqual(returning, { tools: [fetchToolNames, fetchToolNames], pages: [[], []] });
    assert.deepEqual(accountIds(restoredAccounts), setup.userIds);
    assert.match(freshTenant, localTenant);
    assert.notEqual(freshTenant, tenant);
    for (const { listening, exit, output } of refused) {
      assert.equal(listening, false, output);
      assert.notEqual(exit.code, 0, output);
      assert.match(output, /FATAL/);
      assert.match(output, /restore/i);
    }
    assert.match(refused[0]?.output ?? '', /auth\.secret/);
    assert.match(refused[1]?.output ?? '', /installation identity/);
    assert.deepEqual(await probeImage(images.current, 'data-files', withoutSecret), ['auth.sqlite', 'data-directory.lock', 'resource-server-client.json']);
    assert.deepEqual(await probeImage(images.current, 'installation-ids', withoutIdentity), []);
    await setup.site.assertNoOutboundRequests();
  });

  test('Given a server container of the image with trusted rules, outbound access denied, and a test-only JavaScript page on 127.0.0.1 that only the renderer of this container can reach, when an authorized MCP client calls getURLAsMarkdown for the page, then LIGHTPANDA_BIN names the pinned executable, which reports 1.0.0, the client gets the exact cleaned Markdown, the server writes one safe completion record, and no container tries an outbound connection', { timeout: 300_000 }, async (t) => {
    const setup = await installation(t, [alice]);
    const server = await setup.site.startServer(setup.volume, { page: 'permitted' });
    const { client } = await new LocalMcpUser(setup.site.address, setup.clientIds[0] ?? '', alice).connect(t);
    const url = `${containerPage}/story`;

    const result = await fetchPage(client, url);
    const renderer = await server.runProgram(['sh', '-c', 'printf "%s\\n" "$LIGHTPANDA_BIN" && "$LIGHTPANDA_BIN" version']);
    const tenant = server.tenant();
    const exit = await server.stop();

    assertExit(renderer, 0);
    assert.deepEqual(renderer.stdout.split('\n'), [pinnedRenderer, '1.0.0', '']);
    assert.deepEqual(result.content, [{ type: 'text', text: storyMarkdown }]);
    assert.equal(result.isError === true, false);
    assert.equal(result.structuredContent, undefined);
    assert.deepEqual(seamLines(server, 'renderer launch'), [url]);
    assert.deepEqual(seamLines(server, 'page request'), ['/story', '/story.js']);
    const records = server.completionRecords();
    assert.equal(records.length, 1);
    const { durationMs, ...record } = records[0] as Record<string, unknown>;
    assert.equal(typeof durationMs, 'number');
    assert.deepEqual(record, {
      event: 'mcp.tool.completed', authority: `better-auth:${tenant.slice('local:'.length)}`, subject: setup.userIds.get(alice.email), tenantId: tenant,
      tool: 'getURLAsMarkdown', url, urlStatus: 'valid', reason: fetchReason, reasonStatus: 'valid', status: 'success',
    });
    assert.doesNotMatch(server.completionLines().join('\n'), /Runtime story|Hidden instruction|Final host target/);
    assert.deepEqual(exit, { code: 0, signal: null });
    await setup.site.assertNoOutboundRequests();
  });

  test('Given a server container with the production renderer settings, outbound access denied, and a test-only page on port 8090 of the container, when an authorized MCP client calls getURLAsMarkdown for the page by its loopback address, by the private address of the container, and by localhost, which the first lookup gives as a public address, then the fetcher blocks both addresses before a renderer starts, the renderer blocks the loopback socket of localhost, each call gets Page fetch failed and one fetch_failed record, the page gets no connection, and no container tries an outbound connection', { timeout: 300_000 }, async (t) => {
    const setup = await installation(t, [alice]);
    const server = await setup.site.startServer(setup.volume, { page: 'blocked' });
    const privateAddress = await setup.site.privateAddress(server.name);
    const { client } = await new LocalMcpUser(setup.site.address, setup.clientIds[0] ?? '', alice).connect(t);
    const urls = ['http://127.0.0.1:8090/story', `http://${privateAddress}:8090/story`, `${containerPage}/story`];

    const results = [];
    for (const url of urls) results.push(await fetchPage(client, url));
    const exit = await server.stop();

    assert.deepEqual(results.map(({ content, isError }) => [content, isError]), urls.map(() => [[{ type: 'text', text: 'Page fetch failed' }], true]));
    assert.deepEqual(server.completionRecords().map(({ url, status }) => ({ url, status })), urls.map((url) => ({ url, status: 'fetch_failed' })));
    assert.deepEqual(seamLines(server, 'renderer launch'), [`${containerPage}/story`]);
    assert.deepEqual([...seamLines(server, 'page connection'), ...seamLines(server, 'page request')], []);
    assert.deepEqual(exit, { code: 0, signal: null });
    await setup.site.assertNoOutboundRequests();
  });

  test('Given an image build with a Lightpanda asset that does not match the SHA256 digest that docs/lightpanda-runtime.md records, when the build runs, then it stops with the Lightpanda digest error and makes no image', { timeout: 600_000 }, async (t) => {
    const asset = mkdtempSync(join(tmpdir(), 'thermus-gate-asset-'));
    t.after(() => rmSync(asset, { recursive: true, force: true }));
    writeFileSync(join(asset, 'lightpanda'), 'This file is not the Lightpanda 1.0.0 asset.\n');

    const build = await buildWithLightpandaAsset(asset);

    assert.notEqual(build.code, 0, build.stderr);
    assert.match(build.stderr, /Lightpanda SHA256 check failed for linux\/(?:amd64|arm64)/);
    assert.equal(await dockerOutput(['image', 'ls', '--quiet', build.tag]), '');
  });

  test('Given a fresh volume and a server container without the trusted rules file, when the server starts, then it stops before it listens with a FATAL line that names AD_RULES_FILE and writes nothing to the volume, and a command container, which reads no rules, still adds an account', { timeout: 300_000 }, async (t) => {
    const site = await ContainerSite.open(t, images.current);
    const volume = await site.volume();
    const server = await site.createServer(volume, { adRules: false });

    server.launch();
    const listening = await server.listeningOrExit();
    const exit = await server.exited();
    const dataFiles = await probeImage(images.current, 'data-files', volume);
    const added = await addUser(site.operator(volume), alice);

    assert.equal(listening, false, server.output);
    assert.notEqual(exit.code, 0, server.output);
    assert.match(server.output, /FATAL.*AD_RULES_FILE could not be read \(ENOENT\)\./);
    assert.deepEqual(dataFiles, []);
    assertExit(added, 0);
    await site.assertNoOutboundRequests();
  });

  test('Given two users with tokens, when the operator resets the password of one user and later disables the other user in stopped-server command containers, then after each restart only the target loses its token and old credentials, the reset user signs in again without a new consent, the disabled user cannot sign in, and the peer keeps working', { timeout: 300_000 }, async (t) => {
    const setup = await installation(t);
    const server = await setup.site.startServer(setup.volume);
    const [aliceUser, bobUser] = mcpUsers(setup) as [LocalMcpUser, LocalMcpUser];
    for (const user of [aliceUser, bobUser]) await user.connect(t);
    await server.stop();

    const reset = await setup.operator(['users', 'reset-password', alice.email], ['alice-password-2', 'alice-password-2']);
    await server.start();
    await assert.rejects(aliceUser.connectWithSavedToken(t), UnauthorizedError);
    const aliceSignIn = await aliceUser.browser.openSignIn(aliceUser.authorizationUrl());
    const oldPassword = await aliceUser.browser.post(aliceSignIn.url, { email: alice.email, password: alice.password, oauth_query: aliceSignIn.oauthQuery });
    const renewed = await aliceUser.connect(t, { email: alice.email, password: 'alice-password-2' });
    const bobTools = await toolNames(bobUser, t);
    await server.stop();
    const disable = await setup.operator(['users', 'disable', bob.email]);
    await server.start();
    await assert.rejects(bobUser.connectWithSavedToken(t), UnauthorizedError);
    const bobSignIn = await bobUser.browser.openSignIn(bobUser.authorizationUrl());
    const disabledSignIn = await bobUser.browser.post(bobSignIn.url, { email: bob.email, password: bob.password, oauth_query: bobSignIn.oauthQuery });
    const aliceTools = await toolNames(aliceUser, t);
    await server.stop();
    const accounts = await listedAccounts(setup.operator);

    assertExit(reset, 0);
    assertExit(disable, 0);
    assert.equal(oldPassword.status, 401);
    assert.match(oldPassword.body, /email address or password is not correct/i);
    assert.deepEqual(renewed.pages, ['/sign-in']);
    assert.equal(jwtClaims(aliceUser.accessToken).sub, setup.userIds.get(alice.email));
    assert.deepEqual(bobTools, fetchToolNames);
    assert.equal(disabledSignIn.status, 403);
    assert.match(disabledSignIn.body, /account is disabled/i);
    assert.equal(bobUser.browser.cookies.size, 0, 'the refused sign-in set no session cookie');
    assert.deepEqual(aliceTools, fetchToolNames);
    assert.deepEqual(accounts, [
      { email: alice.email, state: 'enabled', id: setup.userIds.get(alice.email) },
      { email: bob.email, state: 'disabled', id: setup.userIds.get(bob.email) },
    ]);
    assertRevealsNone([reset, disable], [alice.password, 'alice-password-2', bob.password]);
    await setup.site.assertNoOutboundRequests();
  });

  test('Given a live server container, when one-off command containers mount the same data volume or a command runs inside the server container, then each command fails with the lock error, asks for no password, and changes no account', { timeout: 300_000 }, async (t) => {
    const setup = await installation(t, [alice]);
    const server = await setup.site.startServer(setup.volume);
    const commands = [
      ['users', 'add', 'carol@example.com'],
      ['users', 'list'],
      ['users', 'reset-password', alice.email],
      ['users', 'disable', alice.email],
      registerArgs(alice),
    ];

    const results = [];
    for (const args of commands) results.push(await setup.operator(args, ['carol-password-1', 'carol-password-1']));
    const inside = await server.exec(['users', 'disable', alice.email]);
    const stillServing = await fetch(new URL('/.well-known/oauth-protected-resource/mcp', setup.site.address()));
    await server.stop();
    const accounts = await listedAccounts(setup.operator);

    for (const result of [...results, inside]) {
      assertExit(result, 1);
      assert.match(result.stderr, lockError);
      assert.doesNotMatch(result.stderr, /password/i);
      assert.equal(result.stdout, '');
    }
    assert.equal(stillServing.status, 200);
    assert.deepEqual(accounts, [{ email: alice.email, state: 'enabled', id: setup.userIds.get(alice.email) }]);
    await setup.site.assertNoOutboundRequests();
  });

  test('Given an installation that starts with zero accounts and later has only a disabled account, when the server is stopped and a command container adds an account, then the new account signs in, consents, and uses MCP through the installation client, and the tenant stays the same', { timeout: 300_000 }, async (t) => {
    const dana: AccountCredentials = { email: 'dana@example.com', password: 'dana-password-1' };
    const erin: AccountCredentials = { email: 'erin@example.com', password: 'erin-password-1' };
    const site = await ContainerSite.open(t, images.current);
    const volume = await site.volume();
    const operator = site.operator(volume);
    const server = await site.startServer(volume);
    const tenant = server.tenant();
    const withoutAccounts = await fetch(new URL('/mcp', site.address()), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'server/discover', params: {} }),
    });
    await server.stop();
    const zeroAccounts = await listedAccounts(operator);

    const danaCommands = [await addUser(operator, dana), await operator(registerArgs(dana), [dana.password]), await operator(['users', 'disable', dana.email])];
    const clientId = registeredClientId(danaCommands[1] as CommandResult);
    await server.start();
    const danaUser = new LocalMcpUser(site.address, clientId, dana);
    await assert.rejects(danaUser.connectWithSavedToken(t), UnauthorizedError);
    const danaSignIn = await danaUser.browser.openSignIn(danaUser.authorizationUrl());
    const disabledSignIn = await danaUser.browser.post(danaSignIn.url, { email: dana.email, password: dana.password, oauth_query: danaSignIn.oauthQuery });
    await server.stop();
    const added = await addUser(operator, erin);
    await server.start();
    const erinUser = new LocalMcpUser(site.address, clientId, erin);
    const recovered = await erinUser.connect(t);
    const tools = (await recovered.client.listTools()).tools;
    const recoveredTenant = server.tenant();
    await server.stop();
    const accounts = await listedAccounts(operator);

    assert.deepEqual(zeroAccounts, []);
    assert.equal(withoutAccounts.status, 401);
    for (const result of [...danaCommands, added]) assertExit(result, 0);
    assert.equal(disabledSignIn.status, 403);
    assert.deepEqual(recovered.pages, ['/sign-in', '/consent']);
    assert.deepEqual(tools.map(({ name }) => name), fetchToolNames);
    assert.equal(recoveredTenant, tenant);
    assert.deepEqual(accounts.map(({ email, state }) => ({ email, state })), [
      { email: dana.email, state: 'disabled' },
      { email: erin.email, state: 'enabled' },
    ]);
    assert.equal(jwtClaims(erinUser.accessToken).sub, accounts[1]?.id);
    await site.assertNoOutboundRequests();
  });

  test('Given the self-hosted image, when a client calls hosted, paid, and private provider paths directly with a signed-in browser session, then each path gives 404 and adds no account, the MCP session of the signed-in user lists only the fetch tool, and a container with DEPLOYMENT=hosted and WorkOS settings gives that session and its token no access: each account path asks for a sign-in, the forged callback is refused, MCP asks for a token, nothing calls WorkOS, and nothing is written to its volume', { timeout: 300_000 }, async (t) => {
    const setup = await installation(t, [alice]);
    const server = await setup.site.startServer(setup.volume);
    const user = new LocalMcpUser(setup.site.address, setup.clientIds[0] ?? '', alice);
    const { client } = await user.connect(t);
    const tools = (await client.listTools()).tools;
    const cookie = [...user.browser.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
    const body = JSON.stringify({ name: 'Acme', slug: 'acme', email: 'eve@example.com', password: 'eve-password-1', role: 'admin', seats: 5 });

    const statuses = [];
    for (const [method, path] of hostedAndPaidPaths) {
      const response = await fetch(new URL(path, setup.site.address()), {
        method,
        headers: { Origin: publicBaseUrl, Cookie: cookie, 'Content-Type': 'application/json' },
        ...(method === 'POST' ? { body } : {}),
      });
      statuses.push([method, path, response.status]);
    }
    await server.stop();
    const accounts = await listedAccounts(setup.operator);
    const hostedVolume = await setup.site.volume();
    const hosted = await setup.site.startServer(hostedVolume, { environment: hostedSettings });
    const hostedAnswers = [];
    for (const [method, path] of hostedAndPaidPaths) {
      const response = await fetch(new URL(path, setup.site.address()), {
        method,
        headers: { Origin: hostedSettings.PUBLIC_BASE_URL, Cookie: cookie, 'Content-Type': 'application/json' },
        ...(method === 'POST' ? { body } : {}),
      });
      hostedAnswers.push([method, path, response.status, response.headers.get('Set-Cookie')]);
    }
    const hostedMcp = await fetch(new URL('mcp', setup.site.address()), {
      method: 'POST',
      headers: { Authorization: `Bearer ${user.accessToken}`, Cookie: cookie, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    });
    const notice = await fetch(setup.site.address());
    const noticeText = await notice.text();
    const hostedExit = await hosted.stop();

    assert.ok(cookie !== '', 'the user has a browser session');
    assert.deepEqual(tools.map(({ name }) => name), fetchToolNames);
    assert.deepEqual(statuses, hostedAndPaidPaths.map(([method, path]) => [method, path, 404]));
    assert.deepEqual(accounts.map(({ email }) => email), [alice.email]);
    assert.deepEqual(hostedAnswers, hostedAndPaidPaths.map(([method, path]) => (path.startsWith('/auth/callback')
      ? [method, path, 400, '__Host-thermus-sign-in=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0']
      : [method, path, 401, null])));
    assert.equal(hostedMcp.status, 401);
    assert.match(hostedMcp.headers.get('WWW-Authenticate') ?? '', /^Bearer /);
    assert.deepEqual([notice.status, notice.headers.get('Set-Cookie')], [401, null]);
    assert.match(noticeText, /Sign-in required/);
    assert.match(hosted.output, /INFO.*Hosted authentication uses WorkOS: the client client_placeholder/);
    assert.doesNotMatch(hosted.output, /tenant/);
    assert.deepEqual(hostedExit, { code: 0, signal: null });
    assert.deepEqual(await probeImage(images.current, 'data-files', hostedVolume), []);
    await setup.site.assertNoOutboundRequests();
  });

  test('Given the image and the compose file, when they are inspected, then the image holds the compiled server and commands of this build, the shipped migrations, the pinned production packages with the native ad blocker built for its platform, and the pinned Lightpanda 1.0.0 at LIGHTPANDA_BIN, owned by root and not writable by the image user, which loads the CA certificates of the image, but no TypeScript source, test output, or development package; it runs as a non-root user with production settings, no telemetry setting except the one that turns off the renderer telemetry, its data directory on the one volume, and the path of the trusted ad rules, but no rules file; the compose service mounts only that volume and the read-only rules file of the operator, which Compose must not make, starts with an init process, and publishes its port on the loopback address', { timeout: 300_000 }, async () => {
    const facts = await probeImage<ImageFacts>(images.current, 'image');
    const config = JSON.parse(await dockerOutput(['image', 'inspect', '--format', '{{json .Config}}', images.current])) as ImageConfig;
    const compose = await composeConfig();
    const service = compose.services.thermus;
    const settings = Object.fromEntries(config.Env.map((setting) => setting.split(/=(.*)/s, 2)));

    assert.deepEqual(facts.applicationEntries, ['dist', 'migrations', 'node_modules', 'package.json']);
    assert.deepEqual(facts.distEntries, ['src']);
    assert.deepEqual(facts.compiledSource, fileHashes(join(repositoryRoot, 'dist/src')));
    assert.deepEqual(facts.migrations, fileHashes(join(repositoryRoot, 'migrations')));
    assert.deepEqual(facts.developmentPackages, []);
    assert.deepEqual(facts.pinnedPackages, Object.fromEntries(Object.keys(facts.pinnedPackages).map((name) => [name, hostPackageVersion(name)])));
    assert.deepEqual(facts.adBlockerSelectors, ['.ad-banner']);
    assert.notEqual(facts.userId, 0);
    assert.deepEqual(facts.dataDirectory, { path: containerDataDirectory, ownerId: facts.userId, mode: '700', entries: [] });
    assert.equal(config.User, 'node');
    assert.deepEqual(config.Entrypoint, ['node', '/app/dist/src/index.js']);
    assert.deepEqual(config.Cmd ?? [], []);
    assert.deepEqual(Object.keys(config.ExposedPorts), ['8080/tcp']);
    assert.equal(settings.NODE_ENV, 'production');
    assert.equal(settings.DEPLOYMENT, 'self-hosted');
    assert.equal(settings.DATA_DIR, containerDataDirectory);
    assert.equal(settings.LISTEN_HOST, '0.0.0.0');
    assert.equal(settings.LISTEN_PORT, '8080');
    assert.equal(settings.AD_RULES_FILE, containerAdRulesFile);
    assert.equal(facts.adRulesFile, null);
    assert.equal(settings.LIGHTPANDA_BIN, pinnedRenderer);
    // The renderer loads the CA certificates of the image, so an HTTPS fetch without a network fails only at the connection.
    assert.deepEqual(facts.renderer, { path: pinnedRenderer, ownerId: 0, groupId: 0, mode: '755', writablePaths: [], version: '1.0.0', offlineHttpsLog: ['page failed'] });
    assert.equal(settings.LIGHTPANDA_DISABLE_TELEMETRY, 'true');
    assert.equal(settings.PUBLIC_BASE_URL, undefined);
    assert.deepEqual(Object.keys(settings).filter((name) => /TELEMETRY|BETTER_AUTH|^AUTH_/.test(name)), ['LIGHTPANDA_DISABLE_TELEMETRY']);
    assert.deepEqual(Object.keys(compose.services), ['thermus']);
    assert.ok(service, 'the compose file has the thermus service');
    assert.equal(service.build.dockerfile, 'Dockerfile');
    assert.equal(service.init, true);
    assert.deepEqual(service.environment, { PUBLIC_BASE_URL: publicBaseUrl });
    assert.deepEqual(service.ports.map(({ host_ip, published, target }) => ({ host_ip, published, target })), [{ host_ip: '127.0.0.1', published: '8080', target: 8080 }]);
    assert.deepEqual(service.volumes.map(({ type, source, target, read_only, bind }) => ({ type, source, target, read_only, bind })), [
      { type: 'volume', source: 'thermus-data', target: containerDataDirectory, read_only: undefined, bind: undefined },
      { type: 'bind', source: join(repositoryRoot, 'ad-rules.txt'), target: containerAdRulesFile, read_only: true, bind: { create_host_path: false } },
    ]);
    assert.deepEqual(Object.keys(compose.volumes), ['thermus-data']);
  });
});
