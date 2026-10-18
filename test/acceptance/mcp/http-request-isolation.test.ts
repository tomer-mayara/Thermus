import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { test, type TestContext } from 'node:test';
import { StreamableHTTPClientTransport, type CallToolResult, type Client } from '@modelcontextprotocol/client';
import type { AccessResolver, RequestContext } from '../../../src/auth/access-context.ts';
import { InvalidAccessTokenError, type IdentityVerifier } from '../../../src/auth/identity-verifier.ts';
import { startHttpServer } from '../../../src/http/server.ts';
import { createFetchToolServer } from '../../../src/mcp/fetch-tool-server.ts';
import { composeFetchOperation } from '../../support/in-process/fetch-operation.ts';
import { MCPServer } from '../../../src/mcp/mcp-server.ts';
import type { ExecutionContext } from '../../../src/page-fetch/execution-context.ts';
import { completionRecordsIn, stepRecordsIn } from '../../support/drivers/operator-log.ts';
import { generatedOperationIdPattern } from '../../support/fixtures/execution-context.ts';
import { mcpProtocolEras, type McpProtocolEra } from '../../support/drivers/mcp/mcp-protocol-eras.ts';
import { connectMcpClient } from '../../support/drivers/mcp/mcp-sdk-client.ts';

const authority = 'https://identity.example';
const resource = new URL('https://thermus.example/mcp');

function pendingPage() {
  return {
    started: Promise.withResolvers<AbortSignal>(),
    cancelled: Promise.withResolvers<void>(),
    finish: Promise.withResolvers<void>(),
  };
}

async function openSite(t: TestContext, era: McpProtocolEra) {
  const pages = { alice: pendingPage(), bob: pendingPage() };
  const emergencyStop = new AbortController();
  const records: Array<Record<string, unknown>> = [];
  const steps: Array<Record<string, unknown>> = [];
  const pipelineUrls: string[] = [];
  const operationContexts: RequestContext[] = [];
  const operationExecutions: ExecutionContext[] = [];
  const recorded = [Promise.withResolvers<void>(), Promise.withResolvers<void>()] as const;
  const access = { deny: false, invalid: false };
  const verifier: IdentityVerifier = { verifyAccessToken: async (token) => {
    if (access.invalid || !['alice', 'bob'].includes(token)) throw new InvalidAccessTokenError();
    const now = Math.floor(Date.now() / 1_000);
    return {
      user: { authority, subject: token }, issuer: authority, clientId: 'acceptance-client',
      resource: new URL(resource), scopes: [], issuedAtUnixSeconds: now, expiresAtUnixSeconds: now + 300,
    };
  } };
  const resolver: AccessResolver = { resolve: async (user) => access.deny
    ? { allowed: false, reason: 'permission-required' }
    : { allowed: true, context: {
      user, tenantId: `${user.subject}-tenant`, grants: [{ role: 'user', permissions: ['product:access'] }], permissions: ['product:access'],
    } } };
  const operation = composeFetchOperation({
    records: { record: (event) => logger.info(JSON.stringify(event)) },
    fetcher: { fetchURL: async (url, signal) => {
      assert.ok(signal);
      const name = new URL(url).pathname.slice(1) as keyof typeof pages;
      const page = pages[name];
      assert.ok(page);
      page.started.resolve(signal);
      const cancellation = AbortSignal.any([signal, emergencyStop.signal]);
      const cancelled = () => page.cancelled.resolve();
      cancellation.addEventListener('abort', cancelled, { once: true });
      try {
        await page.finish.promise;
        return { requestedUrl: url, finalUrl: `${url}/final`, html: `<p>${name}</p>` };
      } finally {
        cancellation.removeEventListener('abort', cancelled);
      }
    } },
    pipeline: { process: async (page) => {
      pipelineUrls.push(page.requestedUrl);
      return { ...page, markdown: `Markdown for ${new URL(page.requestedUrl).pathname.slice(1)}\n`, removed: 0, skipped: 0 };
    } },
  });
  const logger = { info: (record: string) => {
    steps.push(...stepRecordsIn(record));
    const completions = completionRecordsIn(record);
    if (completions.length === 1) {
      records.push(completions[0]);
      recorded[records.length - 1]?.resolve();
    }
  }, error: (record: string) => { throw new Error(record); } };
  const server = new MCPServer({
    auth: { verifier, accessResolver: resolver, expectedResource: resource, resourceMetadataUrl: 'https://thermus.example/.well-known/oauth-protected-resource/mcp' },
    buildServer: (context, lifetime) => createFetchToolServer(context, {
      operation: async (url, callContext, execution) => {
        operationContexts.push(callContext);
        operationExecutions.push(execution);
        return operation(url, callContext, execution);
      }, logger,
    }, lifetime),
    reportFailure: () => {},
  });
  const listener = await startHttpServer((request) => server.fetch(request), {
    listen: { host: '127.0.0.1', port: 0 }, publicBaseUrl: resource.href, shutdownGraceMs: 1_000,
  });
  const clients: Client[] = [];
  t.after(async () => {
    emergencyStop.abort();
    pages.alice.finish.resolve();
    pages.bob.finish.resolve();
    await Promise.all(clients.map((client) => client.close()));
    await Promise.all([server.close(), listener.close()]);
  });
  const url = new URL('mcp', listener.url);
  async function connect(subject: keyof typeof pages, cancelled?: AbortSignal) {
    const client = await connectMcpClient(t, new StreamableHTTPClientTransport(url, {
      authProvider: { token: async () => subject },
      fetch: cancelled === undefined ? undefined : (target, init) => fetch(target, {
        ...init, signal: AbortSignal.any([cancelled, ...(init?.signal ? [init.signal] : [])]),
      }),
    }), { era });
    clients.push(client);
    return client;
  }
  return { pages, records, steps, recorded, pipelineUrls, operationContexts, operationExecutions, access, server, listener, connect };
}

