import { repositoryRoot } from '../../support/processes/module-paths.ts';
import assert from 'node:assert/strict';
import { generatedOperationIdPattern } from '../../support/fixtures/execution-context.ts';
import { stepRecordsIn } from '../../support/drivers/operator-log.ts';
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test, type TestContext } from 'node:test';
import { SdkHttpError, UnauthorizedError, type CallToolResult, type Client } from '@modelcontextprotocol/client';
import { HtmlToMarkdownPipeline } from '../../../src/pipelines/html-processing/html-to-markdown-pipeline.ts';
import { incomingPageCases } from '../../support/fixtures/incoming-pages.ts';
import { searchToolInputSchema } from '../../../src/interfaces/mcp/search-tool-schema.ts';
import { fetchToolInputSchema } from '../../../src/interfaces/mcp/fetch-tool-schema.ts';
import { LIGHTPANDA_BLOCKED_CIDRS } from '../../../src/pipelines/providers/website-fetcher/network-policy.ts';
import { trustedAdRulesFile } from '../../support/fixtures/ad-rules.ts';
import type { AccountCredentials } from '../../support/in-process/better-auth-local.ts';
import { assertExit } from '../../support/processes/command-process.ts';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { InProcessServer } from '../../support/in-process/in-process-server.ts';
import { addUser, listedAccounts, operatorOn, registerArgs, registeredClientId, type Operator } from '../../support/dsl/local-commands.ts';
import { connectWithToken, issuedGrants, LocalMcpUser } from '../../support/dsl/local-mcp-user.ts';
import { selfHostedServerSettings, withRuntime } from '../../support/in-process/local-runtime.ts';
import { mcpProtocolEras } from '../../support/drivers/mcp/mcp-protocol-eras.ts';
import { RendererProcessDouble } from '../../support/doubles/website-fetcher/renderer-process-double.ts';

const [alice, bob, carol, dana] = ['alice', 'bob', 'carol', 'dana'].map((name): AccountCredentials => ({
  email: `${name}@example.com`, password: `${name}-password-1`,
})) as [AccountCredentials, AccountCredentials, AccountCredentials, AccountCredentials];
// The process double stands in for this configured executable; no renderer runs.
const rendererExecutable = '/opt/thermus-test/lightpanda';
const reason = 'Read the story for the support ticket';
const requestedUrl = 'HTTPS://Source.Example/Start?private-query=yes#private-fragment';
const rendererUrl = 'https://source.example/Start?private-query=yes#private-fragment';
const finalUrl = 'https://news.example/articles/story';
const storyHtml = '<html><head><title>Story</title></head><body><main><h1>Rendered story</h1>'
  + '<p>The rendered article has a first paragraph with enough words to keep it.</p>'
  + '<p class="final-host-target">Final host target</p><p class="requested-host-target">Requested host target</p>'
  + '<p>Related <a href="related">article</a> and <a href="/root">root</a>.</p>'
  + '<div hidden>Hidden instruction payload</div></main></body></html>';
const storyLead = '## Rendered story\n\nThe rendered article has a first paragraph with enough words to keep it.';
const storyLinks = 'Related [article](https://news.example/articles/related) and [root](https://news.example/root).';
// The trusted rules remove the target of the final host, news.example, and keep the target of the requested host.
const cleanedStory = `${storyLead}\n\nRequested host target\n\n${storyLinks}`;

interface Installation {
  readonly directory: string;
  readonly operator: Operator;
  readonly clientId: string;
  readonly userIds: ReadonlyMap<string, string>;
}

interface EraClients {
  readonly modern: Client;
  readonly legacy: Client;
}

async function installation(t: TestContext, accounts: readonly AccountCredentials[]): Promise<Installation> {
  const directory = dataDirectory(t);
  const operator = operatorOn(t, directory);
  for (const account of accounts) assertExit(await addUser(operator, account), 0);
  const clientId = registeredClientId(await operator(registerArgs(alice), [alice.password]));
  const userIds = new Map((await listedAccounts(operator)).map(({ email, id }) => [email, id] as const));
  return { directory, operator, clientId, userIds };
}

