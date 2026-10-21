import type { TestContext } from 'node:test';
import { createMcpHandler, fromJsonSchema, McpServer, type CallToolResult } from '@modelcontextprotocol/server';
import { startHttpServer } from '../../../src/http/server.ts';

interface SearchSiteOptions {
  readonly result?: CallToolResult;
  readonly responseMode?: 'json' | 'sse';
  readonly legacy?: boolean;
  readonly hang?: 'server/discover' | 'tools/call';
  readonly status?: number;
  readonly redirect?: string;
}

export async function serveSearchDebugSite(t: TestContext, options: SearchSiteOptions = {}) {
  const calls: { query: string; reason: string }[] = [];
  const requests: { method?: string; authorization: string | null; version: string | null }[] = [];
  let aborted = 0;
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
  }, { responseMode: options.responseMode ?? 'auto' });
  const listener = await startHttpServer(async (request) => {
    const body = request.method === 'POST' ? await request.clone().json() as { method?: string; id?: string | number } : {};
    requests.push({ method: body.method, authorization: request.headers.get('authorization'), version: request.headers.get('mcp-protocol-version') });
    if (options.redirect) return new Response(null, { status: 307, headers: { location: options.redirect } });
    if (options.status) return new Response('private-remote-token', { status: options.status });
    if (request.headers.get('authorization') !== 'Bearer test-search-token') return new Response('Credential refused', { status: 401 });
    if (options.legacy && body.method === 'server/discover') return Response.json({ jsonrpc: '2.0', id: body.id, error: { code: -32601, message: 'Method not found' } });
    if (options.hang && body.method === options.hang) {
      await new Promise<void>((resolve) => request.signal.addEventListener('abort', () => { aborted += 1; resolve(); }, { once: true }));
      return new Response(null, { status: 499 });
    }
    return handler.fetch(request);
  }, { listen: { host: '127.0.0.1', port: 0 }, publicBaseUrl: 'http://127.0.0.1', shutdownGraceMs: 100 });
  t.after(async () => { await listener.close(); await handler.close(); });
  return { endpoint: new URL('mcp', listener.url).href, calls, requests, aborted: () => aborted };
}
