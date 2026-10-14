import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Client, SdkHttpError, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler, ProtocolError, ProtocolErrorCode, Server } from '@modelcontextprotocol/server';
import { startHttpServer } from '../../../src/http/server.ts';

for (const era of ['2026-07-28', '2025-11-25'] as const) {
  test(`Given public low-level SDK handlers in ${era}, when an HTTP client lists and calls tools, then the SDK owns envelopes, result projection, and body refusals`, async (t) => {
    const dispatched: unknown[] = [];
    const inputSchema = { type: 'object' as const, properties: { value: { type: 'string' } }, required: ['value'], additionalProperties: false };
    const handler = createMcpHandler(() => {
      const server = new Server({ name: 'sdk-characterization', version: '0.0.0' }, { capabilities: { tools: {} } });
      server.setRequestHandler('tools/list', () => ({ tools: [{ name: 'probe', inputSchema }] }));
      server.setRequestHandler('tools/call', (request, context) => {
        dispatched.push(request.params);
        assert.ok(context.mcpReq.signal instanceof AbortSignal);
        if (request.params.name !== 'probe') throw new ProtocolError(ProtocolErrorCode.InvalidParams, 'Unknown tool');
        const result = { content: [{ type: 'text' as const, text: '# Unchanged\n' }] };
        return server.projectCallToolResult(result, undefined);
      });
      return server;
    });
    const listener = await startHttpServer((request) => handler.fetch(request), { listen: { host: '127.0.0.1', port: 0 }, publicBaseUrl: 'http://localhost' });
    const client = new Client({ name: 'sdk-characterization', version: '0.0.0' }, {
      versionNegotiation: { mode: era === '2026-07-28' ? { pin: era } : 'legacy', probe: { timeoutMs: 5_000, maxRetries: 0 } },
    });
    t.after(async () => { await client.close(); await listener.close(); await handler.close(); });
    const url = new URL('mcp', listener.url);
    await client.connect(new StreamableHTTPClientTransport(url), { signal: t.signal, timeout: 5_000 });

    assert.equal(client.getNegotiatedProtocolVersion(), era);
    assert.ok(client.getServerCapabilities()?.tools);
    assert.deepEqual((await client.listTools()).tools, [{ name: 'probe', inputSchema }]);
    assert.deepEqual((await client.callTool({ name: 'probe', arguments: { value: 'input' } })).content, [{ type: 'text', text: '# Unchanged\n' }]);
    await assert.rejects(client.callTool({ name: 'secret-unknown-tool', arguments: {} }), (error) => {
      assert.ok(error instanceof ProtocolError);
      assert.equal(error.code, -32602);
      assert.doesNotMatch(error.message, /secret-unknown-tool/);
      return true;
    });
    assert.equal(dispatched.length, 2);
    await assert.rejects(client.callTool({ name: 'probe', arguments: { value: 'x'.repeat(4 * 1024 * 1024) } }), (error) => error instanceof SdkHttpError && error.status === 413);
    assert.equal(dispatched.length, 2);
    const malformed = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': era }, body: '{bad-json' });
    assert.equal(malformed.status, 400);
    await malformed.text();
    assert.equal(dispatched.length, 2);
  });
}
