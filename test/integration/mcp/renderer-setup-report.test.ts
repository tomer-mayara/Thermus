import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import { Client, InMemoryTransport, type CallToolResult } from '@modelcontextprotocol/client';
import type { Server } from '@modelcontextprotocol/server';
import { createRequestContext } from '../../../src/auth/access-context.ts';
import type { Ctx } from '../../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';
import { createFetchToolServer } from '../../../src/mcp/fetch-tool-server.ts';
import { createGetURLAsMarkdown, type RendererSetupFailure } from '../../../src/mcp/get-url-as-markdown.ts';
import { WebsiteFetchHttpError, WebsiteFetchLaunchError, type WebsiteFetchResult } from '../../../src/website-fetcher/website-fetcher.ts';

const url = 'https://source.example/article?private-query=secret#private-fragment';
const reason = 'Read the article for the task';
const context = createRequestContext({
  user: { authority: 'https://synthetic.example/', subject: 'synthetic-user' },
  tenantId: 'synthetic-workspace',
  grants: [{ role: 'reader', permissions: ['product:access'] }],
});

function launchFailure(code: string): WebsiteFetchLaunchError {
  return new WebsiteFetchLaunchError(code, 'Lightpanda executable "/private/lightpanda" could not start.', {
    cause: new Error(`spawn /private/lightpanda ${code} fetch ${url}`),
  });
}

function operationDoubles(t: TestContext, fetchFailure: unknown) {
  return {
    fetcher: { fetchURL: t.mock.fn(async (_url: string, _signal?: AbortSignal): Promise<WebsiteFetchResult> => { throw fetchFailure; }) },
    pipeline: { process: t.mock.fn(async (source: WebsiteFetchResult): Promise<Ctx> => ({ ...source, removed: 0, skipped: 0, markdown: 'Unused' })) },
    reportRendererSetupFailure: t.mock.fn((_failure: RendererSetupFailure) => {}),
  };
}

async function assertSafeFetchFailure(call: Promise<string>): Promise<void> {
  await assert.rejects(call, (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.message, 'Page fetch failed');
    assert.equal(error.cause, undefined);
    return true;
  });
}

async function connectedClient(t: TestContext, server: Server): Promise<Client> {
  const client = new Client({ name: 'renderer-setup-report', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  t.after(async () => { await client.close(); await server.close(); });
  await server.connect(serverTransport);
  await client.connect(clientTransport, { signal: t.signal });
  return client;
}

const otherFetchFailures = [
  ['an HTTP 404 error', new WebsiteFetchHttpError(404)],
  ['the readiness limit', new Error('Lightpanda readiness limit exceeded after 5000 ms')],
  ['the process timeout', Object.assign(new Error('Command failed'), { code: null, killed: true, signal: 'SIGTERM' })],
  ['a blocked destination', new Error('Fetch destination is not a public network address: 127.0.0.1')],
] as const;

describe('Renderer setup reports of the getURLAsMarkdown operation', () => {
  for (const [code, failure] of [['ENOENT', 'missing'], ['EACCES', 'cannot-start']] as const) {
    test(`Given a renderer that cannot start with ${code}, when the operation fetches, then only the safe fetch error is returned and the operator reporter gets one report with only the failure class and code`, async (t) => {
      const dependencies = operationDoubles(t, launchFailure(code));

      await assertSafeFetchFailure(createGetURLAsMarkdown(dependencies)(url, context, new AbortController().signal));

      assert.deepEqual(dependencies.reportRendererSetupFailure.mock.calls.map((call) => call.arguments), [[{ failure, code }]]);
      assert.equal(dependencies.pipeline.process.mock.callCount(), 0);
    });
  }

  for (const [name, fetchFailure] of otherFetchFailures) {
    test(`Given ${name}, when the operation fetches, then only the safe fetch error is returned and the operator reporter gets no report`, async (t) => {
      const dependencies = operationDoubles(t, fetchFailure);

      await assertSafeFetchFailure(createGetURLAsMarkdown(dependencies)(url, context, new AbortController().signal));

      assert.equal(dependencies.reportRendererSetupFailure.mock.callCount(), 0);
    });
  }

  test('Given a renderer that cannot start and an operator reporter that throws, when the operation fetches, then the safe fetch error is still returned', async (t) => {
    const dependencies = operationDoubles(t, launchFailure('ENOENT'));
    dependencies.reportRendererSetupFailure.mock.mockImplementation(() => { throw new Error('private log failure'); });

    await assertSafeFetchFailure(createGetURLAsMarkdown(dependencies)(url, context, new AbortController().signal));

    assert.equal(dependencies.reportRendererSetupFailure.mock.callCount(), 1);
  });

  test('Given a call that is cancelled when the renderer cannot start, when the fetch rejects, then the operation gives only the cancellation and no report', async (t) => {
    const controller = new AbortController();
    const dependencies = operationDoubles(t, launchFailure('ENOENT'));
    dependencies.fetcher.fetchURL.mock.mockImplementation(async () => {
      controller.abort();
      throw launchFailure('ENOENT');
    });

    await assert.rejects(createGetURLAsMarkdown(dependencies)(url, context, controller.signal), { name: 'AbortError', message: 'Request cancelled' });

    assert.equal(dependencies.reportRendererSetupFailure.mock.callCount(), 0);
  });

  test('Given a renderer that cannot start and then a page with an HTTP error, when an SDK client calls the fetch tool for each, then both calls get the same fixed fetch failure and the same fetch_failed record, and only the launch failure gives one report', async (t) => {
    const failures = [launchFailure('ENOENT'), new WebsiteFetchHttpError(404)];
    const dependencies = operationDoubles(t, undefined);
    dependencies.fetcher.fetchURL.mock.mockImplementation(async () => { throw failures.shift(); });
    const lines = { info: [] as string[], error: [] as string[] };
    const server = createFetchToolServer(context, {
      operation: createGetURLAsMarkdown(dependencies),
      logger: { info: (line) => lines.info.push(line), error: (line) => lines.error.push(line) },
    });
    const client = await connectedClient(t, server);

    const results: CallToolResult[] = [];
    for (let call = 0; call < 2; call += 1) results.push(await client.callTool({ name: 'getURLAsMarkdown', arguments: { url, reason } }) as CallToolResult);

    assert.deepEqual(results, [1, 2].map(() => ({ content: [{ type: 'text', text: 'Page fetch failed' }], isError: true })));
    const records = lines.info.map((line) => {
      const { durationMs: _durationMs, ...record } = JSON.parse(line) as Record<string, unknown>;
      return record;
    });
    assert.equal(records.length, 2);
    assert.deepEqual(records[0], records[1]);
    assert.equal(records[0]?.status, 'fetch_failed');
    assert.doesNotMatch(lines.info.join('\n'), /private|Lightpanda|ENOENT|HTTP/);
    assert.deepEqual(dependencies.reportRendererSetupFailure.mock.calls.map((call) => call.arguments), [[{ failure: 'missing', code: 'ENOENT' }]]);
    assert.deepEqual(lines.error, []);
  });
});
