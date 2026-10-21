import { executionContextOf } from '../../support/fixtures/execution-context.ts';
import { completionRecordsIn } from '../../support/drivers/operator-log.ts';
import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import { Client, InMemoryTransport, type CallToolResult } from '@modelcontextprotocol/client';
import type { Server } from '@modelcontextprotocol/server';
import { createRequestContext } from '../../../src/auth/access-context.ts';
import { createFetchToolServer } from '../../../src/mcp/fetch-tool-server.ts';
import { createGetURLAsMarkdown } from '../../../src/mcp/get-url-as-markdown.ts';
import { createFetchPage } from '../../../src/page-fetch/fetch-page.ts';
import { ObserveRequestStep } from '../../../src/page-fetch/observe-request-step.ts';
import type { RendererSetupFailure } from '../../../src/page-fetch/renderer-failure-reports.ts';
import { WebsiteFetchHttpError, WebsiteFetchLaunchError, WebsiteFetchReadinessTimeoutError, type WebsiteFetchResult } from '../../../src/website-fetcher/website-fetcher.ts';

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
    outgoing: new ObserveRequestStep(),
    records: { record: () => {} },
    fetcher: { fetchURL: t.mock.fn(async (_url: string, _signal?: AbortSignal): Promise<WebsiteFetchResult> => { throw fetchFailure; }) },
    incoming: { execute: t.mock.fn(async (_source: WebsiteFetchResult) => ({ decision: 'allow' as const, output: 'Unused' })) },
    reportRendererSetupFailure: t.mock.fn((_failure: RendererSetupFailure) => {}),
    reportRendererReadinessTimeout: t.mock.fn((_failure: { category: 'readiness_timeout'; budgetMs: 20_000 }) => {}),
  };
}

