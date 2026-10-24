import type { TestContext } from 'node:test';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { fetchToolServers } from '../../../src/app/fetch-tool.ts';
import { AuditLog, type AuditEvent } from '../../../src/logs/audit/audit-log.ts';
import { MCPServer } from '../../../src/interfaces/mcp/mcp-server.ts';
import { SearchPipeline } from '../../../src/pipelines/search/search-pipeline.ts';
import { ObserveRequestStep } from '../../../src/pipelines/execution/observe-request-step.ts';
import { WebsiteFetchHttpError } from '../../../src/pipelines/providers/website-fetcher/website-fetcher.ts';
import { startHttpServer } from '../../../src/runtime/http/server.ts';
import { NoAuthProvider } from '../doubles/auth/no-auth-provider.ts';
import { connectMcpClient } from '../drivers/mcp/mcp-sdk-client.ts';
import { composeFetchOperation } from './fetch-operation.ts';

export type AuditToolOutcome = 'success' | 'empty success' | 'safe error' | 'cancelled' | 'withheld';

export async function openMcpAuditSite(t: TestContext, outcome: AuditToolOutcome, sink: 'accept' | 'throw' | 'refuse' = 'accept') {
  const events: AuditEvent[] = [];
  const diagnostics: string[] = [];
  let operations = 0;
  const logger = { info: (line: string) => { diagnostics.push(line); }, error: (line: string) => { diagnostics.push(line); } };
  const audit = new AuditLog({ writeAuditEvent: (event) => {
    if (sink === 'throw') throw new Error('PRIVATE export error with tool content');
    if (sink === 'refuse') return false;
    events.push(event);
  } });
  const render = async (url: string) => {
    operations++;
    if (outcome === 'safe error') throw new WebsiteFetchHttpError(429, { cause: new Error('PRIVATE renderer cause') });
    if (outcome === 'cancelled') throw new DOMException('PRIVATE renderer cancel cause', 'AbortError');
    return { requestedUrl: url, finalUrl: url, html: '<p>PRIVATE intermediate HTML</p>' };
  };
  const records = { record: (event: unknown) => logger.info(JSON.stringify(event)) };
  const incoming = { execute: async () => outcome === 'withheld'
    ? { decision: 'block' as const, code: 'scan_failed' as const }
    : { decision: 'allow' as const, output: outcome === 'empty success' ? '' : '# PRIVATE final Markdown\n' } };
  const fetch = composeFetchOperation({
    fetcher: { fetchURL: render }, incoming, records,
    pipeline: { process: async (page) => ({ ...page, removed: 0, skipped: 0, markdown: 'unused' }) },
    reportFetchFailure: (failure) => logger.error(JSON.stringify({ event: 'renderer.fetch.failed', ...failure })),
  });
  const search = new SearchPipeline({ engine: { search: async () => ({ page: await render('https://engine.example/'), kind: 'results' }) }, outgoing: new ObserveRequestStep(), incoming, records });
  const resource = new URL('https://thermus.example/mcp');
  const provider = new NoAuthProvider(resource);
  const server = new MCPServer({
    auth: {
      verifier: { verifyAccessToken: async (token) => ({ ...await provider.verifyAccessToken(token), user: { authority: 'trusted-authority', subject: token === 'organization-b' ? 'trusted-actor-b' : 'trusted-actor' } }) }, expectedResource: resource, resourceMetadataUrl: 'https://thermus.example/.well-known/oauth-protected-resource/mcp',
      accessResolver: { resolve: async (user) => ({ allowed: true, context: {
        user, tenantId: user.subject === 'trusted-actor-b' ? 'organization-b' : 'organization-a', organizationId: 'PRIVATE untrusted-organization',
        grants: [{ role: 'user', permissions: ['product:access'] }], permissions: ['product:access'],
      } }) },
    },
    buildServer: fetchToolServers({ fetch, search: (...args) => search.search(...args) }, logger, audit),
    reportFailure: () => logger.error('MCP request failed'),
  });
  const listener = await startHttpServer((request) => server.fetch(request), { listen: { host: '127.0.0.1', port: 0 }, publicBaseUrl: resource.href });
  t.after(async () => { await server.close(); await listener.close(); });
  const connect = async (tenant: string) => {
    const client = await connectMcpClient(t, new StreamableHTTPClientTransport(new URL('mcp', listener.url), { authProvider: { token: async () => tenant } }));
    t.after(() => client.close());
    return client;
  };
  const client = await connect('organization-a');
  return { client, connect, events, diagnostics, operations: () => operations };
}
