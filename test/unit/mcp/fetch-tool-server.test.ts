import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { ProtocolError } from '@modelcontextprotocol/server';
import type { RequestContext } from '../../../src/auth/access-context.ts';
import { createFetchToolServer } from '../../../src/mcp/fetch-tool-server.ts';
import { fetchToolInputSchema } from '../../../src/mcp/fetch-tool-schema.ts';
import type { McpRequestLifetime } from '../../../src/mcp/mcp-server.ts';

const context: RequestContext = {
  user: { authority: 'trusted-authority', subject: 'trusted-subject' }, tenantId: 'trusted-workspace', grants: [], permissions: ['product:access'],
};
const validArgs = { url: 'HTTPS://Example.COM/Page?secret-query=yes#secret-fragment', reason: 'Read for the task' };

async function connect(t: TestContext, options: { operation?: (url: string, context: RequestContext, signal: AbortSignal) => Promise<string>; infoFails?: boolean; errorFails?: boolean; lifetime?: McpRequestLifetime } = {}) {
  const calls: { url: string; context: RequestContext; signal: AbortSignal }[] = [];
  const info: string[] = [];
  const completed = Promise.withResolvers<string>();
  const errors: string[] = [];
  const server = createFetchToolServer(context, {
    operation: async (url, trusted, signal) => {
      calls.push({ url, context: trusted, signal });
      return options.operation?.(url, trusted, signal) ?? '# Exact\n';
    },
    logger: {
      info: (entry) => { info.push(entry); completed.resolve(entry); if (options.infoFails) throw new Error('secret-info-error'); },
      error: (entry) => { errors.push(entry); if (options.errorFails) throw new Error('secret-log-error'); },
    },
  }, options.lifetime);
  const client = new Client({ name: 'fetch-dispatch-unit', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  t.after(async () => { await client.close(); await server.close(); });
  return { client, calls, info, errors, firstCompletion: completed.promise };
}

test('Given a fetch operation double, when the tool is listed and called, then it uses the shared schema and returns one exact Markdown text entry with one trusted completion', async (t) => {
  const { client, calls, info, errors } = await connect(t);
  const listed = await client.listTools();
  assert.equal(listed.tools.length, 1);
  assert.deepEqual(listed.tools[0]?.inputSchema, fetchToolInputSchema);
  const result = await client.callTool({ name: 'getURLAsMarkdown', arguments: validArgs });
  assert.deepEqual(result, { content: [{ type: 'text', text: '# Exact\n' }] });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, validArgs.url);
  assert.equal(calls[0]?.context, context);
  assert.ok(calls[0]?.signal instanceof AbortSignal);
  assert.equal(info.length, 1);
  const entry = JSON.parse(info[0]);
  assert.equal(entry.reason, validArgs.reason);
  assert.equal(entry.status, 'success');
  assert.equal(entry.subject, context.user.subject);
  assert.equal(typeof entry.durationMs, 'number');
  assert.ok(entry.durationMs >= 0);
  assert.doesNotMatch(info[0], /secret-query|secret-fragment|# Exact/);
  assert.deepEqual(errors, []);
});

for (const args of [{ url: validArgs.url }, { ...validArgs, reason: '' }, { ...validArgs, reason: ' \n' }, { ...validArgs, reason: '😀'.repeat(2_001) }, { ...validArgs, url: 'file:///secret' }, { ...validArgs, url: 'https://user:password@example.com' }, { ...validArgs, url: 'https://example.com/' + 'x'.repeat(8_192) }, { ...validArgs, extra: 'secret' }]) {
  test(`Given invalid arguments ${JSON.stringify(args).slice(0, 70)}, when dispatched, then the operation is not called and one safe failure is recorded`, async (t) => {
    const { client, calls, info } = await connect(t);
    const result = await client.callTool({ name: 'getURLAsMarkdown', arguments: args });
    assert.deepEqual(result, { content: [{ type: 'text', text: 'Invalid tool arguments' }], isError: true });
    assert.deepEqual(calls, []);
    assert.equal(info.length, 1);
    assert.equal(JSON.parse(info[0]).status, 'invalid_arguments');
  });
}

test('Given an unknown tool, when dispatched, then InvalidParams and the completion use safe fixed text without an operation call', async (t) => {
  const { client, calls, info } = await connect(t);
  await assert.rejects(client.callTool({ name: 'secret-unknown-name', arguments: validArgs }), (error) => {
    assert.ok(error instanceof ProtocolError);
    assert.equal(error.code, -32602);
    assert.doesNotMatch(error.message, /secret-unknown-name/);
    return true;
  });
  assert.deepEqual(calls, []);
  assert.equal(info.length, 1);
  assert.equal(JSON.parse(info[0]).tool, 'unknown');
  assert.equal(JSON.parse(info[0]).status, 'unknown_tool');
  assert.doesNotMatch(info[0], /secret-unknown-name/);
});

for (const [message, status] of [['Access denied', 'access_denied'], ['Page fetch failed', 'fetch_failed'], ['Page processing failed', 'processing_failed'], ['secret-cause', 'processing_failed']] as const) {
  test(`Given operation failure ${status}, when called and both log methods fail, then the safe result is unchanged and the operation runs once`, async (t) => {
    const { client, calls, info, errors } = await connect(t, { operation: async () => { throw new Error(message); }, infoFails: true, errorFails: true });
    const result = await client.callTool({ name: 'getURLAsMarkdown', arguments: validArgs });
    assert.deepEqual(result, { content: [{ type: 'text', text: message === 'secret-cause' ? 'Page processing failed' : message }], isError: true });
    assert.equal(calls.length, 1);
    assert.equal(info.length, 1);
    assert.deepEqual(errors, info);
    assert.equal(JSON.parse(info[0]).status, status);
    assert.doesNotMatch(info[0], /secret-cause|secret-info-error|secret-log-error/);
  });
}

test('Given successful empty Markdown, when both log methods fail, then the exact empty success remains and no retry runs', async (t) => {
  const { client, calls, info, errors } = await connect(t, { operation: async () => '', infoFails: true, errorFails: true });
  assert.deepEqual(await client.callTool({ name: 'getURLAsMarkdown', arguments: validArgs }), { content: [{ type: 'text', text: '' }] });
  assert.equal(calls.length, 1);
  assert.equal(info.length, 1);
  assert.deepEqual(errors, info);
});

test('Given an operation AbortError with a private message, when called, then cancellation takes precedence and its cause is absent', async (t) => {
  const { client, calls, info } = await connect(t, { operation: async () => { throw new DOMException('private-cancel-cause', 'AbortError'); } });
  assert.deepEqual(await client.callTool({ name: 'getURLAsMarkdown', arguments: validArgs }), { content: [{ type: 'text', text: 'Request cancelled' }], isError: true });
  assert.equal(calls.length, 1);
  assert.equal(info.length, 1);
  assert.equal(JSON.parse(info[0]).status, 'cancelled');
  assert.doesNotMatch(info[0], /private-cancel-cause/);
});

test('Given cancellation while the operation runs, when the operation returns late Markdown, then the dispatch records cancellation instead of success', async (t) => {
  const started = Promise.withResolvers<void>();
  const site = await connect(t, { operation: async (_url, _context, signal) => {
    started.resolve();
    await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve(), { once: true }));
    return 'late success';
  } });
  const cancelled = new AbortController();
  const pending = site.client.callTool({ name: 'getURLAsMarkdown', arguments: validArgs }, { signal: cancelled.signal });
  const rejected = assert.rejects(pending);
  await started.promise;
  cancelled.abort();
  await rejected;
  assert.equal(JSON.parse(await site.firstCompletion).status, 'cancelled');
  assert.equal(site.calls.length, 1);
  assert.equal(site.info.length, 1);
  assert.doesNotMatch(site.info[0], /late success/);
});

