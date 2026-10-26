import type { TestContext } from 'node:test';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createHostedToolOperations, createToolOperations, fetchToolServers } from '../../../src/app/fetch-tool.ts';
import { routeHostedRequests } from '../../../src/app/application.ts';
import { startHttpServer } from '../../../src/runtime/http/server.ts';
import { MCPServer } from '../../../src/interfaces/mcp/mcp-server.ts';
import { NoAuthProvider } from '../doubles/auth/no-auth-provider.ts';
import { trustedAdRulesFile } from '../fixtures/ad-rules.ts';
import { connectMcpClient } from '../drivers/mcp/mcp-sdk-client.ts';
import type { McpProtocolEra } from '../drivers/mcp/mcp-protocol-eras.ts';
import { completionRecordsIn, stepRecordsIn } from '../drivers/operator-log.ts';

// The settings add to the trusted ad rules file, for example OPERATION_CAPACITY of the hosted edition.
export async function openSearchSite(t: TestContext, era: McpProtocolEra, edition: 'hosted' | 'self-hosted', settings: Readonly<Record<string, string>> = {}) {
  const records: string[] = [];
  const logger = { info: (record: string) => { records.push(record); }, error: (record: string) => { records.push(record); } };
  const operations = (edition === 'hosted' ? createHostedToolOperations : createToolOperations)({ AD_RULES_FILE: trustedAdRulesFile, ...settings }, logger);
  const resource = new URL('https://thermus.example/mcp');
  const provider = new NoAuthProvider(resource);
  const server = new MCPServer({
    auth: { verifier: provider, accessResolver: provider, expectedResource: resource, resourceMetadataUrl: 'https://thermus.example/.well-known/oauth-protected-resource/mcp' },
    buildServer: fetchToolServers(operations, logger), reportFailure: () => {},
  });
  const handle = edition === 'hosted' ? routeHostedRequests({ publicBaseUrl: 'https://thermus.example/', mcpResourceUrl: resource.href, resourceMetadataUrl: 'https://thermus.example/.well-known/oauth-protected-resource/mcp' }, { mcp: (request) => server.fetch(request), account: async () => new Response('Not Found', { status: 404 }) }) : (request: Request) => server.fetch(request);
  const listener = await startHttpServer(handle, { listen: { host: '127.0.0.1', port: 0 }, publicBaseUrl: resource.href });
  t.after(async () => { const draining = listener.close(); await server.close(); await draining; });
  const url = new URL('mcp', listener.url);
  const client = await connectMcpClient(t, new StreamableHTTPClientTransport(url, { authProvider: { token: async () => 'search-acceptance-token' } }), { era, probe: true });
  t.after(() => client.close());
  return { client, provider, server, listener, url, records,
    completions: () => completionRecordsIn(records.join('\n')),
    stages: () => stepRecordsIn(records.join('\n')) };
}
