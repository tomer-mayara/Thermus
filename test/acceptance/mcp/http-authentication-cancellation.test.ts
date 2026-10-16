import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import { MCPServer } from '../../../src/mcp/mcp-server.ts';
import { startHttpServer } from '../../../src/http/server.ts';
import { NoAuthProvider } from '../../support/doubles/auth/no-auth-provider.ts';

for (const stage of ['verification', 'access'] as const) {
  for (const stop of ['disconnect', 'shutdown'] as const) {
    test(`Given an MCP request waiting for ${stage}, when ${stop} occurs, then the request stops before identity work settles and no tool server starts later`, { timeout: 3_000 }, async (t) => {
      const resource = new URL('https://thermus.example/mcp');
      const provider = new NoAuthProvider(resource);
      const entered = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      let accesses = 0;
      let builds = 0;
      const server = new MCPServer({
        auth: {
          verifier: { verifyAccessToken: async (token) => {
            if (stage === 'verification') { entered.resolve(); await release.promise; }
            return provider.verifyAccessToken(token);
          } },
          accessResolver: { resolve: async (user) => {
            accesses += 1;
            if (stage === 'access') { entered.resolve(); await release.promise; }
            return provider.resolve(user);
          } },
          expectedResource: resource, resourceMetadataUrl: 'https://thermus.example/metadata',
        },
        buildServer: () => { builds += 1; throw new Error('Cancelled work must not dispatch'); },
        reportFailure: () => {},
      });
      const handled = Promise.withResolvers<void>();
      const listener = await startHttpServer(async (request) => {
        try { return await server.fetch(request); } finally { handled.resolve(); }
      }, { listen: { host: '127.0.0.1', port: 0 }, publicBaseUrl: resource.href });
      const client = new AbortController();
      const request = fetch(new URL('/mcp', listener.url), {
        method: 'POST', headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }), signal: client.signal,
      }).catch(() => undefined);
      t.after(async () => { release.resolve(); client.abort(); await request; await server.close(); await listener.close(); });
      await entered.promise;

      if (stop === 'disconnect') client.abort();
      const closing = stop === 'shutdown' ? server.close() : undefined;
      const finished = await Promise.race([handled.promise.then(() => true), delay(500).then(() => false)]);
      assert.equal(finished, true, 'The request must stop while its identity call is still pending');
      if (closing !== undefined) await closing;
      release.resolve();
      await delay(20);

      assert.equal(accesses, stage === 'access' ? 1 : 0);
      assert.equal(builds, 0);
    });
  }
}
