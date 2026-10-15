import assert from 'node:assert/strict';
import { copyFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test, type TestContext } from 'node:test';
import { SdkHttpError, UnauthorizedError, type CallToolResult, type Client } from '@modelcontextprotocol/client';
import { HtmlToMarkdownPipeline } from '../../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';
import { fetchToolInputSchema } from '../../../src/mcp/fetch-tool-schema.ts';
import { LIGHTPANDA_BLOCKED_CIDRS } from '../../../src/website-fetcher/network-policy.ts';
import { trustedAdRulesFile } from '../../support/ad-rules.ts';
import type { AccountCredentials } from '../../support/in-process/better-auth-local.ts';
import { assertExit } from '../../support/command-process.ts';
import { dataDirectory } from '../../support/data-directory.ts';
import { InProcessServer } from '../../support/in-process/in-process-server.ts';
import { addUser, listedAccounts, operatorOn, registerArgs, registeredClientId, type Operator } from '../../support/dsl/local-commands.ts';
import { connectWithToken, issuedGrants, LocalMcpUser } from '../../support/dsl/local-mcp-user.ts';
import { selfHostedServerSettings, withRuntime } from '../../support/in-process/local-runtime.ts';
import { mcpProtocolEras } from '../../support/drivers/mcp/mcp-protocol-eras.ts';
import { RendererProcessDouble } from '../../support/renderer-process-double.ts';

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
    test(`Given a real Better Auth token in ${era}, trusted rules, and a renderer process double, when the MCP client lists and calls getURLAsMarkdown, then the production pipeline returns one exact cleaned Markdown entry with rules and links from the final URL, the server keeps the rules that it read at startup, and each call writes one safe completion record`, { timeout: 120_000 }, async (t) => {
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

      assert.deepEqual(listed.tools.map(({ name, inputSchema }) => ({ name, inputSchema })), [{ name: 'getURLAsMarkdown', inputSchema: fetchToolInputSchema }]);
      assertText(first, cleanedStory);
      assertText(second, cleanedStory);
      assert.deepEqual(renderer.launches, [productionLaunch(rendererUrl), productionLaunch(rendererUrl)]);
      assert.deepEqual(renderer.lookups, ['source.example', 'source.example']);
      const pages = pipelineRuns.mock.calls.map(({ arguments: [page] }) => ({ requestedUrl: page.requestedUrl, finalUrl: page.finalUrl }));
      assert.deepEqual(pages, [{ requestedUrl, finalUrl }, { requestedUrl, finalUrl }]);
      const records = server.completionRecords();
      for (const record of records) assert.equal(typeof record.durationMs, 'number');
      assert.deepEqual(records.map(({ durationMs: _durationMs, ...record }) => record), [1, 2].map(() => ({
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

  test('Given HTML that the sanitizer withholds, HTML deeper than the ad cleaner limit, and a failed render, when an authorized client calls the tool, then it gets exact empty success or a fixed error without partial Markdown, and each record has no cause or page text', { timeout: 120_000 }, async (t) => {
    const setup = await installation(t, [alice]);
    const renderer = RendererProcessDouble.install(t);
    let nested = '<span hidden>private-hidden-text</span>';
    for (let pass = 1; pass < 8; pass += 1) nested = `<${nested}span hidden>private-hidden-text</span>`;
    // A script's text is serialized without escapes, so its markup forms new hidden elements after each removal pass.
    renderer.serve('https://source.example/withheld', {
      finalUrl: 'https://news.example/withheld',
      html: `<html><body><main><h1>Story</h1><p>Visible text that is long enough to stay in the article.</p><div><script type="text/plain"></script>${nested}</script></div></main></body></html>`,
    });
    renderer.serve('https://source.example/deep', {
      finalUrl: 'https://news.example/deep',
      html: `<html><body><main>${'<div>'.repeat(300)}private-deep-text${'</div>'.repeat(300)}</main></body></html>`,
    });
    const token = (await issuedGrants(setup.directory, setup.clientId, [alice])).get(alice.email)?.accessToken ?? '';
    const server = InProcessServer.open(t);
    await server.start(serverSettings(setup.directory));
    const client = await connectWithToken(t, { server: server.address, token: () => token });

    const results = [];
    for (const url of ['https://source.example/withheld', 'https://source.example/deep', 'https://source.example/missing']) results.push(await callFetchTool(client, url));
    await server.stop();

    assertText(results[0] as CallToolResult, '');
    assertText(results[1] as CallToolResult, 'Page processing failed', true);
    assertText(results[2] as CallToolResult, 'Page fetch failed', true);
    assert.deepEqual(server.completionRecords().map(({ url, status }) => ({ url, status })), [
      { url: 'https://source.example/withheld', status: 'success' },
      { url: 'https://source.example/deep', status: 'processing_failed' },
      { url: 'https://source.example/missing', status: 'fetch_failed' },
    ]);
    assert.doesNotMatch(server.completionLines().join('\n'), /private-|Visible text|HtmlDepthLimitError|HTTP request failed/);
  });
});
