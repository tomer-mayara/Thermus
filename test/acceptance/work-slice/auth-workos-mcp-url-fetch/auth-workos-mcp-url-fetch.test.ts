import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import { Client, StreamableHTTPClientTransport, type CallToolResult } from '@modelcontextprotocol/client';
import type { ApplicationLogger } from '../../../../src/application.ts';
import { loadDeploymentConfig } from '../../../../src/config/deployment-config.ts';
import { startHttpServer } from '../../../../src/http/server.ts';
import { fetchToolInputSchema } from '../../../../src/mcp/fetch-tool-schema.ts';
import { trustedAdRulesFile } from '../../../support/ad-rules.ts';
import { listenerTransport, type HostedBrowser } from '../../../support/hosted-browser.ts';
import { eraNegotiation, mcpProtocolEras, type McpProtocolEra } from '../../../support/mcp-protocol-eras.ts';
import { RendererProcessDouble } from '../../../support/renderer-process-double.ts';
import { signInThroughServer, type WorkOSServerSite } from '../../../support/workos-sign-in.ts';
import { WorkOSWorld, type WorldUser } from '../../../support/workos-world.ts';
import { mcpRequest, rpcResult } from '../../../support/drivers/mcp/mcp-http-request.ts';
import { composeWorkSliceApplication } from './auth-workos-mcp-url-fetch.ts';

// The fake WorkOS API of the world and the renderer double keep these specifications offline. Thus the manual run of
// the slice proves the Google sign-in, the client registration, and the Axiom export.

const storyUrl = 'https://news.example/story';
const reason = 'Read the story for the work slice';
const rendererExecutable = '/opt/thermus-test/lightpanda';
// A second copy of the page and the Markdown of the basic slice test. DRY3 shares them after the third copy.
const storyHtml = '<html><head><title>Story</title></head><body><main><h1>Rendered story</h1>'
  + '<p>The rendered article has a first paragraph with enough words to keep it.</p>'
  + '<p class="final-host-target">Final host target</p><p class="requested-host-target">Requested host target</p>'
  + '<p>Related <a href="related">article</a> and <a href="/root">root</a>.</p>'
  + '<div hidden>Hidden instruction payload</div></main></body></html>';
// The trusted rules remove the paragraph that news.example##.final-host-target selects.
const expectedMarkdown = '## Rendered story\n\nThe rendered article has a first paragraph with enough words to keep it.\n\n'
  + 'Requested host target\n\n'
  + 'Related [article](https://news.example/related) and [root](https://news.example/root).';
const hostedSettings = { DEPLOYMENT: 'hosted', PUBLIC_BASE_URL: 'https://thermus.example' };
const config = loadDeploymentConfig(hostedSettings, 'http');
const environment = { ...hostedSettings, AD_RULES_FILE: trustedAdRulesFile, LIGHTPANDA_BIN: rendererExecutable };
const acme = 'org_01ACME';
const metadataChallenge = /^Bearer .*resource_metadata="https:\/\/thermus\.example\/\.well-known\/oauth-protected-resource\/mcp"/;

const ada: WorldUser = { id: 'user_01ADA', email: 'ada@example.com', firstName: 'Ada' };
const ben: WorldUser = { id: 'user_01BEN', email: 'ben@example.com', firstName: 'Ben' };
const dee: WorldUser = { id: 'user_01DEE', email: 'dee@example.com', firstName: 'Dee' };

interface RecordingLog extends ApplicationLogger {
  readonly lines: string[];
}

// url is the listener address, not the public base URL. Each close() call after the first gets the result of the first call.
interface SliceSite extends WorkOSServerSite {
  readonly url: URL;
  readonly log: RecordingLog;
  readonly renderer: RendererProcessDouble;
  close(): Promise<void>;
}

interface McpEndpoint {
  readonly url: URL;
  readonly token: string;
}

function recordingLog(): RecordingLog {
  const lines: string[] = [];
  return {
    lines,
    info: (message) => { lines.push(message); },
    error: (message) => { lines.push(`ERROR ${message}`); },
  };
}

