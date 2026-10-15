// The explicit renderer gate: npm run test:mcp:renderer. The *.test.js globs do not select this file.
// It needs LIGHTPANDA_BIN with the pinned Lightpanda 1.0.0 (docs/lightpanda-runtime.md). Without it, setup fails.
import assert from 'node:assert/strict';
import childProcess, { execFile, type ChildProcess } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { before, describe, test, type TestContext } from 'node:test';
import { promisify } from 'node:util';
import type { CallToolResult, Client } from '@modelcontextprotocol/client';
import { HtmlToMarkdownPipeline } from '../../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';
import type { AccountCredentials } from '../../support/in-process/better-auth-local.ts';
import { syncBuiltinMocks } from '../../support/doubles/website-fetcher/builtin-mocks.ts';
import { assertExit } from '../../support/processes/command-process.ts';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { InProcessServer } from '../../support/in-process/in-process-server.ts';
import { addUser, operatorOn, registerArgs, registeredClientId } from '../../support/dsl/local-commands.ts';
import { connectWithToken, issuedGrants, LocalMcpUser } from '../../support/dsl/local-mcp-user.ts';
import { selfHostedServerSettings } from '../../support/in-process/local-runtime.ts';
import { mcpProtocolEras, type McpProtocolEra } from '../../support/drivers/mcp/mcp-protocol-eras.ts';
import { permitIPv4Fixture, startFixture } from '../../support/doubles/website-fetcher/network-fixture.ts';
import { setProcessEnvironment } from '../../support/isolation/process-environment.ts';

const runCommand = promisify(execFile);
const alice: AccountCredentials = { email: 'alice@example.com', password: 'alice-password-1' };
const reason = 'Read the rendered page for the task';
const setupGuide = 'See docs/lightpanda-runtime.md.';

const page = (body: string, script?: string): string => '<!DOCTYPE html><html><head><title>Runtime fixture</title></head><body>'
  + `<main>${body}</main>${script === undefined ? '' : `<script src="${script}"></script>`}</body></html>`;
const scripts: Readonly<Record<string, string>> = {
  '/story.js': `document.getElementById('status').textContent = 'The script rendered this paragraph with enough words to keep it.';
document.getElementById('slot').innerHTML = '<p class="requested-host-target">Requested host target</p><p class="final-host-target">Final host target</p>'
  + '<p>Related <a href="related">article</a> and <a href="/root">root</a>.</p><div hidden>Hidden instruction from the script</div>';`,
  // A script's text is serialized without escapes, so this markup forms a new hidden element after each removal pass.
  '/withheld.js': `let nested = '<span hidden>private-hidden-text</span>';
for (let pass = 1; pass < 8; pass += 1) nested = '<' + nested + 'span hidden>private-hidden-text</span>';
const script = document.createElement('script');
script.type = 'text/plain';
script.textContent = '<' + '/script>' + nested;
document.getElementById('slot').append(script);`,
  '/deep.js': `let node = document.getElementById('slot');
for (let level = 0; level < 300; level += 1) { const child = document.createElement('div'); node.append(child); node = child; }
node.textContent = 'private-deep-text';`,
};
const pages: Readonly<Record<string, string>> = {
  '/story': page('<h1>Runtime story</h1><p id="status">Waiting for the script</p><div id="slot"></div>', '/story.js'),
  '/hidden': page('<h1>Hidden story</h1><p>The visible paragraph has enough words to stay in the article body.</p>'
    + '<div hidden>Hidden instruction payload</div><p style="display:none">Display none payload</p>'),
  '/withheld': page('<h1>Withheld story</h1><p>The visible paragraph has enough words to stay in the article body.</p><div id="slot"></div>', '/withheld.js'),
  '/deep': page('<h1>Deep story</h1><div id="slot"></div>', '/deep.js'),
  '/slow': page('<h1>Slow story</h1><p>This page waits for a script that does not arrive.</p>', '/slow.js'),
  '/late': page('<h1>Late story</h1><p id="status">Private unfinished content</p>', '/late.js'),
};
const redirectedPage = page('<h1>Redirected story</h1><p>The final page has a first paragraph with enough words to keep it.</p>'
  + '<p class="final-host-target">Final host target</p><p class="requested-host-target">Requested host target</p>'
  + '<p>Related <a href="child">child</a> and <a href="/root">root</a>.</p>');

