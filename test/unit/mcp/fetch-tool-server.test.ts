import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { ProtocolError } from '@modelcontextprotocol/server';
import type { RequestContext } from '../../../src/accounts/identity/access-context.ts';
import { createFetchToolServer, type ToolOperations } from '../../../src/interfaces/mcp/fetch-tool-server.ts';
import type { McpRequestLifetime } from '../../../src/interfaces/mcp/mcp-server.ts';
import type { ToolCompletion } from '../../../src/logs/audit/audit-log.ts';

const context: RequestContext = {
  user: { authority: 'trusted-authority', subject: 'trusted-subject', name: 'Trusted Name' }, tenantId: 'trusted-workspace', grants: [], permissions: ['product:access'],
};
const fetchArgs = { url: 'https://example.com/page', reason: 'Read for the task' };
const searchArgs = { query: 'exact query', reason: 'Search for the task' };

async function connect(t: TestContext, options: { operations?: Partial<ToolOperations>; audited?: boolean; lifetime?: McpRequestLifetime } = {}) {
  const completions: ToolCompletion[] = [];
  const records: Record<string, unknown>[] = [];
  const server = createFetchToolServer(context, {
    operations: { fetch: async () => '# Exact\n', search: async () => ({ status: 'released', markdown: 'Exact search' }), ...options.operations },
    logger: { info: (entry) => { records.push(JSON.parse(String(entry))); }, error: () => {} },
    ...(options.audited === false ? {} : { audit: { toolCompleted: (completion: ToolCompletion) => { completions.push(completion); } } }),
  }, options.lifetime);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'fetch-tool-server-unit', version: '0.0.0' });
  await client.connect(clientTransport);
  t.after(async () => { await client.close(); await server.close(); });
  return { client, completions, records };
}

test('Given validated input, when each tool answers, then one customer completion carries the input, the public text, and the named actor', async (t) => {
  const site = await connect(t);
  assert.deepEqual(await site.client.callTool({ name: 'getURLAsMarkdown', arguments: fetchArgs }), { content: [{ type: 'text', text: '# Exact\n' }] });
  assert.deepEqual(await site.client.callTool({ name: 'search', arguments: searchArgs }), { content: [{ type: 'text', text: 'Exact search' }] });
  assert.deepEqual(site.completions.map(({ tool, input, result, status, organizationId, actor }) => ({ tool, input, result, status, organizationId, actor })), [
    { tool: 'getURLAsMarkdown', input: fetchArgs, result: '# Exact\n', status: 'success', organizationId: 'trusted-workspace', actor: context.user },
    { tool: 'search', input: searchArgs, result: 'Exact search', status: 'success', organizationId: 'trusted-workspace', actor: context.user },
  ]);
  assert.deepEqual(site.completions.map((completion) => completion.operationId), site.records.map((record) => record.operationId));
});

test('Given withheld search content or a failed operation, when the tool answers, then the safe text and its status are captured', async (t) => {
  const site = await connect(t, { operations: {
    search: async () => ({ status: 'withheld', code: 'scan_limit' }),
    fetch: async () => { throw new Error('Access denied'); },
  } });
  assert.deepEqual(await site.client.callTool({ name: 'search', arguments: searchArgs }), { content: [{ type: 'text', text: 'Search content withheld' }], isError: true });
  assert.deepEqual(await site.client.callTool({ name: 'getURLAsMarkdown', arguments: fetchArgs }), { content: [{ type: 'text', text: 'Access denied' }], isError: true });
  assert.deepEqual(site.completions.map(({ status, result }) => ({ status, result })), [
    { status: 'withheld', result: 'Search content withheld' }, { status: 'access_denied', result: 'Access denied' },
  ]);
  assert.deepEqual(site.records.map((record) => record.status), ['withheld', 'access_denied']);
});