async function openSlice(t: TestContext): Promise<SliceSite> {
  const renderer = RendererProcessDouble.install(t);
  renderer.serve(storyUrl, { finalUrl: storyUrl, html: storyHtml });
  const world = await WorkOSWorld.start(t, config.publicBaseUrl, [acme]);
  // The slice signs in with Google, which gives no MFA evidence.
  world.authenticationMethod = 'GoogleOAuth';
  // Dee has no membership, as after her first Google sign-in.
  world.memberships = [
    { userId: ada.id, organizationId: acme, roles: ['user'] },
    { userId: ben.id, organizationId: acme, roles: ['admin'] },
  ];
  const log = recordingLog();
  const application = await composeWorkSliceApplication({ config, connection: world.connection(), environment }, log);
  await using untilListening = new AsyncDisposableStack();
  untilListening.defer(() => application.close());
  // Port 0 is safe: the request URLs and the token audience come from the public URLs, not from the listen port.
  const listener = await startHttpServer(application.handle, { listen: { host: '127.0.0.1', port: 0 }, publicBaseUrl: config.publicBaseUrl, logger: log });
  untilListening.move();
  let closing: Promise<void> | undefined;
  // The production close order: listener.close() starts first, then the MCP work stops, and then the listener drains.
  const close = (): Promise<void> => (closing ??= application.close(listener.close()));
  t.after(close);
  return { world, transport: listenerTransport(listener.url), publicBaseUrl: config.publicBaseUrl, url: listener.url, log, renderer, close };
}

async function connectedClient(t: TestContext, endpoint: McpEndpoint, era: McpProtocolEra): Promise<Client> {
  const client = new Client({ name: 'work-slice-acceptance', version: '0.0.0' }, {
    versionNegotiation: { ...eraNegotiation(era), probe: { timeoutMs: 5_000, maxRetries: 0 } },
  });
  t.after(() => client.close());
  await client.connect(new StreamableHTTPClientTransport(new URL('mcp', endpoint.url), {
    authProvider: { token: async () => endpoint.token },
  }), { signal: t.signal, timeout: 5_000 });
  assert.equal(client.getNegotiatedProtocolVersion(), era);
  return client;
}

function toolCall(site: SliceSite, token?: string): Promise<Response> {
  return site.transport(mcpRequest({
    url: config.mcpResourceUrl,
    method: 'tools/call',
    ...(token === undefined ? {} : { token }),
    params: { name: 'getURLAsMarkdown', arguments: { url: storyUrl, reason } },
  }));
}

// An answer that is not JSON, such as the page that refuses access, gives an empty body.
async function portalJson(browser: HostedBrowser, path: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const answer = await browser.open(path, { Accept: 'application/json' });
  const body = answer.headers.get('Content-Type')?.includes('json') ? JSON.parse(answer.body) as Record<string, unknown> : {};
  return { status: answer.status, body };
}

function assertText(result: CallToolResult, text: string): void {
  assert.deepEqual(result.content, [{ type: 'text', text }]);
  assert.equal(result.isError === true, false);
  assert.equal(result.structuredContent, undefined);
}

async function assertAccessDenied(response: Response): Promise<void> {
  const body = await response.json() as Record<string, unknown>;
  assert.equal(response.status, 403);
  assert.equal(body.error, 'access_denied');
}

function fetchLines(log: RecordingLog): string[] {
  return log.lines.filter((line) => line.includes('work-slice fetch'));
}

function assertFetchLog(log: RecordingLog, user: WorldUser): void {
  const { lines } = log;
  assert.equal(lines.length, 3, `The log must have three lines:\n${lines.join('\n')}`);
  assert.equal(lines[0], `work-slice fetch started: ${storyUrl}`);
  assert.equal(lines[1], `work-slice fetch completed: ${storyUrl} gave ${expectedMarkdown.length} characters of Markdown:\n${expectedMarkdown}`);
  assert.ok(lines[2].startsWith('{"event":"mcp.tool.completed"'), lines[2]);
  const { durationMs, ...record } = JSON.parse(lines[2]) as Record<string, unknown>;
  assert.equal(typeof durationMs, 'number');
  assert.deepEqual(record, {
    event: 'mcp.tool.completed',
    authority: 'workos:client_test',
    subject: user.id,
    tenantId: `workos:client_test:${acme}`,
    tool: 'getURLAsMarkdown',
    url: storyUrl,
    urlStatus: 'valid',
    reason,
    reasonStatus: 'valid',
    status: 'success',
  });
}