function serverSettings(directory: string, adRulesFile = trustedAdRulesFile): Readonly<Record<string, string>> {
  return { ...selfHostedServerSettings(directory, adRulesFile), LIGHTPANDA_BIN: rendererExecutable };
}

function rulesFile(t: TestContext, contents?: string): string {
  const file = join(dataDirectory(t), 'ad-rules.txt');
  if (contents === undefined) copyFileSync(trustedAdRulesFile, file);
  else writeFileSync(file, contents);
  return file;
}

function productionLaunch(url: string) {
  return {
    executable: rendererExecutable,
    args: [
      'fetch', '--json', '--dump', 'html', '--fail-on-http-error', '--wait-until', 'networkidle', '--wait-ms', '60000',
      '--block-private-networks', '--block-cidrs', LIGHTPANDA_BLOCKED_CIDRS, '--http-proxy', '', url,
    ],
    options: { encoding: 'utf8', env: { ...process.env, LIGHTPANDA_DISABLE_TELEMETRY: 'true' }, maxBuffer: 32 * 1024 * 1024, timeout: 60_000 },
  };
}

async function callFetchTool(client: Client, url = requestedUrl): Promise<CallToolResult> {
  return await client.callTool({ name: 'getURLAsMarkdown', arguments: { url, reason } });
}

function assertText(result: CallToolResult, text: string, isError = false): void {
  assert.deepEqual(result.content, [{ type: 'text', text }]);
  assert.equal(result.isError === true, isError);
  assert.equal(result.structuredContent, undefined);
}

async function refusedStatus(client: Client): Promise<number | string> {
  try {
    await callFetchTool(client);
    return 'accepted';
  } catch (error) {
    if (error instanceof UnauthorizedError) return 401;
    if (error instanceof SdkHttpError) return error.status;
    throw error;
  }
}

async function eraClients(t: TestContext, server: InProcessServer, token: () => string): Promise<EraClients> {
  const modern = await connectWithToken(t, { server: server.address, token, era: '2026-07-28' });
  const legacy = await connectWithToken(t, { server: server.address, token, era: '2025-11-25' });
  return { modern, legacy };
}

async function refusals({ modern, legacy }: EraClients): Promise<(number | string)[]> {
  return [await refusedStatus(modern), await refusedStatus(legacy)];
}

function changedPayload(token: string, claim: string, value: unknown): string {
  const [header, payload, signature] = token.split('.');
  const claims = JSON.parse(Buffer.from(payload ?? '', 'base64url').toString('utf8'));
  return [header, Buffer.from(JSON.stringify({ ...claims, [claim]: value })).toString('base64url'), signature].join('.');
}

