import type { TestContext } from 'node:test';
import { createMcpHandler, fromJsonSchema, McpServer, type CallToolResult } from '@modelcontextprotocol/server';
import { startHttpServer } from '../../../src/http/server.ts';

interface SearchSiteOptions {
  readonly result?: CallToolResult;
}

export async function serveSearchDebugSite(t: TestContext, options: SearchSiteOptions = {}) {
  const calls: { query: string; reason: string }[] = [];
  const requests: { authorization: string | null }[] = [];
  const handler = createMcpHandler(() => {
    const server = new McpServer({ name: 'thermus-search-test', version: '0.0.0' });
    server.registerTool('search', {
      inputSchema: fromJsonSchema<{ query: string; reason: string }>({
        type: 'object', properties: { query: { type: 'string' }, reason: { type: 'string' } },
        required: ['query', 'reason'], additionalProperties: false,
      }),
    }, async (args) => {
      calls.push(args);
      return options.result ?? { content: [{ type: 'text', text: '# Results\n\n[Browser](https://example.com/browser)\n' }] };
    });
    return server;
  });
  const listener = await startHttpServer(async (request) => {
    requests.push({ authorization: request.headers.get('authorization') });
    if (request.headers.get('authorization') !== 'Bearer test-search-token') return new Response('Credential refused', { status: 401 });
    return handler.fetch(request);
  }, { listen: { host: '127.0.0.1', port: 0 }, publicBaseUrl: 'http://127.0.0.1', shutdownGraceMs: 100 });
  t.after(async () => { await listener.close(); await handler.close(); });
  return { endpoint: new URL('mcp', listener.url).href, calls, requests };
}
