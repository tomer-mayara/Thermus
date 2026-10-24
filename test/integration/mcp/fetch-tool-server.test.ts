import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { ProtocolError } from '@modelcontextprotocol/server';
import type { RequestContext } from '../../../src/accounts/identity/access-context.ts';
import { createFetchToolServer } from '../../../src/interfaces/mcp/fetch-tool-server.ts';
import { fetchToolInputSchema } from '../../../src/interfaces/mcp/fetch-tool-schema.ts';
import type { McpRequestLifetime } from '../../../src/interfaces/mcp/mcp-server.ts';
import type { SearchOperation } from '../../../src/interfaces/mcp/search.ts';
import type { FetchOperation } from '../../../src/interfaces/mcp/get-url-as-markdown.ts';
import type { ExecutionContext } from '../../../src/pipelines/execution/execution-context.ts';
import { completionLinesIn } from '../../support/drivers/operator-log.ts';
import { generatedOperationIdPattern } from '../../support/fixtures/execution-context.ts';
import { SearchPipeline } from '../../../src/pipelines/search/search-pipeline.ts';
import type { StepRecord } from '../../../src/pipelines/execution/step-record.ts';
import { SearchFailure } from '../../../src/pipelines/search/search-failure.ts';
import type { AuditLog, ToolCompletion } from '../../../src/logs/audit/audit-log.ts';
import { PageFetchFailure } from '../../../src/pipelines/page-fetch/fetch-failure.ts';

const context: RequestContext = {
  user: { authority: 'trusted-authority', subject: 'trusted-subject' }, tenantId: 'trusted-workspace', grants: [], permissions: ['product:access'],
};
const validArgs = { url: 'HTTPS://Example.COM/Page?secret-query=yes#secret-fragment', reason: 'Read for the task' };

async function connect(t: TestContext, options: { search?: SearchOperation; operation?: FetchOperation; infoFails?: boolean; errorFails?: boolean; lifetime?: McpRequestLifetime; audit?: Pick<AuditLog, 'toolCompleted'> } = {}) {
  const calls: { url: string; context: RequestContext; execution: ExecutionContext }[] = [];
  const info: string[] = [];
  const completed = Promise.withResolvers<string>();
  const errors: string[] = [];
  const server = createFetchToolServer(context, {
    audit: options.audit,
    operations: { search: options.search ?? (async () => ({ status: 'released', markdown: 'search' })), fetch: async (url, trusted, execution) => {
      calls.push({ url, context: trusted, execution });
      return options.operation?.(url, trusted, execution) ?? '# Exact\n';
    } },
    logger: {
      info: (entry) => { info.push(entry); if (completionLinesIn(entry).length === 1) completed.resolve(entry); if (options.infoFails) throw new Error('secret-info-error'); },
      error: (entry) => { errors.push(String(entry)); if (options.errorFails) throw new Error('secret-log-error'); },
    },
  }, options.lifetime);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'fetch-dispatch-unit', version: '0.0.0' });
  await client.connect(clientTransport);
  t.after(async () => { await client.close(); await server.close(); });
  return { client, calls, info, errors, firstCompletion: completed.promise };
}

