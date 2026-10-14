import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { composeApplication } from '../../../src/application.ts';
import { startHttpServer } from '../../../src/http/server.ts';
import { createFetchToolServer } from '../../../src/mcp/fetch-tool-server.ts';
import { createGetURLAsMarkdown } from '../../../src/mcp/get-url-as-markdown.ts';
import { MCPServer } from '../../../src/mcp/mcp-server.ts';
import { NoAuthProvider } from '../../support/auth/no-auth-provider.ts';
import { fetchProtocolEras, validFetchArguments } from '../../support/mcp-fetch-site.ts';

for (const era of fetchProtocolEras) {
  test(`Given active ${era} HTTP fetch work, when shutdown starts, then cancellation precedes listener drain and provider close waits for cleanup`, { timeout: 5_000 }, async (t) => {
    const resource = new URL('https://thermus.example/mcp');
    const provider = new NoAuthProvider(resource);
    const started = Promise.withResolvers<AbortSignal>();
    const cleanup = Promise.withResolvers<void>();
    const emergencyStop = new AbortController();
    const events: string[] = [];
    const records: string[] = [];
    let pipelineCalls = 0;
    let providerCloses = 0;
    const operation = createGetURLAsMarkdown({
      fetcher: { fetchURL: async (url, signal) => {
        assert.ok(signal);
        started.resolve(signal);
        await new Promise<void>((resolve) => AbortSignal.any([signal, emergencyStop.signal]).addEventListener('abort', () => {
          events.push('fetch cancelled');
          resolve();
        }, { once: true }));
        await cleanup.promise;
        events.push('fetch cleaned');
        return { requestedUrl: url, finalUrl: url, html: '<p>Late source</p>' };
      } },
      pipeline: { process: async (page) => {
        pipelineCalls += 1;
        return { ...page, markdown: 'Late success', removed: 0, skipped: 0 };
      } },
    });
    const server = new MCPServer({
      auth: { verifier: provider, accessResolver: provider, expectedResource: resource, resourceMetadataUrl: 'https://thermus.example/.well-known/oauth-protected-resource/mcp' },
      buildServer: (context, lifetime) => createFetchToolServer(context, { operation, logger: { info: (record) => records.push(record), error: (record) => records.push(record) } }, lifetime),
      reportFailure: () => {},
    });
    const providerResources = new AsyncDisposableStack();
    providerResources.defer(() => { providerCloses += 1; events.push('provider closed'); });
    const application = composeApplication((request) => server.fetch(request), server, providerResources);
    const listener = await startHttpServer((request) => application.handle(request), {
      listen: { host: '127.0.0.1', port: 0 }, publicBaseUrl: resource.href, shutdownGraceMs: 1_000,
    });
    const client = new Client({ name: 'shutdown-acceptance', version: '0.0.0' }, {
      versionNegotiation: { mode: era === '2026-07-28' ? { pin: era } : 'legacy' },
    });
    t.after(async () => {
      emergencyStop.abort();
      cleanup.resolve();
      await client.close();
      await application.close(listener.close());
    });
    const url = new URL('mcp', listener.url);
    await client.connect(new StreamableHTTPClientTransport(url, { authProvider: { token: async () => 'test-token' } }), { signal: t.signal, timeout: 5_000 });
    assert.equal(client.getNegotiatedProtocolVersion(), era);
    const response = client.callTool({ name: 'getURLAsMarkdown', arguments: validFetchArguments }).then((result) => result, () => undefined);
    const signal = await started.promise;

    const closed = application.close(listener.close());
    await setImmediate();
    assert.equal(signal.aborted, true, 'shutdown must cancel work before listener drain finishes');
    assert.equal(providerCloses, 0, 'the provider stays open while fetch cleanup is pending');
    await assert.rejects(fetch(url, { headers: { Connection: 'close' } }));
    cleanup.resolve();
    await closed;
    await client.close();
    await response;

    assert.equal(pipelineCalls, 0);
    assert.deepEqual(events, ['fetch cancelled', 'fetch cleaned', 'provider closed']);
    assert.equal(providerCloses, 1);
    assert.equal(records.length, 1);
    assert.equal(JSON.parse(records[0]).status, 'cancelled');
    assert.doesNotMatch(records[0], /Late source|Late success/);
    await Promise.all([application.close(), application.close(), server.close(), server.close(), listener.close(), listener.close()]);
  });
}
