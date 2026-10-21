import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import { StreamableHTTPClientTransport, type CallToolResult, type Client } from '@modelcontextprotocol/client';
import type { ApplicationLogger } from '../../../../src/app/application.ts';
import { startHttpServer } from '../../../../src/runtime/http/server.ts';
import { fetchToolInputSchema } from '../../../../src/interfaces/mcp/fetch-tool-schema.ts';
import { searchToolInputSchema } from '../../../../src/interfaces/mcp/search-tool-schema.ts';
import { trustedAdRulesFile } from '../../../support/fixtures/ad-rules.ts';
import { generatedOperationIdPattern } from '../../../support/fixtures/execution-context.ts';
import { completionRecordsIn } from '../../../support/drivers/operator-log.ts';
import { mcpProtocolEras, type McpProtocolEra } from '../../../support/drivers/mcp/mcp-protocol-eras.ts';
import { connectMcpClient } from '../../../support/drivers/mcp/mcp-sdk-client.ts';
import { RendererProcessDouble } from '../../../support/doubles/website-fetcher/renderer-process-double.ts';
import { createWorkSliceApplication } from './basic-mcp-url-fetch.ts';

const storyUrl = 'https://news.example/story';
const reason = 'Read the story for the work slice';
const rendererExecutable = '/opt/thermus-test/lightpanda';
// The page of test/acceptance/mcp/self-hosted-fetch-tool.test.ts.
const storyHtml = '<html><head><title>Story</title></head><body><main><h1>Rendered story</h1>'
  + '<p>The rendered article has a first paragraph with enough words to keep it.</p>'
  + '<p class="final-host-target">Final host target</p><p class="requested-host-target">Requested host target</p>'
  + '<p>Related <a href="related">article</a> and <a href="/root">root</a>.</p>'
  + '<div hidden>Hidden instruction payload</div></main></body></html>';
// The trusted rules remove the paragraph that news.example##.final-host-target selects.
const expectedMarkdown = '## Rendered story\n\nThe rendered article has a first paragraph with enough words to keep it.\n\n'
  + 'Requested host target\n\n'
  + 'Related [article](https://news.example/related) and [root](https://news.example/root).';
const environment = { PUBLIC_BASE_URL: 'http://127.0.0.1:8080', AD_RULES_FILE: trustedAdRulesFile, LIGHTPANDA_BIN: rendererExecutable };

interface RecordingLog extends ApplicationLogger {
  readonly lines: string[];
}

// url is the listener address, not the public base URL. Each close() call after the first gets the result of the first call.
interface StartedWorkSlice {
  readonly url: URL;
  close(): Promise<void>;
}

function recordingLog(): RecordingLog {
  const lines: string[] = [];
  return {
    lines,
    info: (message) => { lines.push(message); },
    error: (message) => { lines.push(`ERROR ${message}`); },
  };
}

async function startWorkSlice(t: TestContext, log: RecordingLog): Promise<StartedWorkSlice> {
  const application = createWorkSliceApplication(environment, log);
  await using untilListening = new AsyncDisposableStack();
  untilListening.defer(() => application.close());
  // Port 0 is safe: the request URLs and the token audience come from the public URLs, not from the listen port.
  const listener = await startHttpServer(application.handle, { listen: { host: '127.0.0.1', port: 0 }, publicBaseUrl: 'http://127.0.0.1:8080/', logger: log });
  untilListening.move();
  let closing: Promise<void> | undefined;
  // The production close order: listener.close() starts first, then the MCP work stops, and then the listener drains.
  const close = (): Promise<void> => (closing ??= application.close(listener.close()));
  t.after(close);
  return { url: listener.url, close };
}

async function connectedClient(t: TestContext, server: StartedWorkSlice, era: McpProtocolEra): Promise<Client> {
  const client = await connectMcpClient(t, new StreamableHTTPClientTransport(new URL('mcp', server.url), {
    authProvider: { token: async () => 'any-token' },
  }), { era, probe: true });
  t.after(() => client.close());
  return client;
}