test('Given invalid arguments, a refusal of the arguments by the operation, or an unknown tool, when dispatched, then only the operator completion is recorded', async (t) => {
  const site = await connect(t, { operations: { search: async () => { throw new Error('Invalid tool arguments'); } } });
  assert.deepEqual(await site.client.callTool({ name: 'getURLAsMarkdown', arguments: { url: fetchArgs.url } }), { content: [{ type: 'text', text: 'Invalid tool arguments' }], isError: true });
  assert.deepEqual(await site.client.callTool({ name: 'search', arguments: searchArgs }), { content: [{ type: 'text', text: 'Invalid tool arguments' }], isError: true });
  await assert.rejects(site.client.callTool({ name: 'unknown', arguments: fetchArgs }), ProtocolError);
  assert.deepEqual(site.completions, []);
  assert.deepEqual(site.records.map((record) => [record.tool, record.status]), [['getURLAsMarkdown', 'invalid_arguments'], ['search', 'invalid_arguments'], ['unknown', 'unknown_tool']]);
});

test('Given a fetch operation that gives no text, when the tool answers, then only the processing failure is returned', async (t) => {
  const site = await connect(t, { operations: { fetch: async () => undefined as never } });
  assert.deepEqual(await site.client.callTool({ name: 'getURLAsMarkdown', arguments: fetchArgs }), { content: [{ type: 'text', text: 'Page processing failed' }], isError: true });
  assert.deepEqual(site.completions.map(({ status }) => status), ['processing_failed']);
});

test('Given no customer audit, when a tool answers, then the operator completion is still recorded', async (t) => {
  const site = await connect(t, { audited: false });
  assert.deepEqual(await site.client.callTool({ name: 'getURLAsMarkdown', arguments: fetchArgs }), { content: [{ type: 'text', text: '# Exact\n' }] });
  assert.deepEqual(site.records.map((record) => record.status), ['success']);
});

test('Given a request lifetime, when its shutdown aborts a running call, then the lifetime tracks the call and cancellation wins', async (t) => {
  const shutdown = new AbortController();
  const tracked: Promise<unknown>[] = [];
  const site = await connect(t, {
    lifetime: { signal: shutdown.signal, track: (task) => { tracked.push(task); return task; } },
    operations: { fetch: async (_url, _context, execution) => { shutdown.abort(); execution.signal.throwIfAborted(); return 'late'; } },
  });
  assert.deepEqual(await site.client.callTool({ name: 'getURLAsMarkdown', arguments: fetchArgs }), { content: [{ type: 'text', text: 'Request cancelled' }], isError: true });
  assert.equal(tracked.length, 1);
  assert.deepEqual(site.records.map((record) => record.status), ['cancelled']);
});

test('Given an operation that fails with each kind of error, when each tool answers, then only fixed public text and its status are returned', async (t) => {
  const throwingMessage = () => Object.defineProperty(new Error('Access denied'), 'message', { get() { throw new Error('PRIVATE getter'); } });
  const cases = [
    { tool: 'getURLAsMarkdown', error: new Error('Server busy. Try again later.'), text: 'Server busy. Try again later.', status: 'busy' },
    { tool: 'getURLAsMarkdown', error: new Error('Page fetch failed'), text: 'Page fetch failed', status: 'fetch_failed' },
    { tool: 'getURLAsMarkdown', error: new Error('PRIVATE failure'), text: 'Page processing failed', status: 'processing_failed' },
    { tool: 'getURLAsMarkdown', error: new DOMException('PRIVATE cancel', 'AbortError'), text: 'Request cancelled', status: 'cancelled' },
    { tool: 'getURLAsMarkdown', error: throwingMessage(), text: 'Page processing failed', status: 'processing_failed' },
    { tool: 'search', error: new Error('Search failed'), text: 'Search failed', status: 'search_failed' },
    { tool: 'search', error: 'PRIVATE value', text: 'Search processing failed', status: 'processing_failed' },
    { tool: 'search', error: new DOMException('PRIVATE cancel', 'AbortError'), text: 'Request cancelled', status: 'cancelled' },
  ] as const;
  const errors: unknown[] = cases.map(({ error }) => error);
  const fail = async (): Promise<never> => { throw errors.shift(); };
  const site = await connect(t, { operations: { fetch: fail, search: fail } });
  for (const { tool, text } of cases) {
    const result = await site.client.callTool({ name: tool, arguments: tool === 'search' ? searchArgs : fetchArgs });
    assert.deepEqual(result, { content: [{ type: 'text', text }], isError: true });
  }
  assert.deepEqual(site.records.map((record) => record.status), cases.map(({ status }) => status));
  assert.doesNotMatch(JSON.stringify([...site.records, ...site.completions]), /PRIVATE/);
});
