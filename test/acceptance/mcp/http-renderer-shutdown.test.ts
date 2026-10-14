import assert from 'node:assert/strict';
import childProcess, { ChildProcess, type ExecFileException } from 'node:child_process';
import dns from 'node:dns/promises';
import { getEventListeners } from 'node:events';
import { syncBuiltinESMExports } from 'node:module';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { composeApplication } from '../../../src/application.ts';
import { startHttpServer } from '../../../src/http/server.ts';
import { createFetchToolServer } from '../../../src/mcp/fetch-tool-server.ts';
import { createGetURLAsMarkdown } from '../../../src/mcp/get-url-as-markdown.ts';
import { MCPServer } from '../../../src/mcp/mcp-server.ts';
import { WebsiteFetcherLightpanda } from '../../../src/website-fetcher/website-fetcher-lightpanda.ts';
import { NoAuthProvider } from '../../support/auth/no-auth-provider.ts';
import { validFetchArguments } from '../../support/mcp-fetch-site.ts';
import { eraNegotiation, mcpProtocolEras } from '../../support/mcp-protocol-eras.ts';

type ProcessCompletion = (error: ExecFileException | null, stdout: string, stderr: string) => void;

for (const era of mcpProtocolEras) {
  test(`Given a running renderer through ${era} HTTP, when shutdown starts, then its child, timer, and abort listener close once before provider release`, { timeout: 5_000 }, async (t) => {
    const resource = new URL('https://thermus.example/mcp');
    const provider = new NoAuthProvider(resource);
    const launched = Promise.withResolvers<ProcessCompletion>();
    const child = new ChildProcess();
    const kill = t.mock.method(child, 'kill', () => true);
    t.mock.method(dns, 'lookup', async () => [{ address: '93.184.216.34', family: 4 }]);
    t.mock.method(childProcess, 'execFile', ((...args: Parameters<typeof childProcess.execFile>) => {
      launched.resolve(args[3] as ProcessCompletion);
      return child;
    }) as typeof childProcess.execFile);
    syncBuiltinESMExports();
    t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });

    const fetcher = new WebsiteFetcherLightpanda();
    const signals: AbortSignal[] = [];
    const events: string[] = [];
    const records: string[] = [];
    let pipelineCalls = 0;
    const operation = createGetURLAsMarkdown({
      fetcher: { fetchURL: (url, signal) => {
        assert.ok(signal);
        signals.push(signal);
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
    const client = new Client({ name: 'renderer-shutdown-acceptance', version: '0.0.0' }, {
      versionNegotiation: eraNegotiation(era),
    });
    let finish: ProcessCompletion | undefined;
    t.after(async () => {
      finish?.(new Error('Test cleanup'), '', '');
      finish = undefined;
      await client.close();
      await application.close(listener.close());
    });
    await client.connect(new StreamableHTTPClientTransport(new URL('mcp', listener.url), { authProvider: { token: async () => 'test-token' } }), { signal: t.signal, timeout: 5_000 });
    assert.equal(client.getNegotiatedProtocolVersion(), era);
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const scheduled = t.mock.method(globalThis, 'setTimeout');
    const cleared = t.mock.method(globalThis, 'clearTimeout');
    const response = client.callTool({ name: 'getURLAsMarkdown', arguments: validFetchArguments }).then((result) => result, () => undefined);
    finish = await launched.promise;
    const [signal] = signals;
    assert.ok(signal);
    assert.equal(getEventListeners(signal, 'abort').length, 1);
    const removeListener = t.mock.method(signal, 'removeEventListener');
    const readinessTimers = scheduled.mock.calls.filter(({ arguments: args }) => args[1] === 5_000);
    assert.equal(readinessTimers.length, 1);
    const readinessTimer = readinessTimers[0]?.result;
    assert.ok(readinessTimer);

    const closing = application.close(listener.close());
    assert.equal(signal.aborted, true);
    assert.equal(kill.mock.callCount(), 1);
    assert.deepEqual(kill.mock.calls[0]?.arguments, ['SIGKILL']);
    assert.equal(getEventListeners(signal, 'abort').length, 0);
    assert.equal(removeListener.mock.callCount(), 1);
    assert.equal(cleared.mock.calls.filter(({ arguments: args }) => args[0] === readinessTimer).length, 1);
    await setImmediate();
    assert.equal(events.length, 0);
    assert.equal(records.length, 0);
    t.mock.timers.tick(60_000);
    assert.equal(kill.mock.callCount(), 1);
    events.push('renderer reaped');
    const lateSuccess = JSON.stringify({ url: 'https://example.com/final', http_status: 200, content: '<p>Late source</p>', error: null });
    finish(null, lateSuccess, '');
    await closing;
    await client.close();
    await response;
    finish(null, lateSuccess, '');
    await Promise.all([application.close(), application.close()]);
    t.mock.timers.tick(60_000);

    assert.equal(kill.mock.callCount(), 1);
    assert.equal(removeListener.mock.callCount(), 1);
    assert.equal(cleared.mock.calls.filter(({ arguments: args }) => args[0] === readinessTimer).length, 1);
    assert.equal(getEventListeners(signal, 'abort').length, 0);
    assert.equal(pipelineCalls, 0);
    assert.deepEqual(events, ['renderer reaped', 'provider closed']);
    assert.equal(records.length, 1);
    assert.equal(JSON.parse(records[0]).status, 'cancelled');
    assert.doesNotMatch(records[0], /Late source|Late success/);
  });
}