function assertText(result: CallToolResult, text: string): void {
  assert.deepEqual(result.content, [{ type: 'text', text }]);
  assert.equal(result.isError === true, false);
  assert.equal(result.structuredContent, undefined);
}

function assertSuccessRecord(completion: Record<string, unknown>): void {
  const { durationMs, operationId, ...record } = completion;
  assert.equal(typeof durationMs, 'number');
  assert.match(operationId as string, generatedOperationIdPattern);
  assert.deepEqual(record, {
    event: 'mcp.tool.completed',
    authority: 'https://synthetic-auth.thermus.invalid',
    subject: 'synthetic-user',
    tenantId: 'synthetic-workspace',
    tool: 'getURLAsMarkdown',
    url: storyUrl,
    urlStatus: 'valid',
    reason,
    reasonStatus: 'valid',
    status: 'success',
  });
}

function mcpToolCall(): RequestInit {
  const call = { name: 'getURLAsMarkdown', arguments: { url: 'https://example.com/', reason: 'Read the page for this task' } };
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: call }),
  };
}

describe('The basic MCP URL fetch work slice with the mock provider and the production pipeline, offline', () => {
  for (const era of mcpProtocolEras) {
    test(`Given the work-slice application with the mock provider, the trusted ad rules, and a renderer double that serves ${storyUrl}, when an MCP client in ${era} with the token any-token lists the tools and calls getURLAsMarkdown with that URL and a reason, then the client gets the cleaned Markdown without the paragraph that the rules remove, the log has the started line, the completed line, and one completion record, and close() stops the application`, { timeout: 60_000 }, async (t) => {
      const renderer = RendererProcessDouble.install(t);
      renderer.serve(storyUrl, { finalUrl: storyUrl, html: storyHtml });
      const log = recordingLog();
      const server = await startWorkSlice(t, log);
      const client = await connectedClient(t, server, era);

      const listed = await client.listTools();
      const result = await client.callTool({ name: 'getURLAsMarkdown', arguments: { url: storyUrl, reason } });
      await client.close();
      await server.close();
      await server.close();

      assert.deepEqual(listed.tools.map(({ name, inputSchema }) => ({ name, inputSchema })), [{ name: 'getURLAsMarkdown', inputSchema: fetchToolInputSchema }, { name: 'search', inputSchema: searchToolInputSchema }]);
      assertText(result, expectedMarkdown);
      assert.deepEqual(log.lines.filter((line) => line.includes('work-slice fetch')), [
        `work-slice fetch started: ${storyUrl}`,
        `work-slice fetch completed: ${storyUrl} gave ${expectedMarkdown.length} characters of Markdown:\n${expectedMarkdown}`,
      ]);
      const records = completionRecordsIn(log.lines.join('\n'));
      assert.equal(records.length, 1);
      assertSuccessRecord(records[0]);
      assert.deepEqual(renderer.launches.map(({ executable }) => executable), [rendererExecutable]);
      await assert.rejects(fetch(server.url));
    });
  }

  test('Given the work-slice application, when a request has no Authorization header, then it gets 401 with a Bearer challenge, a request to another path gets 404, no renderer starts, and the log has no fetch line', { timeout: 60_000 }, async (t) => {
    const renderer = RendererProcessDouble.install(t);
    const log = recordingLog();
    const server = await startWorkSlice(t, log);

    const refused = await fetch(new URL('mcp', server.url), mcpToolCall());
    await refused.text();
    const other = await fetch(server.url);
    await other.text();
    await server.close();

    assert.equal(refused.status, 401);
    assert.match(refused.headers.get('WWW-Authenticate') ?? '', /^Bearer /);
    assert.equal(other.status, 404);
    assert.deepEqual(renderer.launches, []);
    assert.deepEqual(log.lines.filter((line) => line.includes('work-slice fetch')), []);
  });
});