function call(client: Client, subject: 'alice' | 'bob', signal?: AbortSignal) {
  return client.callTool({ name: 'getURLAsMarkdown', arguments: {
    url: `https://pages.example/${subject}`, reason: `Read ${subject}'s separate page`,
  } }, { signal });
}

function assertSuccess(result: CallToolResult, subject: string) {
  assert.equal(result.isError, undefined);
  assert.deepEqual(result.content, [{ type: 'text', text: `Markdown for ${subject}\n` }]);
}

function assertRecord(record: Record<string, unknown> | undefined, subject: string, status: string) {
  assert.ok(record);
  assert.match(record.operationId as string, generatedOperationIdPattern);
  assert.equal(record.subject, subject);
  assert.equal(record.authority, authority);
  assert.equal(record.tenantId, `${subject}-tenant`);
  assert.equal(record.url, `https://pages.example/${subject}`);
  assert.equal(record.reason, `Read ${subject}'s separate page`);
  assert.equal(record.status, status);
}

for (const era of mcpProtocolEras) {
  test(`Given two trusted users overlap in ${era}, when calls finish in reverse order, then each result and record keeps its context`, { timeout: 5_000 }, async (t) => {
    const site = await openSite(t, era);
    const alice = await site.connect('alice');
    const bob = await site.connect('bob');
    const first = call(alice, 'alice');
    await site.pages.alice.started.promise;
    const second = call(bob, 'bob');
    const signals = await Promise.all([site.pages.alice.started.promise, site.pages.bob.started.promise]);
    assert.notEqual(signals[0], signals[1]);
    site.pages.bob.finish.resolve();
    assertSuccess(await second, 'bob');
    site.pages.alice.finish.resolve();
    assertSuccess(await first, 'alice');
    assert.equal(site.records.length, 2);
    assertRecord(site.records[0], 'bob', 'success');
    assertRecord(site.records[1], 'alice', 'success');
    assert.equal(site.records[0].operationId, site.operationExecutions[1].operationId);
    assert.equal(site.records[1].operationId, site.operationExecutions[0].operationId);
    assert.notEqual(site.operationExecutions[0].operationId, site.operationExecutions[1].operationId);
    assert.deepEqual(site.steps.map(({ operationId, stepId, outcome }) => ({ operationId, stepId, outcome })), [
      ...site.operationExecutions.map(({ operationId }) => ({ operationId, stepId: 'outgoing.observe_request', outcome: 'allowed' })),
      { operationId: site.operationExecutions[1].operationId, stepId: 'incoming.process_html', outcome: 'allowed' },
      { operationId: site.operationExecutions[0].operationId, stepId: 'incoming.process_html', outcome: 'allowed' },
    ]);
    assert.equal(site.operationExecutions[0].signal, signals[0]);
    assert.equal(site.operationExecutions[1].signal, signals[1]);
    assert.deepEqual(site.operationContexts.map((context) => [context.user.subject, context.tenantId]), [['alice', 'alice-tenant'], ['bob', 'bob-tenant']]);
    assert.ok(site.operationContexts.every((context) => Object.isFrozen(context)));
  });

  test(`Given two trusted users overlap in ${era}, when only Alice cancels, then Bob succeeds with his context and Alice records cancellation`, { timeout: 5_000 }, async (t) => {
    const site = await openSite(t, era);
    const cancelled = new AbortController();
    const alice = await site.connect('alice', era === '2025-11-25' ? cancelled.signal : undefined);
    const bob = await site.connect('bob');
    const first = call(alice, 'alice', cancelled.signal);
    const rejected = assert.rejects(first);
    const second = call(bob, 'bob');
    const signals = await Promise.all([site.pages.alice.started.promise, site.pages.bob.started.promise]);
    cancelled.abort(new Error('private-alice-cancel-reason'));
    await rejected;
    await site.pages.alice.cancelled.promise;
    assert.equal(signals[0].aborted, true);
    assert.equal(signals[1].aborted, false);
    site.pages.bob.finish.resolve();
    assertSuccess(await second, 'bob');
    site.pages.alice.finish.resolve();
    await site.recorded[1].promise;
    assertRecord(site.records[0], 'bob', 'success');
    assertRecord(site.records[1], 'alice', 'cancelled');
    assert.deepEqual(site.steps.map(({ operationId, stepId, outcome }) => ({ operationId, stepId, outcome })), [
      ...site.operationExecutions.map(({ operationId }) => ({ operationId, stepId: 'outgoing.observe_request', outcome: 'allowed' })),
      { operationId: site.operationExecutions[1].operationId, stepId: 'incoming.process_html', outcome: 'allowed' },
    ]);
    assert.deepEqual(site.pipelineUrls, ['https://pages.example/bob']);
    assert.doesNotMatch(JSON.stringify(site.records), /private-alice-cancel-reason|Markdown for/);
  });

  test(`Given two trusted users have active calls in ${era}, when shutdown starts, then every peer cancels and shutdown waits for both cleanups`, { timeout: 5_000 }, async (t) => {
    const site = await openSite(t, era);
    const alice = await site.connect('alice');
    const bob = await site.connect('bob');
    const first = call(alice, 'alice').catch(() => undefined);
    const second = call(bob, 'bob').catch(() => undefined);
    const signals = await Promise.all([site.pages.alice.started.promise, site.pages.bob.started.promise]);
    let closed = false;
    const draining = site.listener.close();
    const closing = site.server.close().then(() => { closed = true; });
    await setImmediate();
    assert.ok(signals.every((signal) => signal.aborted), 'shutdown cancels both trusted users');
    assert.equal(closed, false);
    site.pages.bob.finish.resolve();
    await site.recorded[0].promise;
    assert.equal(closed, false);
    site.pages.alice.finish.resolve();
    await Promise.all([closing, draining]);
    await Promise.all([alice.close(), bob.close()]);
    await Promise.all([first, second]);
    assert.equal(site.records.length, 2);
    assertRecord(site.records[0], 'bob', 'cancelled');
    assertRecord(site.records[1], 'alice', 'cancelled');
    assert.deepEqual(site.pipelineUrls, []);
  });

  for (const refusal of ['authentication', 'access'] as const) {
    test(`Given a prior success in ${era}, when ${refusal} refuses the next call, then no prior trusted context reaches the tool`, { timeout: 5_000 }, async (t) => {
      const site = await openSite(t, era);
      const alice = await site.connect('alice');
      site.pages.alice.finish.resolve();
      assertSuccess(await call(alice, 'alice'), 'alice');
      if (refusal === 'authentication') site.access.invalid = true;
      else site.access.deny = true;
      await assert.rejects(call(alice, 'bob'));
      assert.equal(site.operationContexts.length, 1);
      const previousContext = site.operationContexts[0];
      assert.ok(previousContext);
      assert.equal(previousContext.user.subject, 'alice');
      assert.deepEqual(site.pipelineUrls, ['https://pages.example/alice']);
      assert.equal(site.records.length, 1);
      assertRecord(site.records[0], 'alice', 'success');
    });
  }
}
