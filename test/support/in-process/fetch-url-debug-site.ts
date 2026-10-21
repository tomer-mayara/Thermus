import type { TestContext } from 'node:test';
import { createMcpHandler, fromJsonSchema, McpServer, type CallToolResult } from '@modelcontextprotocol/server';
import { startHttpServer } from '../../../src/http/server.ts';

export interface DebugSiteOptions {
  readonly credential?: string;
  readonly result?: CallToolResult;
  readonly responseMode?: 'json' | 'sse';
  readonly hang?: 'server/discover' | 'initialize' | 'tools/call';
  readonly legacy?: boolean;
  readonly malformed?: boolean;
  readonly status?: number;
  readonly redirect?: string;
}

export async function serveFetchUrlDebugSite(t: TestContext, options: DebugSiteOptions = {}) {
  const calls: { url: string; reason: string }[] = [];
  const requests: { method?: string; authorization: string | null; version: string | null }[] = [];
  const abortObserved = Promise.withResolvers<void>();
  let aborted = 0;
  const pendingSignals = new Set<AbortSignal>();
  const handler = createMcpHandler(() => {
    const server = new McpServer({ name: 'thermus-debug-test', version: '0.0.0' });
    server.registerTool('getURLAsMarkdown', {
      inputSchema: fromJsonSchema<{ url: string; reason: string }>({
        type: 'object', properties: { url: { type: 'string' }, reason: { type: 'string' } },
        required: ['url', 'reason'], additionalProperties: false,
      }),
    }, async (args) => {
      calls.push(args);
      return options.result ?? { content: [{ type: 'text', text: '# Page\n\nExact Markdown.\n' }] };
    });
    return server;
  }, { responseMode: options.responseMode ?? 'auto' });
  const expectedAuthorization = `Bearer ${options.credential ?? 'test-debug-token'}`;
  const listener = await startHttpServer(async (request) => {
    const body = request.method === 'POST' ? await request.clone().json() as { method?: string; id?: string | number } : {};
    requests.push({ method: body.method, authorization: request.headers.get('authorization'), version: request.headers.get('mcp-protocol-version') });
    if (options.redirect !== undefined) return new Response(null, { status: 307, headers: { location: options.redirect } });
    if (options.status !== undefined) return new Response(`Remote error: ${options.credential}`, { status: options.status });
    if (request.headers.get('authorization') !== expectedAuthorization) {
      return new Response('Credential refused', { status: 401 });
    }
    if (options.legacy && body.method === 'server/discover') return Response.json({ jsonrpc: '2.0', id: body.id, error: { code: -32601, message: 'Method not found' } });
    if (options.malformed) return new Response('not-json', { headers: { 'content-type': 'application/json' } });
    if (options.hang !== undefined && body.method === options.hang) {
      return holdUntilAborted(request.signal, pendingSignals, () => { aborted += 1; abortObserved.resolve(); });
    }
    return handler.fetch(request);
  }, { listen: { host: '127.0.0.1', port: 0 }, publicBaseUrl: 'http://127.0.0.1', shutdownGraceMs: 100 });
  t.after(async () => { await listener.close(); pendingSignals.clear(); await handler.close(); });
  return { endpoint: new URL('mcp', listener.url).href, calls, requests, abortObserved: abortObserved.promise, aborted: () => aborted };
}

// A hung request ends only when its signal aborts. The site owns the pending signal until then, so a late abort
// still counts exactly once and the listener does not outlive the request.
async function holdUntilAborted(signal: AbortSignal, pending: Set<AbortSignal>, onAbort: () => void): Promise<Response> {
  pending.add(signal);
  const abort = Promise.withResolvers<void>();
  const listener = () => { onAbort(); abort.resolve(); };
  try {
    if (signal.aborted) listener();
    else signal.addEventListener('abort', listener, { once: true });
    await abort.promise;
  } finally {
    signal.removeEventListener('abort', listener);
    pending.delete(signal);
  }
  return new Response(null, { status: 499 });
}