async function pinnedRenderer(): Promise<string> {
  const executable = process.env.LIGHTPANDA_BIN;
  if (executable === undefined || executable === '') {
    throw new Error(`Renderer gate setup failed: set LIGHTPANDA_BIN to the absolute path of the pinned Lightpanda 1.0.0 executable. ${setupGuide}`);
  }
  if (!isAbsolute(executable)) throw new Error(`Renderer gate setup failed: LIGHTPANDA_BIN must be an absolute path. ${setupGuide}`);
  let version: string;
  try {
    version = (await runCommand(executable, ['version'], { timeout: 10_000 })).stdout.trim();
  } catch (cause) {
    throw new Error(`Renderer gate setup failed: the LIGHTPANDA_BIN executable does not run. ${setupGuide}`, { cause });
  }
  if (version !== '1.0.0') throw new Error(`Renderer gate setup failed: LIGHTPANDA_BIN reports Lightpanda ${version}; the gate supports only 1.0.0. ${setupGuide}`);
  return executable;
}

interface RuntimeSite {
  readonly server: InProcessServer;
  readonly user: LocalMcpUser;
  readonly subject: string;
  readonly token: string;
  readonly pipelineRuns: { mock: { calls: { arguments: unknown[] }[] } };
}

// A fresh installation with one account, its client, and a real access token, served in this process with the
// pinned renderer and trusted rules.
async function openRuntimeSite(t: TestContext, executable: string): Promise<RuntimeSite> {
  const directory = dataDirectory(t);
  const operator = operatorOn(t, directory);
  assertExit(await addUser(operator, alice), 0);
  const clientId = registeredClientId(await operator(registerArgs(alice), [alice.password]));
  const grant = (await issuedGrants(directory, clientId, [alice])).get(alice.email);
  assert.ok(grant);
  permitIPv4Fixture(t);
  const pipelineRuns = t.mock.method(HtmlToMarkdownPipeline.prototype, 'process');
  const server = InProcessServer.open(t);
  await server.start({ ...selfHostedServerSettings(directory), LIGHTPANDA_BIN: executable });
  return { server, user: new LocalMcpUser(server.address, clientId, alice), subject: grant.id, token: grant.accessToken, pipelineRuns };
}

async function openPageFixture(t: TestContext) {
  const held = { requested: Promise.withResolvers<void>(), closed: Promise.withResolvers<void>() };
  const timers = new Set<ReturnType<typeof setTimeout>>();
  t.after(() => { for (const timer of timers) clearTimeout(timer); });
  const fixture = await startFixture(t, (request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (path === '/slow.js') {
      held.requested.resolve();
      response.on('close', () => held.closed.resolve());
      return;
    }
    if (path === '/late.js') {
      response.setHeader('Content-Type', 'text/javascript');
      const timer = setTimeout(() => {
        timers.delete(timer);
        response.end("document.getElementById('status').textContent = 'The asynchronous page is ready with the complete paragraph after the old deadline.';");
      }, 6_500);
      timers.add(timer);
      return;
    }
    const script = scripts[path];
    response.setHeader('Content-Type', script === undefined ? 'text/html' : 'text/javascript');
    if (script === undefined && pages[path] === undefined) response.statusCode = 404;
    response.end(script ?? pages[path] ?? 'Missing page');
  });
  return { ...fixture, held };
}

// Keeps each renderer child that the production fetcher starts. The fixture sees a closed renderer connection only
// after the network stack delivers it, which can be after the server stop ends, so a test reads the child itself.
function watchRendererChildren(t: TestContext, executable: string): ChildProcess[] {
  const children: ChildProcess[] = [];
  const launch = childProcess.execFile;
  t.mock.method(childProcess, 'execFile', ((...args: Parameters<typeof childProcess.execFile>) => {
    const child = Reflect.apply(launch, childProcess, args) as ChildProcess;
    if (args[0] === executable) children.push(child);
    return child;
  }) as typeof childProcess.execFile);
  syncBuiltinMocks(t);
  return children;
}

function newServerHomeWithoutTelemetrySetting(t: TestContext): string {
  const home = dataDirectory(t);
  setProcessEnvironment(t, { LIGHTPANDA_DISABLE_TELEMETRY: undefined, HOME: home, XDG_DATA_HOME: join(home, '.local', 'share') });
  return home;
}

