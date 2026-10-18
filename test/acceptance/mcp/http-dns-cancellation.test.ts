import { completionRecordsIn } from '../../support/drivers/operator-log.ts';
import assert from 'node:assert/strict';
import dns from 'node:dns/promises';
import { getEventListeners } from 'node:events';
import { setTimeout } from 'node:timers/promises';
import { test } from 'node:test';
import { StreamableHTTPClientTransport, type Client } from '@modelcontextprotocol/client';
import { composeApplication } from '../../../src/application.ts';
import { startHttpServer } from '../../../src/http/server.ts';
import { createFetchToolServer } from '../../../src/mcp/fetch-tool-server.ts';
import { composeFetchOperation } from '../../support/in-process/fetch-operation.ts';
import { MCPServer } from '../../../src/mcp/mcp-server.ts';
import { WebsiteFetcherLightpanda } from '../../../src/website-fetcher/website-fetcher-lightpanda.ts';
import { NoAuthProvider } from '../../support/doubles/auth/no-auth-provider.ts';
import { controlledRenderer } from '../../support/doubles/website-fetcher/renderer-process-double.ts';
import { mcpProtocolEras } from '../../support/drivers/mcp/mcp-protocol-eras.ts';
import { connectMcpClient } from '../../support/drivers/mcp/mcp-sdk-client.ts';
import { openFetchSite, validFetchArguments } from '../../support/in-process/mcp-fetch-site.ts';

for (const era of mcpProtocolEras) {
  test(`Given DNS does not answer through ${era} HTTP, when the client cancels, then the call completes as cancelled before DNS answers and no renderer starts`, { timeout: 5_000 }, async (t) => {
    const cancelled = new AbortController();
    const site = await openFetchSite(t, era, {
      httpSignal: era === '2025-11-25' ? cancelled.signal : undefined,
      fetcher: new WebsiteFetcherLightpanda(),
    });
    const renderer = controlledRenderer(t);
    const started = Promise.withResolvers<void>();
    const answer = Promise.withResolvers<Array<{ address: string; family: number }>>();
    t.mock.method(dns, 'lookup', () => {
      started.resolve();
      return answer.promise;
    });
    const pending = site.client.callTool({ name: 'getURLAsMarkdown', arguments: validFetchArguments }, { signal: cancelled.signal });
    const rejected = assert.rejects(pending);
    await started.promise;
    cancelled.abort(new Error('private-client-cancel-cause'));
    await rejected;

    let completedBeforeDns;
    try {
      completedBeforeDns = await Promise.race([
        site.firstCompletion.then(() => true),
        setTimeout(500, false),
      ]);
    } finally {
      answer.resolve([{ address: '93.184.216.34', family: 4 }]);
    }
    assert.equal(completedBeforeDns, true, 'Cancellation must settle the fetch while DNS is still pending');
    assert.equal(JSON.parse(await site.firstCompletion).status, 'cancelled');
    assert.equal(renderer.execute.mock.callCount(), 0);
    assert.equal(site.pipelineCalls.length, 0);
    const signal = site.fetchCalls[0]?.signal;
    assert.ok(signal);
    assert.equal(getEventListeners(signal, 'abort').length, 0);
    assert.doesNotMatch(site.records.join('\n'), /private-client-cancel-cause/);
  });

  test(`Given DNS does not answer through ${era} HTTP, when application shutdown starts, then cancellation and provider closure finish before DNS answers without starting a renderer`, { timeout: 5_000 }, async (t) => {
    const resource = new URL('https://thermus.example/mcp');
    const provider = new NoAuthProvider(resource);
    const renderer = controlledRenderer(t);
    const started = Promise.withResolvers<void>();
    const answer = Promise.withResolvers<Array<{ address: string; family: number }>>();
    t.mock.method(dns, 'lookup', () => {
      started.resolve();
      return answer.promise;
    });
    const records: string[] = [];
    const events: string[] = [];
    let callSignal: AbortSignal | undefined;
    let pipelineCalls = 0;
    const fetcher = new WebsiteFetcherLightpanda();
    const operation = composeFetchOperation({
      fetcher: { fetchURL: (url, signal) => {
        callSignal = signal;
        return fetcher.fetchURL(url, signal);
      } },
      pipeline: { process: async (page) => {
        pipelineCalls += 1;
        return { ...page, removed: 0, skipped: 0, markdown: 'Late success' };
      } },
    });
    const server = new MCPServer({
      auth: { verifier: provider, accessResolver: provider, expectedResource: resource, resourceMetadataUrl: 'https://thermus.example/metadata' },
      buildServer: (context, lifetime) => createFetchToolServer(context, {
        operation, logger: { info: (entry) => records.push(entry), error: (entry) => records.push(entry) },
      }, lifetime),
      reportFailure: () => {},
    });
    const providers = new AsyncDisposableStack();
    providers.defer(() => { events.push('provider closed'); });
    const application = composeApplication((request) => server.fetch(request), server, providers);
    const listener = await startHttpServer(application.handle, { listen: { host: '127.0.0.1', port: 0 }, publicBaseUrl: resource.href });
    let client: Client | undefined = undefined;
    t.after(async () => {
      answer.resolve([{ address: '93.184.216.34', family: 4 }]);
      await client?.close();
      await application.close(listener.close());
    });
    client = await connectMcpClient(t, new StreamableHTTPClientTransport(new URL('mcp', listener.url), { authProvider: { token: async () => 'test-token' } }), { era, checkEra: false });
    const response = client.callTool({ name: 'getURLAsMarkdown', arguments: validFetchArguments }).then((result) => result, () => undefined);
    await started.promise;
    const closing = application.close(listener.close());
    try {
      assert.equal(await Promise.race([closing.then(() => true), setTimeout(500, false)]), true,
        'Shutdown must close the application while DNS is still pending');
      assert.deepEqual(events, ['provider closed']);
      assert.equal(completionRecordsIn(records.join('\n')).length, 1);
      assert.equal(completionRecordsIn(records.join('\n'))[0].status, 'cancelled');
      assert.ok(callSignal);
      assert.equal(callSignal.aborted, true);
      assert.equal(getEventListeners(callSignal, 'abort').length, 0);
    } finally {
      answer.reject(new Error('private-late-DNS-failure'));
    }
    await closing;
    await client.close();
    await response;
    assert.equal(renderer.execute.mock.callCount(), 0);
    assert.equal(pipelineCalls, 0);
    assert.doesNotMatch(records.join('\n'), /private-late-DNS-failure|Late success/);
  });
}
