import { completionRecordsIn } from '../support/drivers/operator-log.ts';
import { executionContextOf } from '../support/fixtures/execution-context.ts';
import assert from 'node:assert/strict';
import childProcess, { type ChildProcess, type ExecFileException } from 'node:child_process';
import { test, type TestContext } from 'node:test';
import { Client, InMemoryTransport, type CallToolResult } from '@modelcontextprotocol/client';
import { createRequestContext } from '../../src/auth/access-context.ts';
import { createFetchOperation, fetchToolServers } from '../../src/fetch-tool.ts';
import type { RequestServerBuilder } from '../../src/mcp/mcp-server.ts';
import { WebsiteFetcherLightpanda } from '../../src/website-fetcher/website-fetcher-lightpanda.ts';
import { WebsiteFetchReadinessTimeoutError } from '../../src/website-fetcher/website-fetcher.ts';
import { trustedAdRulesFile } from '../support/fixtures/ad-rules.ts';
import { syncBuiltinMocks } from '../support/doubles/website-fetcher/builtin-mocks.ts';
import { RendererChildDouble } from '../support/doubles/website-fetcher/renderer-process-double.ts';

const executable = '/opt/thermus-test/lightpanda';
// An address literal needs no DNS lookup.
const url = 'https://93.184.216.34/private-path?private-query=yes';
const context = createRequestContext({
  user: { authority: 'https://synthetic.example/', subject: 'synthetic-user' },
  tenantId: 'synthetic-workspace',
  grants: [{ role: 'reader', permissions: ['product:access'] }],
});

type ProcessCompletion = (error: ExecFileException | null, stdout: string, stderr: string) => void;

// Node reports ENOENT and EACCES after the start call, but it throws other codes, such as ENOEXEC, at once.
function failedStarts(t: TestContext, codes: readonly string[]): void {
  const remaining = [...codes];
  t.mock.method(childProcess, 'execFile', ((...args: Parameters<typeof childProcess.execFile>): ChildProcess => {
    const code = remaining.shift() ?? 'ENOENT';
    const error = Object.assign(new Error(`spawn ${executable} ${code}`), { code, syscall: `spawn ${executable}`, cmd: `${executable} fetch ${url}` });
    if (code !== 'ENOENT' && code !== 'EACCES') throw error;
    const complete = args.at(-1) as ProcessCompletion;
    setImmediate(() => complete(error, '', ''));
    return new RendererChildDouble();
  }) as typeof childProcess.execFile);
  syncBuiltinMocks(t);
}

async function connectedClient(t: TestContext, server: ReturnType<RequestServerBuilder>): Promise<Client> {
  const client = new Client({ name: 'fetch-tool-renderer-setup-report', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  t.after(async () => { await client.close(); await server.close(); });
  await server.connect(serverTransport);
  await client.connect(clientTransport, { signal: t.signal });
  return client;
}

test('Given the server composition and renderer starts that fail with ENOENT and EACCES two times each and then with ENOEXEC at once, when a client calls the fetch tool for each, then each call gets Page fetch failed and the operator log gets one error line for each code, in order, with no request data', async (t) => {
  failedStarts(t, ['ENOENT', 'ENOENT', 'EACCES', 'EACCES', 'ENOEXEC']);
  const lines = { info: [] as string[], error: [] as string[] };
  const logger = {
    info: (line: string) => lines.info.push(line),
    error: (line: string) => lines.error.push(line),
  };
  const buildServer = fetchToolServers(createFetchOperation({ AD_RULES_FILE: trustedAdRulesFile, LIGHTPANDA_BIN: executable }, logger), logger);
  const client = await connectedClient(t, buildServer(context, { signal: new AbortController().signal, track: (task) => task }));

  const results: CallToolResult[] = [];
  for (let call = 0; call < 5; call += 1) {
    results.push(await client.callTool({ name: 'getURLAsMarkdown', arguments: { url, reason: 'Read the page' } }) as CallToolResult);
  }

  for (const result of results) assert.deepEqual([result.content, result.isError], [[{ type: 'text', text: 'Page fetch failed' }], true]);
  assert.deepEqual(completionRecordsIn(lines.info.join('\n')).map(({ status }) => status), Array(5).fill('fetch_failed'));
  const diagnostics = lines.error.filter((line) => line.startsWith('{')).map((line) => JSON.parse(line));
  assert.deepEqual(diagnostics.map(({ operationId }) => operationId), completionRecordsIn(lines.info.join('\n')).map(({ operationId }) => operationId));
  assert.deepEqual(diagnostics.map(({ category }) => category), Array(5).fill('launch'));
  assert.deepEqual(lines.error.filter((line) => !line.startsWith('{')), [
    'Renderer setup failure: the Lightpanda executable is missing (ENOENT). Each page fetch fails until you correct this. See docs/lightpanda-runtime.md.',
    'Renderer setup failure: the Lightpanda executable cannot start (EACCES). Each page fetch fails until you correct this. See docs/lightpanda-runtime.md.',
    'Renderer setup failure: the Lightpanda executable cannot start (ENOEXEC). Each page fetch fails until you correct this. See docs/lightpanda-runtime.md.',
  ]);
});

for (const loggerFails of [false, true]) {
  test(`Given the server composition and two readiness timeouts with private causes, when the operator logger ${loggerFails ? 'throws' : 'works'}, then each call gets the safe fetch failure and each timeout sends one report with only the fixed category and budget`, async (t) => {
    const failure = new WebsiteFetchReadinessTimeoutError({ cause: new Error(`${executable} fetch ${url} Bearer private-token private-stderr`) });
    t.mock.method(WebsiteFetcherLightpanda.prototype, 'fetchURL', async () => { throw failure; });
    const errors: string[] = [];
    const logger = {
      info: (_line: string) => {},
      error: (line: string) => {
        errors.push(line);
        if (loggerFails) throw new Error('private log failure');
      },
    };
    const operation = createFetchOperation({ AD_RULES_FILE: trustedAdRulesFile, LIGHTPANDA_BIN: executable }, logger);
    const executions = [executionContextOf(), executionContextOf()];

    for (let call = 0; call < 2; call += 1) {
      await assert.rejects(operation(url, context, executions[call]), (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, 'Page fetch failed');
        assert.equal(error.cause, undefined);
        return true;
      });
    }

    assert.deepEqual(errors.map((line) => JSON.parse(line)), executions.map(({ operationId }) => ({ event: 'renderer.fetch.failed', category: 'readiness_timeout', phase: 'renderer_process', budgetMs: 20_000, operationId })));
    assert.doesNotMatch(errors.join('\n'), /private|Bearer|https?:|lightpanda|stderr|SIGKILL/);
  });
}
