import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { StreamableHTTPClientTransport, type Client } from '@modelcontextprotocol/client';
import type { AccessResolver, RequestContext } from '../../../src/auth/access-context.ts';
import { InvalidAccessTokenError, type IdentityVerifier } from '../../../src/auth/identity-verifier.ts';
import type { HtmlToMarkdownPipeline } from '../../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';
import type { WebsiteFetcher } from '../../../src/website-fetcher/website-fetcher.ts';
import { startHttpServer } from '../../../src/http/server.ts';
import { createFetchToolServer } from '../../../src/mcp/fetch-tool-server.ts';
import { MCPServer } from '../../../src/mcp/mcp-server.ts';
import type { ExecutionContext } from '../../../src/page-fetch/execution-context.ts';
import { completionRecordsIn, stepRecordsIn } from '../drivers/operator-log.ts';
import type { McpProtocolEra } from '../drivers/mcp/mcp-protocol-eras.ts';
import { connectMcpClient } from '../drivers/mcp/mcp-sdk-client.ts';
import { composeFetchOperation } from './fetch-operation.ts';

const authority = 'https://identity.example';
const resource = new URL('https://thermus.example/mcp');

function pendingPage() {
  return {
    started: Promise.withResolvers<AbortSignal>(),
    cancelled: Promise.withResolvers<void>(),
    finish: Promise.withResolvers<void>(),
  };
}

function controlledPages() {
  const pages = { alice: pendingPage(), bob: pendingPage() };
  const emergencyStop = new AbortController();
  const pipelineUrls: string[] = [];
  return { pages, emergencyStop, pipelineUrls,
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
    } } satisfies WebsiteFetcher,
    pipeline: { process: async (page) => {
      pipelineUrls.push(page.requestedUrl);
      return { ...page, markdown: `Markdown for ${new URL(page.requestedUrl).pathname.slice(1)}\n`, removed: 0, skipped: 0 };
    } } satisfies Pick<HtmlToMarkdownPipeline, 'process'>,
  };
}

function accessControls() {
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
  return { access, verifier, resolver };
}

export async function openSite(t: TestContext, era: McpProtocolEra) {
  const controlled = controlledPages();
  const { pages, emergencyStop, pipelineUrls } = controlled;
  const records: Array<Record<string, unknown>> = [];
  const steps: Array<Record<string, unknown>> = [];
  const operationContexts: RequestContext[] = [];
  const operationExecutions: ExecutionContext[] = [];
  const recorded = [Promise.withResolvers<void>(), Promise.withResolvers<void>()] as const;
  const { access, verifier, resolver } = accessControls();
  const operation = composeFetchOperation({
    records: { record: (event) => logger.info(JSON.stringify(event)) },
    fetcher: controlled.fetcher,
    pipeline: controlled.pipeline,
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