// Lightpanda 1.0.0 makes its data directory at each start: on macOS under HOME, on Linux under XDG_DATA_HOME. With
// telemetry on, it writes its telemetry install ID, the file iid, there and starts the telemetry sender, which alone
// connects to telemetry.lightpanda.io. With telemetry off, it does neither.
function lightpandaDataDirectory(home: string): string {
  return process.platform === 'darwin' ? join(home, 'Library', 'Application Support', 'lightpanda') : join(home, '.local', 'share', 'lightpanda');
}

async function callFetchTool(client: Client, url: string, options?: { signal: AbortSignal }): Promise<CallToolResult> {
  return await client.callTool({ name: 'getURLAsMarkdown', arguments: { url, reason } }, options);
}

function assertText(result: CallToolResult, text: string, isError = false): void {
  assert.deepEqual(result.content, [{ type: 'text', text }]);
  assert.equal(result.isError === true, isError);
  assert.equal(result.structuredContent, undefined);
}

function pagesSeen(site: RuntimeSite): { requestedUrl: unknown; finalUrl: unknown }[] {
  return site.pipelineRuns.mock.calls.map(({ arguments: [seen] }) => {
    const { requestedUrl, finalUrl } = seen as { requestedUrl: unknown; finalUrl: unknown };
    return { requestedUrl, finalUrl };
  });
}

// The SDK OAuth client signs in on the bundled pages. One process allows three such sign-ins in ten seconds,
// so only the protocol era cases use it; the other cases send the token that the provider issued.
async function connectThroughBrowser(t: TestContext, site: RuntimeSite, era: McpProtocolEra): Promise<Client> {
  return (await site.user.connect(t, alice, era)).client;
}

async function connect(t: TestContext, site: RuntimeSite, era: McpProtocolEra = '2026-07-28'): Promise<Client> {
  return connectWithToken(t, { server: site.server.address, token: () => site.token, era });
}

