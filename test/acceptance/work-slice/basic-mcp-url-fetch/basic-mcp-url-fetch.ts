// The basic MCP URL fetch work slice: a manual run with the mock provider and Axiom logs, not a test. See README.md here.
// This file is the entry point of the slice and also exports its composition for the tests. It runs only when it is
// executed directly, with the guard of src/index.ts, so that the tests can import it.
// Run it from the repository root: pnpm work-slice:basic-mcp-url-fetch
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { composeApplication, operatorFailureReporter, routeLocalRequests, type Application, type ApplicationLogger } from '../../../../src/application.ts';
import { loadListenAddress, loadPublicUrls, type PublicUrls } from '../../../../src/config/deployment-config.ts';
import { createFetchOperation, fetchToolServers } from '../../../../src/fetch-tool.ts';
import { assertHostedRenderer } from '../../../../src/hosted-renderer-startup.ts';
import { serveApplication } from '../../../../src/index.ts';
import { ConsoleLogger } from '../../../../src/logging/console-logger.ts';
import { MCPServer } from '../../../../src/mcp/mcp-server.ts';
import { NoAuthProvider } from '../../../support/doubles/auth/no-auth-provider.ts';
import { axiomTestSettings, openAxiomLogging } from '../../../support/in-process/axiom-test-export.ts';
import { fetchOperationSpy } from '../../../support/doubles/mcp/fetch-operation-spy.ts';

type Environment = Readonly<Record<string, string | undefined>>;

const axiomDatasetPage = 'https://app.axiom.co/thermus-ai-spao/datasets/system-log-test';

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  process.exitCode = await run(new ConsoleLogger());
}

// Production refuses to own only the mock provider and the page-text lines, so this is the composition root of the
// slice. The slice has no OAuth provider and no pages, so their paths are not found.
export function createWorkSliceApplication(environment: Environment, logger: ApplicationLogger): Application {
  const urls = loadPublicUrls(environment, 'self-hosted');
  const operation = fetchOperationSpy(createFetchOperation(environment, logger), logger);
  const provider = new NoAuthProvider(new URL(urls.mcpResourceUrl));
  const mcp = new MCPServer({
    auth: {
      verifier: provider,
      accessResolver: provider,
      resourceMetadataUrl: urls.resourceMetadataUrl,
      expectedResource: new URL(urls.mcpResourceUrl),
    },
    buildServer: fetchToolServers(operation, logger),
    reportFailure: operatorFailureReporter(logger),
  });
  const handle = routeLocalRequests(urls, { mcp: (request) => mcp.fetch(request), provider: notFound, pages: { handles: () => false, handle: notFound } });
  return composeApplication(handle, mcp);
}

async function notFound(): Promise<Response> {
  return new Response('Not Found', { status: 404 });
}

async function run(consoleLog: ConsoleLogger): Promise<number> {
  try {
    await serveWorkSlice();
    return 0;
  } catch (error) {
    consoleLog.fatal(error);
    return 1;
  }
}

async function serveWorkSlice(): Promise<void> {
  const listen = loadListenAddress(process.env);
  if (listen.port === 0) {
    throw new Error('LISTEN_PORT must not be 0 for the work slice: the client URL must be known before the server listens.');
  }
  const urls = loadPublicUrls(process.env, 'self-hosted');
  await assertHostedRenderer(process.env.LIGHTPANDA_BIN);
  const axiom = axiomTestSettings();
  const scopeName = `thermus-work-slice-${randomUUID()}`;
  await using owned = new AsyncDisposableStack();
  const logging = owned.adopt(openAxiomLogging(axiom, scopeName), (opened) => opened.close());
  process.stdout.write(instructions(urls, scopeName));
  await serveApplication(() => createWorkSliceApplication(process.env, logging.logger), {
    listen, publicBaseUrl: urls.publicBaseUrl, logger: logging.logger, signals: process,
  });
}

function instructions(urls: PublicUrls, scopeName: string): string {
  const endpoint = urls.mcpResourceUrl;
  return [
    '',
    `MCP endpoint: ${endpoint}`,
    '',
    'Add the server to Claude Code. Run this command in the directory where you start Claude Code, or add --scope user:',
    `  claude mcp add --transport http thermus-local ${endpoint} --header "Authorization: Bearer local-dev"`,
    'The client must send this header with each request. The mock provider accepts each Bearer token.',
    'Then start a new Claude Code session, because a session reads the tool list when it starts.',
    '',
    'Ask, for example:',
    '  Use the thermus-local tool getURLAsMarkdown to read https://example.com/ and tell me its first heading.',
    '',
    `Watch the log in Axiom: ${axiomDatasetPage}`,
    `Scope name of this run: ${scopeName}`,
    'APL filter:',
    `  ['system-log-test'] | where ['scope.name'] == "${scopeName}" | sort by _time asc`,
    'If the filter finds nothing, use this search:',
    `  ['system-log-test'] | search "work-slice fetch"`,
    '',
    'The server starts after these lines. The log goes to Axiom only. A FATAL line here means that the start failed.',
    'Stop with Ctrl+C.',
    '',
  ].join('\n');
}