describe('The auth WorkOS MCP URL fetch work slice with the WorkOS provider, the fetch tool, and the production pipeline, offline', () => {
  for (const era of mcpProtocolEras) {
    test(`Given the slice application, Ada with the role user in Acme, and a renderer double that serves ${storyUrl}, when Ada signs in with Google through the server and the browser reads her session and her portal access, then she is signed in to Acme without MFA evidence and has product access with the role user; when an MCP client in ${era} with her Connect token for Acme lists the tools and calls getURLAsMarkdown with that URL and a reason, then the client gets the cleaned Markdown without the paragraph that the rules remove, the log has the started line, the completed line, and one completion record with her WorkOS identity, and close() stops the application`, { timeout: 60_000 }, async (t) => {
      const site = await openSlice(t);
      const { browser } = await signInThroughServer(site, ada, acme);
      const session = await portalJson(browser, 'session');
      const access = await portalJson(browser, 'portal/access');
      const client = await connectedClient(t, { url: site.url, token: await site.world.connectToken(ada, { org_id: acme }) }, era);

      const listed = await client.listTools();
      const result = await client.callTool({ name: 'getURLAsMarkdown', arguments: { url: storyUrl, reason } });
      await client.close();
      await site.close();

      const { signedIn, organizationId, mfaCompleted } = session.body;
      assert.deepEqual({ status: session.status, signedIn, organizationId, mfaCompleted }, { status: 200, signedIn: true, organizationId: acme, mfaCompleted: false });
      assert.deepEqual(access, { status: 200, body: { organizationId: acme, roles: ['user'] } });
      assert.deepEqual(listed.tools.map(({ name, inputSchema }) => ({ name, inputSchema })), [{ name: 'getURLAsMarkdown', inputSchema: fetchToolInputSchema }]);
      assertText(result, expectedMarkdown);
      assertFetchLog(site.log, ada);
      assert.deepEqual(site.renderer.launches.map(({ executable }) => executable), [rendererExecutable]);
      await assert.rejects(fetch(site.url));
    });
  }

  test('Given Dee without a membership, as after her first Google sign-in, when she signs in and opens her portal access and the organization page, then the access is refused and the page gives the onboarding guidance; when her Connect token for Acme calls getURLAsMarkdown, then the call gets 403 access_denied, no renderer starts, and the log has no fetch line; when the world gets her membership with the role user, as the operator step gives it, then the next call gets the cleaned Markdown and the log has the fetch lines with her WorkOS identity', { timeout: 60_000 }, async (t) => {
    const site = await openSlice(t);
    const { browser } = await signInThroughServer(site, dee);
    const access = await portalJson(browser, 'portal/access');
    const onboarding = await browser.open('organizations');
    const token = await site.world.connectToken(dee, { org_id: acme });

    const refused = await toolCall(site, token);
    const beforeMembership = { launches: site.renderer.launches.length, fetchLines: fetchLines(site.log) };
    site.world.memberships = [...site.world.memberships, { userId: dee.id, organizationId: acme, roles: ['user'] }];
    const served = await toolCall(site, token);
    await site.close();

    assert.equal(access.status, 403);
    assert.equal(onboarding.status, 200);
    assert.match(onboarding.body, /Your account has no active access to an organization\./);
    await assertAccessDenied(refused);
    assert.deepEqual(beforeMembership, { launches: 0, fetchLines: [] });
    assert.equal(served.status, 200);
    assertText(await rpcResult(served) as CallToolResult, expectedMarkdown);
    assertFetchLog(site.log, dee);
  });

  test('Given no token, a browser token of Ada, and a Connect token for another resource, when each calls getURLAsMarkdown at the MCP endpoint, then each gets 401 with a Bearer challenge that names the protected-resource metadata, no renderer starts, and the log has no fetch line; the metadata names the MCP resource and the AuthKit issuer of the world as its only authorization server', { timeout: 60_000 }, async (t) => {
    const site = await openSlice(t);
    const { world } = site;
    const tokens = [
      undefined,
      await world.browserToken(ada, acme),
      await world.authkitKey.sign({ sub: ada.id, client_id: 'client_01MCPCLIENT', sid: 'app_consent_1', scope: 'openid', org_id: acme }, {
        issuer: world.fake.authkitIssuer, audience: 'https://other.example/mcp',
      }),
    ];

    const answers = [];
    for (const token of tokens) {
      const response = await toolCall(site, token);
      await response.body?.cancel();
      answers.push({ status: response.status, namesMetadata: metadataChallenge.test(response.headers.get('WWW-Authenticate') ?? '') });
    }
    const metadataAnswer = await site.transport(new Request('https://thermus.example/.well-known/oauth-protected-resource/mcp'));
    const metadata = await metadataAnswer.json() as Record<string, unknown>;
    await site.close();

    assert.deepEqual(answers, tokens.map(() => ({ status: 401, namesMetadata: true })));
    assert.deepEqual(site.renderer.launches, []);
    assert.deepEqual(fetchLines(site.log), []);
    assert.equal(metadataAnswer.status, 200);
    assert.equal(metadata.resource, config.mcpResourceUrl);
    assert.deepEqual(metadata.authorization_servers, [world.fake.authkitIssuer]);
  });

  test('Given Ben with Admin only in Acme, when his Connect token for Acme calls getURLAsMarkdown, then the call gets 403 access_denied, no renderer starts, and the log has no fetch line', { timeout: 60_000 }, async (t) => {
    const site = await openSlice(t);
    const token = await site.world.connectToken(ben, { org_id: acme });

    const refused = await toolCall(site, token);
    await site.close();

    await assertAccessDenied(refused);
    assert.deepEqual(site.renderer.launches, []);
    assert.deepEqual(fetchLines(site.log), []);
  });
});