test('Given a fetch operation double, when the tool is listed and called, then it uses the shared schema and returns one exact Markdown text entry with one trusted completion', async (t) => {
  const { client, calls, info, errors } = await connect(t);
  const listed = await client.listTools();
  assert.equal(listed.tools.length, 2);
  assert.deepEqual(listed.tools[0]?.inputSchema, fetchToolInputSchema);
  const result = await client.callTool({ name: 'getURLAsMarkdown', arguments: validArgs });
  assert.deepEqual(result, { content: [{ type: 'text', text: '# Exact\n' }] });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, validArgs.url);
  assert.equal(calls[0]?.context, context);
  assert.ok(calls[0]?.execution.signal instanceof AbortSignal);
  assert.equal(info.length, 1);
  const entry = JSON.parse(info[0]);
  assert.match(entry.operationId, generatedOperationIdPattern);
  assert.equal(entry.operationId, calls[0]?.execution.operationId);
  assert.equal(Object.hasOwn(entry, 'reason'), false);
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

for (const [message, status] of [['Access denied', 'access_denied'], ['Server busy. Try again later.', 'busy'], ['Page fetch failed', 'fetch_failed'], ['Page processing failed', 'processing_failed'], ['secret-cause', 'processing_failed']] as const) {
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

test('Given a typed fetch failure with an overwritten Error message, when the tool handles it, then it projects the selected safe diagnosis and records fetch_failed', async (t) => {
  const failure = new PageFetchFailure({ category: 'http', phase: 'renderer_result', httpStatus: 429 });
  failure.message = 'PRIVATE Error message';
  const site = await connect(t, { operation: async () => { throw failure; } });

  assert.deepEqual(await site.client.callTool({ name: 'getURLAsMarkdown', arguments: validArgs }), { content: [{ type: 'text', text: 'Page fetch failed: HTTP 429' }], isError: true });
  assert.equal(JSON.parse(site.info[0]).status, 'fetch_failed');
  assert.doesNotMatch(site.info.join('\n'), /PRIVATE/);
});

test('Given an untyped error that copies a public fetch detail, when the tool handles it, then it reports only the safe processing failure', async (t) => {
  const site = await connect(t, { operation: async () => { throw new Error('Page fetch failed: HTTP 429'); } });

  assert.deepEqual(await site.client.callTool({ name: 'getURLAsMarkdown', arguments: validArgs }), { content: [{ type: 'text', text: 'Page processing failed' }], isError: true });
  assert.equal(JSON.parse(site.info[0]).status, 'processing_failed');
});

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
  const site = await connect(t, { operation: async (_url, _context, { signal }) => {
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
  const site = await connect(t, { lifetime, operation: async (_url, _context, { signal }) => {
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

for (const [error, message, status] of [
  [new Error('Search failed'), 'Search failed', 'search_failed'],
  [new Error('Search processing failed'), 'Search processing failed', 'processing_failed'],
  [new Error('Access denied'), 'Access denied', 'access_denied'],
  [new Error('Server busy. Try again later.'), 'Server busy. Try again later.', 'busy'],
  [new Error('PRIVATE error'), 'Search processing failed', 'processing_failed'],
  [new DOMException('PRIVATE cancel', 'AbortError'), 'Request cancelled', 'cancelled'],
] as const) {
  test(`Given search failure ${status}, when dispatched with failed loggers, then safe text and one private completion remain`, async (t) => {
    let count = 0;
    const site = await connect(t, { search: async () => { count++; throw error; }, infoFails: true, errorFails: true });
    assert.deepEqual(await site.client.callTool({ name: 'search', arguments: { query: 'PRIVATE query', reason: 'PRIVATE reason' } }), { content: [{ type: 'text', text: message }], isError: true });
    assert.equal(count, 1);
    assert.equal(site.info.length, 1);
    assert.deepEqual(site.info, site.errors);
    const record = JSON.parse(site.info[0]);
    assert.equal(record.tool, 'search');
    assert.equal(record.status, status);
    assert.doesNotMatch(site.info[0], /PRIVATE|query|reason|url/i);
  });
}

test('Given released and withheld search outcomes, when dispatched, then exact text and safe withholding are projected', async (t) => {
  const outcomes = [{ status: 'released', markdown: '# Exact search\n' }, { status: 'withheld', code: 'scan_failed' }];
  const site = await connect(t, { search: async () => outcomes.shift() as never });
  assert.deepEqual(await site.client.callTool({ name: 'search', arguments: { query: 'PRIVATE', reason: 'PRIVATE' } }), { content: [{ type: 'text', text: '# Exact search\n' }] });
  assert.deepEqual(await site.client.callTool({ name: 'search', arguments: { query: 'PRIVATE', reason: 'PRIVATE' } }), { content: [{ type: 'text', text: 'Search content withheld' }], isError: true });
  assert.deepEqual(site.info.map((line) => JSON.parse(line).status), ['success', 'withheld']);
  assert.doesNotMatch(site.info.join(''), /PRIVATE/);
});

test('Given an authorized client, when it discovers and calls search, then guidance and trusted execution are preserved', async (t) => {
  const site = await connect(t, { search: async (query, trusted, execution) => {
    assert.equal(query, ' exact query ');
    assert.equal(trusted, context);
    assert.match(execution.operationId, generatedOperationIdPattern);
    assert.ok(execution.signal instanceof AbortSignal);
    return { status: 'released', markdown: 'Exact search' };
  } });
  const tools = (await site.client.listTools()).tools;
  assert.equal(tools.find((tool) => tool.name === 'search')?.description, 'Search the web with a text query and return cleaned results as Markdown. Use this tool for web searches; search engines may block generic page-fetch requests. Use getURLAsMarkdown to read a result page. Give the reason the agent needs the search.');
  assert.equal(tools.find((tool) => tool.name === 'getURLAsMarkdown')?.description, 'Fetch a known web page URL as Markdown. For web searches, use search instead of fetching a search engine results URL. Give the reason the agent needs the page.');
  assert.deepEqual(await site.client.callTool({ name: 'search', arguments: { query: ' exact query ', reason: 'PRIVATE reason' } }), { content: [{ type: 'text', text: 'Exact search' }] });
  assert.equal(site.info.length, 1);
});

test('Given a typed search failure with a changed message, when dispatched, then the immutable diagnosis is projected', async (t) => {
  const failure = new SearchFailure({ phase: 'renderer_result', category: 'http', httpStatus: 429 });
  failure.message = 'PRIVATE failure';
  const site = await connect(t, { search: async () => { throw failure; } });
  assert.deepEqual(await site.client.callTool({ name: 'search', arguments: { query: 'PRIVATE', reason: 'PRIVATE' } }), { content: [{ type: 'text', text: 'Search failed: HTTP 429' }], isError: true });
  assert.equal(site.info.length, 1);
  const { operationId, durationMs, ...completion } = JSON.parse(site.info[0]);
  assert.match(operationId, generatedOperationIdPattern);
  assert.equal(typeof durationMs, 'number');
  assert.ok(Number.isFinite(durationMs) && durationMs >= 0);
  assert.deepEqual(completion, {
    event: 'mcp.tool.completed', authority: context.user.authority, subject: context.user.subject,
    tenantId: context.tenantId, tool: 'search', status: 'search_failed',
  });
});

for (const args of [{ query: 'PRIVATE' }, { query: 'PRIVATE', reason: 'PRIVATE', url: 'https://PRIVATE' }, { query: 7, reason: 'PRIVATE' }]) {
  test('Given malformed search arguments, when dispatched, then no operation runs and the completion has no argument fields', async (t) => {
    let calls = 0;
    const site = await connect(t, { search: async () => { calls++; throw new Error('PRIVATE'); } });
    assert.deepEqual(await site.client.callTool({ name: 'search', arguments: args }), { content: [{ type: 'text', text: 'Invalid tool arguments' }], isError: true });
    assert.equal(calls, 0);
    assert.equal(site.info.length, 1);
    assert.equal(JSON.parse(site.info[0]).status, 'invalid_arguments');
    assert.doesNotMatch(site.info[0], /PRIVATE|query|reason|url/);
  });
}

test('Given malformed search operation output, when dispatched, then only the processing failure is projected', async (t) => {
  const site = await connect(t, { search: async () => ({ status: 'PRIVATE' }) as never });
  assert.deepEqual(await site.client.callTool({ name: 'search', arguments: { query: 'PRIVATE', reason: 'PRIVATE' } }), { content: [{ type: 'text', text: 'Search processing failed' }], isError: true });
  assert.equal(JSON.parse(site.info[0]).status, 'processing_failed');
});

for (const field of ['name', 'message']) {
  test(`Given a search error with a throwing ${field} getter, when dispatched, then processing failure and one completion remain safe`, async (t) => {
    const failure = Object.defineProperty(new Error(), field, { get() { throw new Error('PRIVATE getter'); } });
    const site = await connect(t, { search: async () => { throw failure; } });
    assert.deepEqual(await site.client.callTool({ name: 'search', arguments: { query: 'PRIVATE', reason: 'PRIVATE' } }), { content: [{ type: 'text', text: 'Search processing failed' }], isError: true });
    assert.equal(site.info.length, 1);
    assert.equal(JSON.parse(site.info[0]).status, 'processing_failed');
    assert.doesNotMatch(site.info[0], /PRIVATE/);
  });
}

for (const scenario of [
  { name: 'name getter that returns Error', failure: (cancel: () => void) => Object.defineProperty(new Error('Search failed'), 'name', { get() { cancel(); return 'Error'; } }) },
  { name: 'typed failure name getter', failure: (cancel: () => void) => Object.defineProperty(new SearchFailure(), 'name', { get() { cancel(); return 'SearchFailure'; } }) },
  { name: 'message getter that returns unknown text', failure: (cancel: () => void) => Object.defineProperty(new Error(), 'message', { get() { cancel(); return 'PRIVATE failure'; } }) },
  { name: 'name getter that throws', failure: (cancel: () => void) => Object.defineProperty(new Error('Search failed'), 'name', { get() { cancel(); throw new Error('PRIVATE getter'); } }) },
]) {
  test(`Given a search error with a cancelling ${scenario.name}, when dispatched, then cancellation wins in the result and the one correlated completion`, async (t) => {
    const shutdown = new AbortController();
    const failure = scenario.failure(() => shutdown.abort());
    let execution: ExecutionContext | undefined;
    let calls = 0;
    const site = await connect(t, {
      lifetime: { signal: shutdown.signal, track: (task) => task },
      search: async (_query, _trusted, current) => { calls++; execution = current; throw failure; },
    });

    assert.deepEqual(await site.client.callTool({ name: 'search', arguments: { query: 'PRIVATE query', reason: 'PRIVATE reason' } }), { content: [{ type: 'text', text: 'Request cancelled' }], isError: true });
    assert.equal(calls, 1);
    assert.ok(execution?.signal.aborted);
    assert.equal(site.info.length, 1);
    const completion = JSON.parse(site.info[0]);
    assert.equal(completion.tool, 'search');
    assert.equal(completion.status, 'cancelled');
    assert.equal(completion.operationId, execution.operationId);
    assert.doesNotMatch(site.info[0], /PRIVATE|query|reason|url/i);
  });
}

test('Given search cancellation and late operation output, when shutdown aborts the lifetime, then cancellation wins and the correlated completion stays tracked', async (t) => {
  const shutdown = new AbortController();
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const tracked: Promise<unknown>[] = [];
  const site = await connect(t, {
    lifetime: { signal: shutdown.signal, track: (task) => { tracked.push(task); return task; } },
    search: async (_query, _trusted, execution) => {
      started.resolve();
      await release.promise;
      assert.ok(execution.signal.aborted);
      return { status: 'released', markdown: 'PRIVATE late page' };
    },
  });
  t.after(() => release.resolve());
  const result = site.client.callTool({ name: 'search', arguments: { query: 'PRIVATE query', reason: 'PRIVATE reason' } });
  await started.promise;
  shutdown.abort();
  assert.equal(tracked.length, 1);
  assert.deepEqual(site.info, []);
  release.resolve();
  await Promise.all(tracked);
  assert.deepEqual(await result, { content: [{ type: 'text', text: 'Request cancelled' }], isError: true });
  assert.equal(site.info.length, 1);
  assert.equal(JSON.parse(site.info[0]).status, 'cancelled');
  assert.doesNotMatch(site.info[0], /PRIVATE/);
});

test('Given a search error whose message changes after the first read, when dispatched, then only the checked message is projected', async (t) => {
  let reads = 0;
  const failure = Object.defineProperty(new Error(), 'message', { get() { return reads++ === 0 ? 'Search failed' : 'PRIVATE changed message'; } });
  const site = await connect(t, { search: async () => { throw failure; } });
  assert.deepEqual(await site.client.callTool({ name: 'search', arguments: { query: 'PRIVATE', reason: 'PRIVATE' } }), { content: [{ type: 'text', text: 'Search failed' }], isError: true });
  assert.equal(reads, 1);
  assert.equal(JSON.parse(site.info[0]).status, 'search_failed');
  assert.doesNotMatch(site.info[0], /PRIVATE/);
});

for (const stage of ['outgoing', 'engine', 'incoming'] as const) {
  test(`Given the protected search ${stage} throws an error with an unreadable name, when dispatched, then its boundary text and completion status remain correct`, async (t) => {
    const calls: string[] = [];
    const records: StepRecord[] = [];
    const failure = Object.defineProperty(new Error('PRIVATE failure', { cause: new Error('PRIVATE cause') }), 'name', { get() { throw new Error('PRIVATE name getter'); } });
    const page = { requestedUrl: 'https://search.example/', finalUrl: 'https://search.example/', html: 'PRIVATE page' };
    const pipeline = new SearchPipeline({
      outgoing: { execute: async (query) => { calls.push('outgoing'); if (stage === 'outgoing') throw failure; return { decision: 'allow', output: query }; } },
      engine: { search: async () => { calls.push('engine'); if (stage === 'engine') throw failure; return { page, kind: 'results' }; } },
      incoming: { execute: async () => { calls.push('incoming'); if (stage === 'incoming') throw failure; return { decision: 'allow', output: 'PRIVATE result' }; } },
      records: { record: (entry) => { records.push(entry); } },
    });
    let operations = 0;
    const site = await connect(t, { search: async (...args) => { operations++; return pipeline.search(...args); }, infoFails: true, errorFails: true });
    assert.deepEqual(await site.client.callTool({ name: 'search', arguments: { query: 'PRIVATE query', reason: 'PRIVATE reason' } }), { content: [{ type: 'text', text: stage === 'incoming' ? 'Search processing failed' : 'Search failed' }], isError: true });
    assert.equal(operations, 1);
    assert.deepEqual(calls, stage === 'outgoing' ? ['outgoing'] : stage === 'engine' ? ['outgoing', 'engine'] : ['outgoing', 'engine', 'incoming']);
    assert.equal(site.info.length, 1);
    assert.deepEqual(site.errors, site.info);
    const completion = JSON.parse(site.info[0]);
    assert.equal(completion.tool, 'search');
    assert.equal(completion.status, stage === 'incoming' ? 'processing_failed' : 'search_failed');
    assert.deepEqual(records.map(({ operationId, outcome, ...entry }) => {
      assert.equal(operationId, completion.operationId);
      return [outcome, 'code' in entry ? entry.code : undefined];
    }), stage === 'outgoing' ? [['failed', 'step_failed']] : stage === 'engine' ? [['allowed', undefined]] : [['allowed', undefined], ['failed', 'step_failed']]);
    assert.doesNotMatch(site.info.join('') + JSON.stringify(records), /PRIVATE/);
  });
}

for (const tool of ['getURLAsMarkdown', 'search'] as const) {
  test(`Given validated ${tool} input, when final public output is projected, then one trusted completion carries only input and public text`, async (t) => {
    const completions: ToolCompletion[] = [];
    const site = await connect(t, { audit: { toolCompleted: (completion) => { completions.push(completion); } } });
    const args = tool === 'search' ? { query: 'PRIVATE query', reason: 'PRIVATE reason' } : validArgs;
    const result = await site.client.callTool({ name: tool, arguments: args, _meta: { tenantId: 'forged-tenant' } });
    assert.equal(completions.length, 1);
    assert.deepEqual(completions[0].input, args);
    assert.equal(completions[0].result, result.content[0].type === 'text' ? result.content[0].text : undefined);
    assert.equal(completions[0].organizationId, context.tenantId);
    assert.deepEqual(completions[0].actor, context.user);
    assert.equal(completions[0].operationId, JSON.parse(site.info[0]).operationId);
    assert.doesNotMatch(JSON.stringify(completions), /forged-tenant|_meta/);
  });
}

test('Given invalid arguments or an unknown tool, when dispatched, then no customer completion is captured', async (t) => {
  const completions: ToolCompletion[] = [];
  const site = await connect(t, { audit: { toolCompleted: (completion) => { completions.push(completion); } } });
  await site.client.callTool({ name: 'getURLAsMarkdown', arguments: { url: validArgs.url } });
  await site.client.callTool({ name: 'search', arguments: { query: 'PRIVATE query' } });
  await assert.rejects(site.client.callTool({ name: 'PRIVATE unknown', arguments: validArgs }));
  assert.deepEqual(completions, []);
});

test('Given capture itself throws, when a tool completes, then its exact result and single operation remain', async (t) => {
  const site = await connect(t, { audit: { toolCompleted: () => { throw new Error('PRIVATE audit failure'); } } });
  assert.deepEqual(await site.client.callTool({ name: 'getURLAsMarkdown', arguments: validArgs }), { content: [{ type: 'text', text: '# Exact\n' }] });
  assert.equal(site.calls.length, 1);
  assert.doesNotMatch(site.info.join('') + site.errors.join(''), /PRIVATE/);
});

for (const field of ['name', 'message']) {
  test(`Given a fetch error with a throwing ${field} getter, when final public failure is captured, then its safe processing text and result remain`, async (t) => {
    const completions: ToolCompletion[] = [];
    const error = Object.defineProperty(new Error(), field, { get() { throw new Error('PRIVATE getter'); } });
    const site = await connect(t, { operation: async () => { throw error; }, audit: { toolCompleted: (completion) => { completions.push(completion); } } });
    assert.deepEqual(await site.client.callTool({ name: 'getURLAsMarkdown', arguments: validArgs }), { content: [{ type: 'text', text: 'Page processing failed' }], isError: true });
    assert.equal(completions.length, 1);
    assert.equal(completions[0].result, 'Page processing failed');
    assert.doesNotMatch(JSON.stringify(completions) + site.info.join(''), /PRIVATE getter/);
  });
}

test('Given a fetch error message that changes after its first read, when final failure is captured, then only the checked message is returned and captured', async (t) => {
  let reads = 0;
  const completions: ToolCompletion[] = [];
  const error = Object.defineProperty(new Error(), 'message', { get() { return reads++ === 0 ? 'Page fetch failed' : 'PRIVATE changed message'; } });
  const site = await connect(t, { operation: async () => { throw error; }, audit: { toolCompleted: (completion) => { completions.push(completion); } } });
  assert.deepEqual(await site.client.callTool({ name: 'getURLAsMarkdown', arguments: validArgs }), { content: [{ type: 'text', text: 'Page fetch failed' }], isError: true });
  assert.equal(reads, 1);
  assert.equal(completions[0].result, 'Page fetch failed');
});
