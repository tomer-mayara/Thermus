import type { TestContext } from 'node:test';
import { StreamableHTTPClientTransport, type Client } from '@modelcontextprotocol/client';
import type { AccessResolver } from '../../../src/auth/access-context.ts';
import type { HtmlToMarkdownPipeline } from '../../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';
import { startHttpServer } from '../../../src/http/server.ts';
import { createFetchToolServer } from '../../../src/mcp/fetch-tool-server.ts';
import { composeFetchOperation } from './fetch-operation.ts';
import { MCPServer } from '../../../src/mcp/mcp-server.ts';
import type { WebsiteFetcher, WebsiteFetchResult } from '../../../src/website-fetcher/website-fetcher.ts';
import { NoAuthProvider } from '../doubles/auth/no-auth-provider.ts';
import type { McpProtocolEra } from '../drivers/mcp/mcp-protocol-eras.ts';
import { connectMcpClient } from '../drivers/mcp/mcp-sdk-client.ts';
import { completionLinesIn } from '../drivers/operator-log.ts';
import type { PipelineStep } from '../../../src/page-fetch/pipeline-step.ts';
import type { StepRecordSink } from '../../../src/page-fetch/step-record.ts';

export const exactMarkdown = '# Exact Markdown\n\nNo extra text.\n';
export const validFetchArguments = { url: 'HTTPS://Example.COM/Page?private-query=yes#private-fragment', reason: 'Read the page for this task' };
const resourceUrl = 'https://thermus.example/mcp';

export async function openFetchSite(t: TestContext, era: McpProtocolEra, options: {
  fetcher?: WebsiteFetcher;
  pipeline?: Pick<HtmlToMarkdownPipeline, 'process'>;
  resolver?: AccessResolver;
  headers?: Record<string, string>;
  httpSignal?: AbortSignal;
  outgoing?: PipelineStep<string, string>;
  incoming?: PipelineStep<WebsiteFetchResult, string>;
  stepSink?: StepRecordSink;
} = {}) {
  const records: string[] = [];
  const completed = Promise.withResolvers<string>();
  const record = (entry: string) => {
    records.push(entry);
    if (completionLinesIn(entry).length === 1) completed.resolve(entry);
  };
  const fetchCalls: { url: string; signal: AbortSignal | undefined }[] = [];
  const pipelineCalls: { page: WebsiteFetchResult; signal: AbortSignal | undefined }[] = [];
  const provider = new NoAuthProvider(new URL(resourceUrl));
  const operation = composeFetchOperation({
    outgoing: options.outgoing,
    incoming: options.incoming,
    records: options.stepSink ?? { record: (event) => record(JSON.stringify(event)) },
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
    buildServer: (context, lifetime) => createFetchToolServer(context, { operation, logger: { info: record, error: record } }, lifetime),
    reportFailure: () => {},
  });
  const listener = await startHttpServer((request) => server.fetch(request), { listen: { host: '127.0.0.1', port: 0 }, publicBaseUrl: resourceUrl });
  let client: Client | undefined = undefined;
  t.after(async () => { await client?.close(); await listener.close(); await server.close(); });
  const url = new URL('mcp', listener.url);
  client = await connectMcpClient(t, new StreamableHTTPClientTransport(url, {
    authProvider: { token: async () => 'arbitrary-test-token-contents' }, requestInit: { headers: options.headers },
    fetch: options.httpSignal === undefined ? undefined : (url, init) => fetch(url, { ...init, signal: AbortSignal.any([options.httpSignal as AbortSignal, ...(init?.signal ? [init.signal] : [])]) }),
  }), { era, probe: true });
  return { client, url, records, record, completionLines: (operationId?: string) => completionLinesIn(records.join('\n'), operationId), fetchCalls, pipelineCalls, server, listener, firstCompletion: completed.promise };
}