async function assertSafeFetchFailure(call: Promise<unknown>, message = 'Page fetch failed'): Promise<void> {
  await assert.rejects(call, (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.message, message);
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
  ['an HTTP 404 error', new WebsiteFetchHttpError(404), 'Page fetch failed: HTTP 404'],
  ['the readiness limit', new WebsiteFetchReadinessTimeoutError(), 'Page fetch failed: Renderer readiness timed out'],
  ['the process timeout', Object.assign(new Error('Command failed'), { code: null, killed: true, signal: 'SIGTERM' }), 'Page fetch failed'],
  ['an untyped readiness message', new Error('Lightpanda readiness limit exceeded after 20000 ms'), 'Page fetch failed'],
  ['a blocked destination', new Error('Fetch destination is not a public network address: 127.0.0.1'), 'Page fetch failed'],
] as const;

describe('Renderer setup reports of the neutral page fetch operation', () => {
  for (const error of [launchFailure('ENOENT'), new WebsiteFetchReadinessTimeoutError()]) {
    test(`Given an outgoing step that throws ${error.name}, when it fails before fetching, then it cannot forge a renderer diagnostic`, async (t) => {
      const dependencies = operationDoubles(t, undefined);
      t.mock.method(dependencies.outgoing, 'execute', async () => { throw error; });

      await assertSafeFetchFailure(createFetchPage(dependencies)(url, context, executionContextOf()));

      assert.equal(dependencies.fetcher.fetchURL.mock.callCount(), 0);
      assert.equal(dependencies.incoming.execute.mock.callCount(), 0);
      assert.equal(dependencies.reportRendererSetupFailure.mock.callCount(), 0);
      assert.equal(dependencies.reportRendererReadinessTimeout.mock.callCount(), 0);
    });
  }

  test('Given a readiness timeout whose cause holds request data and stderr, when the operation fetches, then it reports only the fixed category and budget and returns the safe fetch failure without processing partial HTML', async (t) => {
    const failure = new WebsiteFetchReadinessTimeoutError({ cause: Object.assign(new Error(`spawn /private/lightpanda fetch ${url}`), { stderr: 'Bearer private-token password=private-password' }) });
    const dependencies = operationDoubles(t, failure);

    await assertSafeFetchFailure(createFetchPage(dependencies)(url, context, executionContextOf()), 'Page fetch failed: Renderer readiness timed out');

    assert.deepEqual(dependencies.reportRendererReadinessTimeout.mock.calls.map(({ arguments: args }) => args), [[{ category: 'readiness_timeout', budgetMs: 20_000 }]]);
    assert.equal(dependencies.reportRendererSetupFailure.mock.callCount(), 0);
    assert.equal(dependencies.incoming.execute.mock.callCount(), 0);
  });

  test('Given a readiness timeout and a reporter that throws, when the operation fetches, then the caller still gets only the safe fetch failure', async (t) => {
    const dependencies = operationDoubles(t, new WebsiteFetchReadinessTimeoutError());
    dependencies.reportRendererReadinessTimeout.mock.mockImplementation(() => { throw new Error('private logging failure'); });

    await assertSafeFetchFailure(createFetchPage(dependencies)(url, context, executionContextOf()), 'Page fetch failed: Renderer readiness timed out');

    assert.equal(dependencies.reportRendererReadinessTimeout.mock.callCount(), 1);
  });

  test('Given a call that is cancelled when the readiness timeout rejects, when the operation handles the failure, then cancellation takes precedence and no timeout report is sent', async (t) => {
    const controller = new AbortController();
    const dependencies = operationDoubles(t, undefined);
    dependencies.fetcher.fetchURL.mock.mockImplementation(async () => {
      controller.abort();
      throw new WebsiteFetchReadinessTimeoutError();
    });

    await assert.rejects(createFetchPage(dependencies)(url, context, executionContextOf(controller.signal)), { name: 'AbortError', message: 'Request cancelled' });

    assert.equal(dependencies.reportRendererReadinessTimeout.mock.callCount(), 0);
    assert.equal(dependencies.reportRendererSetupFailure.mock.callCount(), 0);
  });

  for (const [code, failure] of [['ENOENT', 'missing'], ['EACCES', 'cannot-start']] as const) {
    test(`Given a renderer that cannot start with ${code}, when the operation fetches, then only the safe fetch error is returned and the operator reporter gets one report with only the failure class and code`, async (t) => {
      const dependencies = operationDoubles(t, launchFailure(code));

      await assertSafeFetchFailure(createFetchPage(dependencies)(url, context, executionContextOf()), 'Page fetch failed: Renderer could not start');

      assert.deepEqual(dependencies.reportRendererSetupFailure.mock.calls.map((call) => call.arguments), [[{ failure, code }]]);
      assert.equal(dependencies.incoming.execute.mock.callCount(), 0);
    });
  }

  for (const [name, fetchFailure, message] of otherFetchFailures) {
    test(`Given ${name}, when the operation fetches, then only the safe fetch error is returned and the operator reporter gets no report`, async (t) => {
      const dependencies = operationDoubles(t, fetchFailure);

      await assertSafeFetchFailure(createFetchPage(dependencies)(url, context, executionContextOf()), message);

      assert.equal(dependencies.reportRendererSetupFailure.mock.callCount(), 0);
      if (!(fetchFailure instanceof WebsiteFetchReadinessTimeoutError)) assert.equal(dependencies.reportRendererReadinessTimeout.mock.callCount(), 0);
    });
  }

  test('Given a renderer that cannot start and an operator reporter that throws, when the operation fetches, then the safe fetch error is still returned', async (t) => {
    const dependencies = operationDoubles(t, launchFailure('ENOENT'));
    dependencies.reportRendererSetupFailure.mock.mockImplementation(() => { throw new Error('private log failure'); });

    await assertSafeFetchFailure(createFetchPage(dependencies)(url, context, executionContextOf()), 'Page fetch failed: Renderer could not start');

    assert.equal(dependencies.reportRendererSetupFailure.mock.callCount(), 1);
  });

  test('Given a call that is cancelled when the renderer cannot start, when the fetch rejects, then the operation gives only the cancellation and no report', async (t) => {
    const controller = new AbortController();
    const dependencies = operationDoubles(t, launchFailure('ENOENT'));
    dependencies.fetcher.fetchURL.mock.mockImplementation(async () => {
      controller.abort();
      throw launchFailure('ENOENT');
    });

    await assert.rejects(createFetchPage(dependencies)(url, context, executionContextOf(controller.signal)), { name: 'AbortError', message: 'Request cancelled' });

    assert.equal(dependencies.reportRendererSetupFailure.mock.callCount(), 0);
  });

  test('Given a renderer that cannot start, a page with an HTTP error, and a readiness timeout, when an SDK client calls the fetch tool for each, then each call gets a safe fetch diagnosis and fetch_failed record, with separate safe launch and timeout reports', async (t) => {
    const failures = [launchFailure('ENOENT'), new WebsiteFetchHttpError(404), new WebsiteFetchReadinessTimeoutError()];
    const dependencies = operationDoubles(t, undefined);
    dependencies.fetcher.fetchURL.mock.mockImplementation(async () => { throw failures.shift(); });
    const lines = { info: [] as string[], error: [] as string[] };
    const server = createFetchToolServer(context, {
      operations: { fetch: createGetURLAsMarkdown(createFetchPage(dependencies)), search: async () => ({ status: 'released', markdown: 'test search' }) },
      logger: { info: (line) => lines.info.push(line), error: (line) => lines.error.push(line) },
    });
    const client = await connectedClient(t, server);

    const results: CallToolResult[] = [];
    for (let call = 0; call < 3; call += 1) results.push(await client.callTool({ name: 'getURLAsMarkdown', arguments: { url, reason } }) as CallToolResult);

    assert.deepEqual(results, ['Renderer could not start', 'HTTP 404', 'Renderer readiness timed out'].map((detail) => ({ content: [{ type: 'text', text: `Page fetch failed: ${detail}` }], isError: true })));
    const completions = completionRecordsIn(lines.info.join('\n'));
    assert.equal(new Set(completions.map(({ operationId }) => operationId)).size, 3);
    const records = completions.map(({ durationMs: _durationMs, operationId: _operationId, ...record }) => {
      return record;
    });
    assert.equal(records.length, 3);
    assert.deepEqual(records[0], records[1]);
    assert.deepEqual(records[1], records[2]);
    assert.equal(records[0]?.status, 'fetch_failed');
    assert.doesNotMatch(lines.info.join('\n'), /private|Lightpanda|ENOENT|HTTP/);
    assert.deepEqual(dependencies.reportRendererSetupFailure.mock.calls.map((call) => call.arguments), [[{ failure: 'missing', code: 'ENOENT' }]]);
    assert.deepEqual(dependencies.reportRendererReadinessTimeout.mock.calls.map((call) => call.arguments), [[{ category: 'readiness_timeout', budgetMs: 20_000 }]]);
    assert.deepEqual(lines.error, []);
  });
});
