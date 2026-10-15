import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test, type TestContext } from 'node:test';
import type { CallToolResult, Client } from '@modelcontextprotocol/client';
import type { AccountCredentials } from '../../support/in-process/better-auth-local.ts';
import { assertExit } from '../../support/processes/command-process.ts';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { InProcessServer } from '../../support/in-process/in-process-server.ts';
import { addUser, operatorOn, registerArgs, registeredClientId } from '../../support/dsl/local-commands.ts';
import { connectWithToken, issuedGrants } from '../../support/dsl/local-mcp-user.ts';
import { selfHostedServerSettings } from '../../support/in-process/local-runtime.ts';
import { RendererProcessDouble } from '../../support/doubles/website-fetcher/renderer-process-double.ts';

const alice: AccountCredentials = { email: 'alice@example.com', password: 'alice-password-1' };
const reason = 'Read the private-reason page for the task';
// An address literal needs no DNS lookup, so a call reaches the start of the renderer offline.
const requestedUrl = 'https://93.184.216.34/private-path?private-query=yes#private-fragment';
const missingReport = 'Renderer setup failure: the Lightpanda executable is missing (ENOENT). '
  + 'Each page fetch fails until you correct this. See docs/lightpanda-runtime.md.';
const notExecutableReport = 'Renderer setup failure: the Lightpanda executable cannot start (EACCES). '
  + 'Each page fetch fails until you correct this. See docs/lightpanda-runtime.md.';

interface Installation {
  readonly directory: string;
  readonly token: string;
}

interface Site {
  readonly server: InProcessServer;
  readonly client: Client;
}

async function installation(t: TestContext): Promise<Installation> {
  const directory = dataDirectory(t);
  const operator = operatorOn(t, directory);
  assertExit(await addUser(operator, alice), 0);
  const clientId = registeredClientId(await operator(registerArgs(alice), [alice.password]));
  const token = (await issuedGrants(directory, clientId, [alice])).get(alice.email)?.accessToken;
  assert.ok(token);
  return { directory, token };
}

async function openSite(t: TestContext, setup: Installation, executable: string): Promise<Site> {
  const server = InProcessServer.open(t);
  await server.start({ ...selfHostedServerSettings(setup.directory), LIGHTPANDA_BIN: executable });
  return { server, client: await connectWithToken(t, { server: server.address, token: () => setup.token }) };
}

async function callFetchTool(client: Client, url = requestedUrl): Promise<CallToolResult> {
  return await client.callTool({ name: 'getURLAsMarkdown', arguments: { url, reason } });
}

function assertFetchFailed(results: readonly CallToolResult[]): void {
  for (const result of results) {
    assert.deepEqual(result.content, [{ type: 'text', text: 'Page fetch failed' }]);
    assert.equal(result.isError, true);
  }
}

// The process error starts with "spawn", and --json is one of the renderer arguments.
function assertNoRequestData(lines: readonly string[], setup: Installation, executable: string): void {
  const text = lines.join('\n');
  for (const value of ['93.184.216.34', 'private-', setup.token, executable, '--json', 'spawn']) {
    assert.ok(!text.includes(value), `A report shows ${value}:\n${text}`);
  }
}

describe('Renderer setup reports in the operator log', () => {
  test('Given a server with LIGHTPANDA_BIN that names a missing executable, when an authorized client calls getURLAsMarkdown two times, then each call gets Page fetch failed and a fetch_failed record, and the operator log has one report that names the missing renderer and the runtime guide but no request data', { timeout: 120_000 }, async (t) => {
    const setup = await installation(t);
    const executable = join(dataDirectory(t), 'missing-lightpanda');
    const site = await openSite(t, setup, executable);

    const results = [await callFetchTool(site.client), await callFetchTool(site.client)];
    await site.server.stop();

    assertFetchFailed(results);
    assert.deepEqual(site.server.completionRecords().map(({ url, status }) => ({ url, status })), [1, 2].map(() => ({
      url: 'https://93.184.216.34/private-path', status: 'fetch_failed',
    })));
    assert.deepEqual(site.server.errorLines(), [missingReport]);
    assertNoRequestData(site.server.errorLines(), setup, executable);
  });

  test('Given a server that reported its missing executable, when the operator puts a file that is not executable at that path and the client calls two more times, then each call still gets Page fetch failed and a fetch_failed record, and the log gets one more report, which names an executable that cannot start (EACCES)', { timeout: 120_000 }, async (t) => {
    const setup = await installation(t);
    const executable = join(dataDirectory(t), 'lightpanda');
    const site = await openSite(t, setup, executable);

    const results = [await callFetchTool(site.client)];
    writeFileSync(executable, 'not a program\n', { mode: 0o644 });
    results.push(await callFetchTool(site.client), await callFetchTool(site.client));
    await site.server.stop();

    assertFetchFailed(results);
    assert.deepEqual(site.server.completionRecords().map(({ status }) => status), ['fetch_failed', 'fetch_failed', 'fetch_failed']);
    assert.deepEqual(site.server.errorLines(), [missingReport, notExecutableReport]);
    assertNoRequestData(site.server.errorLines(), setup, executable);
  });

  test('Given a renderer process double that answers with HTTP 404, when an authorized client gets that page and a blocked destination, then each call gets Page fetch failed and a fetch_failed record, and the server writes no renderer setup report', { timeout: 120_000 }, async (t) => {
    const setup = await installation(t);
    const renderer = RendererProcessDouble.install(t);
    const site = await openSite(t, setup, '/opt/thermus-test/lightpanda');

    const results = [await callFetchTool(site.client, 'https://source.example/missing'), await callFetchTool(site.client, 'https://127.0.0.1/private')];
    await site.server.stop();

    assertFetchFailed(results);
    assert.equal(renderer.launches.length, 1);
    assert.deepEqual(site.server.completionRecords().map(({ status }) => status), ['fetch_failed', 'fetch_failed']);
    assert.deepEqual(site.server.errorLines(), []);
  });
});