describe('getURLAsMarkdown with the pinned renderer, the real pipeline, and real Better Auth access', () => {
  let executable = '';

  before(async () => {
    executable = await pinnedRenderer();
  });

  for (const era of mcpProtocolEras) {
    test(`Given the pinned renderer, trusted rules, and a real Better Auth token in ${era}, when the MCP client gets a local JavaScript page, then the real pipeline returns one exact cleaned Markdown entry and the server writes one safe completion record`, { timeout: 120_000 }, async (t) => {
      const site = await openRuntimeSite(t, executable);
      const fixture = await openPageFixture(t);
      const client = await connectThroughBrowser(t, site, era);
      const url = `${fixture.hostnameOrigin}/story`;

      const result = await callFetchTool(client, url);
      const tenant = site.server.tenant();
      await site.server.stop();

      assertText(result, '## Runtime story\n\nThe script rendered this paragraph with enough words to keep it.\n\nFinal host target\n\n'
        + `Related [article](${fixture.hostnameOrigin}/related) and [root](${fixture.hostnameOrigin}/root).`);
      assert.deepEqual(fixture.requests, ['/story', '/story.js']);
      assert.deepEqual(pagesSeen(site), [{ requestedUrl: url, finalUrl: url }]);
      const records = site.server.completionRecords();
      assert.equal(records.length, 1);
      const { durationMs, ...record } = records[0] as Record<string, unknown>;
      assert.equal(typeof durationMs, 'number');
      assert.deepEqual(record, {
        event: 'mcp.tool.completed', authority: `better-auth:${tenant.slice('local:'.length)}`, subject: site.subject, tenantId: tenant,
        tool: 'getURLAsMarkdown', url, urlStatus: 'valid', reason, reasonStatus: 'valid', status: 'success',
      });
      assert.doesNotMatch(site.server.completionLines().join('\n'), /Runtime story|Hidden instruction|Final host target/);
    });
  }

  test('Given a local server whose environment does not set LIGHTPANDA_DISABLE_TELEMETRY, when the MCP client gets a local JavaScript page, then the renderer run has telemetry off: it writes no telemetry install ID in its data directory, so it starts no telemetry sender and tries no connection to telemetry.lightpanda.io', { timeout: 120_000 }, async (t) => {
    const home = newServerHomeWithoutTelemetrySetting(t);
    const site = await openRuntimeSite(t, executable);
    const fixture = await openPageFixture(t);
    const client = await connect(t, site);

    const result = await callFetchTool(client, `${fixture.hostnameOrigin}/story`);
    await site.server.stop();

    assertText(result, '## Runtime story\n\nThe script rendered this paragraph with enough words to keep it.\n\nFinal host target\n\n'
      + `Related [article](${fixture.hostnameOrigin}/related) and [root](${fixture.hostnameOrigin}/root).`);
    const rendererData = lightpandaDataDirectory(home);
    assert.ok(existsSync(rendererData), 'the renderer made no data directory under the new HOME');
    assert.deepEqual(readdirSync(rendererData), []);
  });

  test('Given a redirect that changes the host and the path, when the real rendered page is cleaned, then requestedUrl keeps the accepted spelling, and the final URL selects the ad rules and resolves the relative links', { timeout: 120_000 }, async (t) => {
    const site = await openRuntimeSite(t, executable);
    const destination = await startFixture(t, (_request, response) => {
      response.setHeader('Content-Type', 'text/html');
      response.end(redirectedPage);
    });
    const source = await startFixture(t, (_request, response) => {
      response.writeHead(302, { Location: `${destination.origin}/directory/page` });
      response.end();
    });
    const client = await connect(t, site);
    const requestedUrl = `HTTP://LOCALHOST:${new URL(source.hostnameOrigin).port}/Start?private-query=yes#private-fragment`;

    const result = await callFetchTool(client, requestedUrl);
    await site.server.stop();

    // The trusted rules remove the target of the final host, 127.0.0.1, and keep the target of the requested host, localhost.
    assertText(result, '## Redirected story\n\nThe final page has a first paragraph with enough words to keep it.\n\nRequested host target\n\n'
      + `Related [child](${destination.origin}/directory/child) and [root](${destination.origin}/root).`);
    assert.deepEqual(source.requests, ['/Start?private-query=yes']);
    assert.deepEqual(destination.requests, ['/directory/page']);
    assert.deepEqual(pagesSeen(site), [{ requestedUrl, finalUrl: `${destination.origin}/directory/page#private-fragment` }]);
    assert.deepEqual(site.server.completionRecords().map(({ url, status }) => ({ url, status })), [{ url: `${source.hostnameOrigin}/Start`, status: 'success' }]);
    assert.doesNotMatch(site.server.completionLines().join('\n'), /private-query|private-fragment|127\.0\.0\.1/);
  });

  test('Given hidden content, HTML that the sanitizer withholds, an HTTP error, and a DOM deeper than the ad cleaner limit, when the real pipeline runs, then hidden content is removed, withheld HTML gives exact empty success, the failures give fixed errors without partial Markdown, and the server writes no renderer setup report', { timeout: 120_000 }, async (t) => {
    const site = await openRuntimeSite(t, executable);
    const fixture = await openPageFixture(t);
    const client = await connect(t, site);

    const results = [];
    for (const path of ['/hidden', '/withheld', '/missing', '/deep']) results.push(await callFetchTool(client, `${fixture.hostnameOrigin}${path}`));
    await site.server.stop();

    assertText(results[0] as CallToolResult, '## Hidden story\n\nThe visible paragraph has enough words to stay in the article body.');
    assertText(results[1] as CallToolResult, '');
    assertText(results[2] as CallToolResult, 'Page fetch failed', true);
    assertText(results[3] as CallToolResult, 'Page processing failed', true);
    assert.deepEqual(site.server.completionRecords().map(({ status }) => status), ['success', 'success', 'fetch_failed', 'processing_failed']);
    assert.doesNotMatch(site.server.completionLines().join('\n'), /private-|Hidden instruction|Display none|Missing page|HtmlDepthLimitError/);
    assert.equal(site.pipelineRuns.mock.calls.length, 3);
    assert.deepEqual(site.server.errorLines(), []);
  });

  test('Given a page that keeps the renderer waiting, when the modern client cancels its call, then the renderer child stops, the client gets no Markdown, and the server writes one cancelled record', { timeout: 120_000 }, async (t) => {
    const site = await openRuntimeSite(t, executable);
    const fixture = await openPageFixture(t);
    const client = await connect(t, site);
    const cancel = new AbortController();

    const call = callFetchTool(client, `${fixture.hostnameOrigin}/slow`, { signal: cancel.signal }).then((result) => result, () => undefined);
    await fixture.held.requested.promise;
    cancel.abort();
    await fixture.held.closed.promise;
    const outcome = await call;
    await site.server.stop();

    assert.equal(outcome, undefined);
    assert.equal(site.pipelineRuns.mock.calls.length, 0);
    assert.deepEqual(site.server.completionRecords().map(({ status }) => status), ['cancelled']);
  });

  test('Given an asynchronous page that needs more than five seconds to become ready, when the authorized MCP client gets it, then the complete page gives Markdown within the twenty-second readiness budget', { timeout: 120_000 }, async (t) => {
    const site = await openRuntimeSite(t, executable);
    const fixture = await openPageFixture(t);
    const client = await connect(t, site);
    const started = performance.now();

    const result = await callFetchTool(client, `${fixture.hostnameOrigin}/late`);
    const elapsed = performance.now() - started;
    await site.server.stop();

    assertText(result, '## Late story\n\nThe asynchronous page is ready with the complete paragraph after the old deadline.');
    assert.ok(elapsed > 5_000 && elapsed < 20_000, `Fetch took ${elapsed} ms`);
    assert.equal(site.pipelineRuns.mock.calls.length, 1);
    assert.deepEqual(site.server.completionRecords().map(({ status }) => status), ['success']);
    assert.deepEqual(site.server.errorLines(), []);
  });

  test('Given a page that never becomes ready, when the twenty-second readiness budget ends, then the MCP call fails without partial Markdown, the renderer child stops, and the operator gets one safe timeout report', { timeout: 120_000 }, async (t) => {
    const site = await openRuntimeSite(t, executable);
    const fixture = await openPageFixture(t);
    const client = await connect(t, site);
    const renderers = watchRendererChildren(t, executable);
    const started = performance.now();

    const result = await callFetchTool(client, `${fixture.hostnameOrigin}/slow?private-query=secret-token#private-fragment`);
    const elapsed = performance.now() - started;
    await fixture.held.closed.promise;
    await site.server.stop();

    assertText(result, 'Page fetch failed', true);
    assert.ok(elapsed >= 19_500 && elapsed < 23_000, `Fetch took ${elapsed} ms`);
    assert.equal(site.pipelineRuns.mock.calls.length, 0);
    assert.deepEqual(renderers.map(({ exitCode, signalCode }) => ({ exitCode, signalCode })), [{ exitCode: null, signalCode: 'SIGKILL' }]);
    const pid = renderers[0]?.pid;
    assert.ok(pid !== undefined);
    assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
    assert.deepEqual(site.server.completionRecords().map(({ status }) => status), ['fetch_failed']);
    assert.deepEqual(site.server.errorLines().map((line) => JSON.parse(line)), [{ event: 'renderer.fetch.failed', category: 'readiness_timeout', budgetMs: 20_000 }]);
    assert.doesNotMatch(site.server.errorLines().join('\n'), /https?:|localhost|private-|secret|token|Slow story|SIGKILL|lightpanda\//);
  });

  test('Given a legacy client call that keeps the renderer waiting, when the server shuts down, then the call is cancelled, the renderer child stops before the server finishes stopping, and the server writes one cancelled record', { timeout: 120_000 }, async (t) => {
    const site = await openRuntimeSite(t, executable);
    const fixture = await openPageFixture(t);
    const client = await connect(t, site, '2025-11-25');
    const renderers = watchRendererChildren(t, executable);

    const call = callFetchTool(client, `${fixture.hostnameOrigin}/slow`).then((result) => result, () => undefined);
    await fixture.held.requested.promise;
    await site.server.stop();
    const renderersAtStop = renderers.map(({ exitCode, signalCode }) => ({ exitCode, signalCode }));
    // A legacy client can get no answer after the server stops. Closing it ends the call before its request timeout.
    await client.close();
    const outcome = await call;
    await fixture.held.closed.promise;

    assert.deepEqual(renderersAtStop, [{ exitCode: null, signalCode: 'SIGKILL' }]);
    assert.ok(outcome === undefined || outcome.isError === true, JSON.stringify(outcome));
    assert.doesNotMatch(JSON.stringify(outcome ?? {}), /Slow story/);
    assert.equal(site.pipelineRuns.mock.calls.length, 0);
    assert.deepEqual(site.server.completionRecords().map(({ status }) => status), ['cancelled']);
  });
});