describe('Self-hosted getURLAsMarkdown with real Better Auth access and the production pipeline, offline', () => {
  for (const era of mcpProtocolEras) {
    test(`Given a real Better Auth token in ${era}, trusted rules, and a renderer process double, when the MCP client lists and calls getURLAsMarkdown, then the production pipeline returns one exact cleaned Markdown entry with rules and links from the final URL, the server keeps the rules that it read at startup, and each call writes allowed outgoing and incoming records joined to its completion ID`, { timeout: 120_000 }, async (t) => {
      const setup = await installation(t, [alice]);
      const rules = rulesFile(t);
      const renderer = RendererProcessDouble.install(t);
      renderer.serve(rendererUrl, { finalUrl, html: storyHtml });
      const pipelineRuns = t.mock.method(HtmlToMarkdownPipeline.prototype, 'process');
      const server = InProcessServer.open(t);
      await server.start(serverSettings(setup.directory, rules));
      const user = new LocalMcpUser(server.address, setup.clientId, alice);
      const { client } = await user.connect(t, alice, era);

      const listed = await client.listTools();
      const first = await callFetchTool(client);
      writeFileSync(rules, '');
      const second = await callFetchTool(client);
      const tenant = server.tenant();
      await server.stop();

      assert.deepEqual(listed.tools.map(({ name, inputSchema }) => ({ name, inputSchema })), [{ name: 'getURLAsMarkdown', inputSchema: fetchToolInputSchema }, { name: 'search', inputSchema: searchToolInputSchema }]);
      assertText(first, cleanedStory);
      assertText(second, cleanedStory);
      assert.deepEqual(renderer.launches, [productionLaunch(rendererUrl), productionLaunch(rendererUrl)]);
      assert.deepEqual(renderer.lookups, ['source.example', 'source.example']);
      const pages = pipelineRuns.mock.calls.map(({ arguments: [page] }) => ({ requestedUrl: page.requestedUrl, finalUrl: page.finalUrl }));
      assert.deepEqual(pages, [{ requestedUrl, finalUrl }, { requestedUrl, finalUrl }]);
      const records = server.completionRecords();
      for (const record of records) assert.equal(typeof record.durationMs, 'number');
      for (const record of records) assert.match(record.operationId as string, generatedOperationIdPattern);
      assert.equal(new Set(records.map(({ operationId }) => operationId)).size, 2);
      assert.deepEqual(records.map(({ durationMs: _durationMs, operationId: _operationId, ...record }) => record), [1, 2].map(() => ({
        event: 'mcp.tool.completed',
        authority: `better-auth:${tenant.slice('local:'.length)}`,
        subject: setup.userIds.get(alice.email),
        tenantId: tenant,
        tool: 'getURLAsMarkdown',
        url: 'https://source.example/Start',
        urlStatus: 'valid',
        reason,
        reasonStatus: 'valid',
        status: 'success',
      })));
      const steps = stepRecordsIn(server.lines.join('\n'));
      assert.deepEqual(steps.map(({ durationMs, ...record }) => {
        assert.ok(Number.isSafeInteger(durationMs) && (durationMs as number) >= 0);
        return record;
      }), records.flatMap(({ operationId }) => ['outgoing.observe_request', 'incoming.process_html'].map((stepId) => ({ event: 'pipeline.step.completed', operationId, stepId, outcome: 'allowed' }))));
      const recordText = server.completionLines().join('\n');
      assert.doesNotMatch(recordText, /private-query|private-fragment|Hidden instruction|Rendered story|Requested host target/);
      assert.ok(!recordText.includes(user.accessToken), 'a completion record holds the access token');
    });
  }

  test('Given forged, revoked, and disabled-user credentials in both protocol eras, when each MCP client calls getURLAsMarkdown, then the existing 401 or 403 refusal happens before any fetch or cleaning and writes no completion record, and a peer with a current token still gets the cleaned page', { timeout: 180_000 }, async (t) => {
    const setup = await installation(t, [alice, bob, carol, dana]);
    const grants = await issuedGrants(setup.directory, setup.clientId, [alice, bob, carol, dana]);
    const tokens = new Map([...grants].map(([email, grant]) => [email, grant.accessToken]));
    const renderer = RendererProcessDouble.install(t);
    renderer.serve(rendererUrl, { finalUrl, html: storyHtml });
    const pipelineRuns = t.mock.method(HtmlToMarkdownPipeline.prototype, 'process');
    const server = InProcessServer.open(t);
    await server.start(serverSettings(setup.directory));
    const clients = new Map<string, EraClients>();
    for (const { email } of [alice, bob, carol, dana]) clients.set(email, await eraClients(t, server, () => tokens.get(email) ?? ''));
    const clientsOf = (account: AccountCredentials): EraClients => clients.get(account.email) as EraClients;
    const aliceToken = tokens.get(alice.email) ?? '';

    const forged = [];
    for (const token of [changedPayload(aliceToken, 'sub', grants.get(bob.email)?.id), 'not-a-token']) {
      tokens.set(alice.email, token);
      forged.push(await refusals(clientsOf(alice)));
    }
    tokens.set(alice.email, aliceToken);
    await server.stop();
    assertExit(await setup.operator(['users', 'reset-password', bob.email], ['bob-password-2', 'bob-password-2']), 0);
    assertExit(await setup.operator(['users', 'disable', carol.email]), 0);
    // A ban without the session deletion of the disable command leaves the token active; access resolution refuses the user.
    await withRuntime(setup.directory, async (runtime) => {
      await (await runtime.auth.$context).internalAdapter.updateUser(grants.get(dana.email)?.id ?? '', { banned: true, banExpires: null });
    });
    await server.start(serverSettings(setup.directory));
    const revoked = await refusals(clientsOf(bob));
    const disabled = await refusals(clientsOf(carol));
    const disabledWithLiveSession = await refusals(clientsOf(dana));
    const workBeforePeer = { launches: renderer.launches.length, lookups: renderer.lookups.length, cleaned: pipelineRuns.mock.callCount(), records: server.completionLines().length };
    const peerResults = [await callFetchTool(clientsOf(alice).modern), await callFetchTool(clientsOf(alice).legacy)];
    await server.stop();

    assert.deepEqual(forged, [[401, 401], [401, 401]]);
    assert.deepEqual(revoked, [401, 401]);
    assert.deepEqual(disabled, [401, 401]);
    assert.deepEqual(disabledWithLiveSession, [403, 403]);
    assert.deepEqual(workBeforePeer, { launches: 0, lookups: 0, cleaned: 0, records: 0 });
    for (const result of peerResults) assertText(result, cleanedStory);
    assert.equal(renderer.launches.length, 2);
    assert.equal(pipelineRuns.mock.callCount(), 2);
    assert.deepEqual(server.completionRecords().map(({ subject, status }) => ({ subject, status })), [1, 2].map(() => ({ subject: grants.get(alice.email)?.id, status: 'success' })));
  });

  test('Given an empty rules file, when an authorized client gets a page through the production composition, then the ad rules do nothing and the hidden content is still removed', { timeout: 120_000 }, async (t) => {
    const setup = await installation(t, [alice]);
    const token = (await issuedGrants(setup.directory, setup.clientId, [alice])).get(alice.email)?.accessToken ?? '';
    const renderer = RendererProcessDouble.install(t);
    renderer.serve(rendererUrl, { finalUrl, html: storyHtml });
    const server = InProcessServer.open(t);
    await server.start(serverSettings(setup.directory, rulesFile(t, '')));
    const client = await connectWithToken(t, { server: server.address, token: () => token });

    const result = await callFetchTool(client);
    await server.stop();

    assertText(result, `${storyLead}\n\nFinal host target\n\nRequested host target\n\n${storyLinks}`);
    assert.deepEqual(server.completionRecords().map(({ status }) => status), ['success']);
  });

  for (const era of mcpProtocolEras) {
    test(`Given empty, hidden-only, ad-only, withheld, oversized, deep, and failed pages in ${era}, when a real self-hosted user fetches them, then exact output and truthful incoming records join one completion per call`, { timeout: 120_000 }, async (t) => {
      const setup = await installation(t, [alice]);
      const renderer = RendererProcessDouble.install(t);
      for (const { name, html } of incomingPageCases) renderer.serve(`https://source.example/${name}`, { finalUrl: `https://news.example/${name}`, html });
      const pipeline = t.mock.method(HtmlToMarkdownPipeline.prototype, 'process');
      const token = (await issuedGrants(setup.directory, setup.clientId, [alice])).get(alice.email)?.accessToken ?? '';
      const server = InProcessServer.open(t);
      await server.start(serverSettings(setup.directory));
      const client = await connectWithToken(t, { server: server.address, token: () => token, era });

      for (const { name, text } of incomingPageCases) assertText(await callFetchTool(client, `https://source.example/${name}`), text, text !== '');
      assertText(await callFetchTool(client, 'https://source.example/missing'), 'Page fetch failed: HTTP 404', true);
      await server.stop();

      const completions = server.completionRecords();
      assert.equal(completions.length, incomingPageCases.length + 1);
      assert.equal(new Set(completions.map(({ operationId }) => operationId)).size, completions.length);
      assert.deepEqual(completions.map(({ status }) => status), [...incomingPageCases.map(({ text }) => text ? 'processing_failed' : 'success'), 'fetch_failed']);
      assert.equal(pipeline.mock.callCount(), incomingPageCases.length - 1);
      assert.ok(pipeline.mock.calls.every(({ arguments: [page] }) => !page.requestedUrl.endsWith('/oversize')));
      const steps = stepRecordsIn(server.lines.join('\n'));
      assert.equal(steps.length, incomingPageCases.length * 2 + 1);
      assert.deepEqual(steps.map(({ durationMs, ...record }) => {
        assert.ok(Number.isSafeInteger(durationMs) && (durationMs as number) >= 0);
        return record;
      }), [
        ...incomingPageCases.flatMap(({ text, code }, index) => [
          { event: 'pipeline.step.completed', operationId: completions[index].operationId, stepId: 'outgoing.observe_request', outcome: 'allowed' },
          { event: 'pipeline.step.completed', operationId: completions[index].operationId, stepId: 'incoming.process_html', outcome: text ? 'failed' : code ? 'blocked' : 'allowed', ...(code ? { code } : {}) },
        ]),
        { event: 'pipeline.step.completed', operationId: completions.at(-1)?.operationId, stepId: 'outgoing.observe_request', outcome: 'allowed' },
      ]);
      for (const completion of completions) assert.match(completion.operationId as string, generatedOperationIdPattern);
      assert.doesNotMatch(JSON.stringify(steps), /private-|Visible text|Story|source|news|Bearer|warning/);
      assert.doesNotMatch(server.completionLines().join('\n'), /private-|Visible text|HtmlDepthLimitError|HTTP request failed/);
      assert.ok(!server.lines.join('\n').includes(token));
    });
  }
});