test('Given nonstring operation output, when called, then the dispatch refuses it with one processing-failure record', async (t) => {
  const { client, info } = await connect(t, { operation: async () => 7 as unknown as string });
  assert.deepEqual(await client.callTool({ name: 'getURLAsMarkdown', arguments: validArgs }), { content: [{ type: 'text', text: 'Page processing failed' }], isError: true });
  assert.equal(info.length, 1);
  assert.equal(JSON.parse(info[0]).status, 'processing_failed');
});

test('Given an owned request lifetime, when shutdown cancels it, then the full handler stays tracked until its cancellation completion is recorded', async (t) => {
  const shutdown = new AbortController();
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const cancelled = Promise.withResolvers<void>();
  const tracked: Promise<unknown>[] = [];
  const lifetime: McpRequestLifetime = { signal: shutdown.signal, track: (task) => { tracked.push(task); return task; } };
  const site = await connect(t, { lifetime, operation: async (_url, _context, signal) => {
    started.resolve();
    await new Promise<void>((resolve) => signal.addEventListener('abort', () => { cancelled.resolve(); resolve(); }, { once: true }));
    await release.promise;
    return 'late success';
  } });
  t.after(() => release.resolve());
  const result = site.client.callTool({ name: 'getURLAsMarkdown', arguments: validArgs });
  await started.promise;
  assert.equal(tracked.length, 1);
  shutdown.abort();
  await cancelled.promise;
  assert.deepEqual(site.info, []);
  release.resolve();
  await Promise.all(tracked);
  assert.equal(JSON.parse(site.info[0]).status, 'cancelled');
  assert.deepEqual(await result, { content: [{ type: 'text', text: 'Request cancelled' }], isError: true });
  assert.equal(site.info.length, 1);
});

test('Given an unknown tool and two failing logger methods, when called, then the safe InvalidParams error stays unchanged and no operation runs', async (t) => {
  const { client, calls, info, errors } = await connect(t, { infoFails: true, errorFails: true });
  await assert.rejects(client.callTool({ name: 'secret-unknown-name', arguments: validArgs }), (error) => {
    assert.ok(error instanceof ProtocolError);
    assert.equal(error.code, -32602);
    assert.doesNotMatch(error.message, /secret-/);
    return true;
  });
  assert.deepEqual(calls, []);
  assert.equal(info.length, 1);
  assert.deepEqual(errors, info);
  assert.equal(JSON.parse(info[0]).status, 'unknown_tool');
});
