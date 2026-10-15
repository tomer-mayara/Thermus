import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import type { AccessResolver } from '../../../src/auth/access-context.ts';
import type { HtmlToMarkdownPipeline } from '../../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';
import { startHttpServer } from '../../../src/http/server.ts';
import { createFetchToolServer } from '../../../src/mcp/fetch-tool-server.ts';
import { createGetURLAsMarkdown } from '../../../src/mcp/get-url-as-markdown.ts';
import { MCPServer } from '../../../src/mcp/mcp-server.ts';
import type { WebsiteFetcher, WebsiteFetchResult } from '../../../src/website-fetcher/website-fetcher.ts';
import { NoAuthProvider } from '../doubles/auth/no-auth-provider.ts';
import { eraNegotiation, type McpProtocolEra } from '../drivers/mcp/mcp-protocol-eras.ts';

export const exactMarkdown = '# Exact Markdown\n\nNo extra text.\n';
export const validFetchArguments = { url: 'HTTPS://Example.COM/Page?private-query=yes#private-fragment', reason: 'Read the page for this task' };
const resourceUrl = 'https://thermus.example/mcp';

export async function openFetchSite(t: TestContext, era: McpProtocolEra, options: {
  fetcher?: WebsiteFetcher;
  pipeline?: Pick<HtmlToMarkdownPipeline, 'process'>;
  resolver?: AccessResolver;
  headers?: Record<string, string>;
  httpSignal?: AbortSignal;
} = {}) {
  const records: string[] = [];
  const completed = Promise.withResolvers<string>();
  const fetchCalls: { url: string; signal: AbortSignal | undefined }[] = [];
  const pipelineCalls: { page: WebsiteFetchResult; signal: AbortSignal | undefined }[] = [];
  const provider = new NoAuthProvider(new URL(resourceUrl));
  const operation = createGetURLAsMarkdown({
    fetcher: { fetchURL: async (url, signal) => {
      fetchCalls.push({ url, signal });
      return options.fetcher?.fetchURL(url, signal) ?? { requestedUrl: url, finalUrl: 'https://example.net/final', html: '<p>Source</p>' };
    } },
    pipeline: { process: async (page, signal) => {
      pipelineCalls.push({ page, signal });
      return options.pipeline?.process(page, signal) ?? { ...page, removed: 0, skipped: 0, markdown: exactMarkdown };
    } },
  });
  const server = new MCPServer({
    auth: { verifier: provider, accessResolver: options.resolver ?? provider, resourceMetadataUrl: 'https://thermus.example/.well-known/oauth-protected-resource/mcp', expectedResource: new URL(resourceUrl) },
    buildServer: (context, lifetime) => createFetchToolServer(context, { operation, logger: { info: (entry) => { records.push(entry); completed.resolve(entry); }, error: (entry) => { records.push(entry); completed.resolve(entry); } } }, lifetime),
    reportFailure: () => {},
  });
  const listener = await startHttpServer((request) => server.fetch(request), { listen: { host: '127.0.0.1', port: 0 }, publicBaseUrl: resourceUrl });
  const client = new Client({ name: 'fetch-tool-acceptance', version: '0.0.0' }, {
    versionNegotiation: { ...eraNegotiation(era), probe: { timeoutMs: 5_000, maxRetries: 0 } },
  });
  t.after(async () => { await client.close(); await listener.close(); await server.close(); });
  const url = new URL('mcp', listener.url);
  await client.connect(new StreamableHTTPClientTransport(url, {
    authProvider: { token: async () => 'arbitrary-test-token-contents' }, requestInit: { headers: options.headers },
    fetch: options.httpSignal === undefined ? undefined : (url, init) => fetch(url, { ...init, signal: AbortSignal.any([options.httpSignal as AbortSignal, ...(init?.signal ? [init.signal] : [])]) }),
  }), { signal: t.signal, timeout: 5_000 });
  assert.equal(client.getNegotiatedProtocolVersion(), era);
  return { client, url, records, fetchCalls, pipelineCalls, server, listener, firstCompletion: completed.promise };
}
