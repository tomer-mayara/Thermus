import assert from 'node:assert/strict';
import childProcess, { type ExecFileException } from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { test, type TestContext } from 'node:test';
import { Client, InMemoryTransport, type CallToolResult } from '@modelcontextprotocol/client';
import { createRequestContext } from '../../src/auth/access-context.ts';
import { fetchToolServers } from '../../src/fetch-tool.ts';
import type { RequestServerBuilder } from '../../src/mcp/mcp-server.ts';
import { trustedAdRulesFile } from '../support/ad-rules.ts';

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
  t.mock.method(childProcess, 'execFile', ((...args: Parameters<typeof childProcess.execFile>) => {
    const code = remaining.shift() ?? 'ENOENT';
    const error = Object.assign(new Error(`spawn ${executable} ${code}`), { code, syscall: `spawn ${executable}`, cmd: `${executable} fetch ${url}` });
    if (code !== 'ENOENT' && code !== 'EACCES') throw error;
    const complete = args.at(-1) as ProcessCompletion;
    setImmediate(() => complete(error, '', ''));
    return new childProcess.ChildProcess();
  }) as typeof childProcess.execFile);
  syncBuiltinESMExports();
  t.after(() => {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  });
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
  const buildServer = fetchToolServers({ AD_RULES_FILE: trustedAdRulesFile, LIGHTPANDA_BIN: executable }, {
    info: (line) => lines.info.push(line),
    error: (line) => lines.error.push(line),
  });
  const client = await connectedClient(t, buildServer(context, { signal: new AbortController().signal, track: (task) => task }));

  const results: CallToolResult[] = [];
  for (let call = 0; call < 5; call += 1) {
    results.push(await client.callTool({ name: 'getURLAsMarkdown', arguments: { url, reason: 'Read the page' } }) as CallToolResult);
  }

  for (const result of results) assert.deepEqual([result.content, result.isError], [[{ type: 'text', text: 'Page fetch failed' }], true]);
  assert.deepEqual(lines.info.map((line) => JSON.parse(line).status), Array(5).fill('fetch_failed'));
  assert.deepEqual(lines.error, [
    'Renderer setup failure: the Lightpanda executable is missing (ENOENT). Each page fetch fails until you correct this. See docs/lightpanda-runtime.md.',
    'Renderer setup failure: the Lightpanda executable cannot start (EACCES). Each page fetch fails until you correct this. See docs/lightpanda-runtime.md.',
    'Renderer setup failure: the Lightpanda executable cannot start (ENOEXEC). Each page fetch fails until you correct this. See docs/lightpanda-runtime.md.',
  ]);
});