const searchDescription = 'Search the web with a text query and return cleaned results as Markdown. Use this tool for web searches; search engines may block generic page-fetch requests. Use getURLAsMarkdown to read a result page. Give the reason the agent needs the search.';
const fetchDescription = 'Fetch a known web page URL as Markdown. For web searches, use search instead of fetching a search engine results URL. Give the reason the agent needs the page.';

for (const era of mcpProtocolEras) {
  test(`Given the production self-hosted application and an authorized user in ${era}, when the user discovers and calls search, then both tools have their guidance and schemas and the captured Brave results reach the client`, { timeout: 120_000 }, async (t) => {
    const setup = await installation(t, [alice]);
    const searchUrl = 'https://search.brave.com/search?q=entry+wiring';
    const renderer = RendererProcessDouble.install(t);
    renderer.serve(searchUrl, { finalUrl: searchUrl, html: readFileSync(new URL('test/support/fixtures/search-engine/brave-results.html', repositoryRoot), 'utf8') });
    const token = (await issuedGrants(setup.directory, setup.clientId, [alice])).get(alice.email)?.accessToken ?? '';
    const server = InProcessServer.open(t);
    await server.start(serverSettings(setup.directory));
    const client = await connectWithToken(t, { server: server.address, token: () => token, era });
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })), [
      { name: 'getURLAsMarkdown', description: fetchDescription, inputSchema: fetchToolInputSchema },
      { name: 'search', description: searchDescription, inputSchema: searchToolInputSchema },
    ]);
    const result = await client.callTool({ name: 'search', arguments: { query: 'entry wiring', reason: 'Verify production search' } });
    assert.notEqual(result.isError, true);
    assert.equal(result.structuredContent, undefined);
    assert.equal(result.content.length, 1);
    const content = result.content[0];
    assert.equal(content.type, 'text');
    if (content.type !== 'text') throw new Error('Expected Markdown');
    const expected = JSON.parse(readFileSync(new URL('test/support/fixtures/search-engine/brave-results-expected.json', repositoryRoot), 'utf8')) as Array<{ title: string; url: string }>;
    for (const entry of expected) {
      assert.ok(content.text.includes(entry.title), `Missing result: ${entry.title}`);
      assert.ok(content.text.includes(entry.url), `Missing destination: ${entry.url}`);
    }
    assert.deepEqual(renderer.launches, [productionLaunch(searchUrl)]);
    assert.equal(server.completionRecords().at(-1)?.status, 'success');
  });
}
