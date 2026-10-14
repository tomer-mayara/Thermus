import { composeApplication, operatorFailureReporter, routeLocalRequests, type Application, type ApplicationLogger } from '../../../src/application.ts';
import { loadPublicUrls } from '../../../src/config/deployment-config.ts';
import { createFetchOperation, fetchToolServers } from '../../../src/fetch-tool.ts';
import { failureMessage } from '../../../src/logging/failure-message.ts';
import type { FetchOperation } from '../../../src/mcp/get-url-as-markdown.ts';
import { MCPServer } from '../../../src/mcp/mcp-server.ts';
import { NoAuthProvider } from '../auth/no-auth-provider.ts';

type Environment = Readonly<Record<string, string | undefined>>;

// The Markdown of the completed line is cut at this many code points.
export const MARKDOWN_LOG_LIMIT = 64 * 1024;

// Production refuses to own only the mock provider and the page-text lines, so this is the composition root of the
// slice. The slice has no OAuth provider and no pages, so their paths are not found.
export function createWorkSliceApplication(environment: Environment, logger: ApplicationLogger): Application {
  const urls = loadPublicUrls(environment, 'self-hosted');
  const operation = observeFetches(createFetchOperation(environment, logger), logger);
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

export function observeFetches(operation: FetchOperation, logger: ApplicationLogger, limit = MARKDOWN_LOG_LIMIT): FetchOperation {
  return async (url, context, signal) => {
    logger.info(`work-slice fetch started: ${url}`);
    let markdown: string;
    try {
      markdown = await operation(url, context, signal);
    } catch (error) {
      logger.error(`work-slice fetch failed: ${url}: ${failureMessage(error)}`);
      throw error;
    }
    logger.info(completedLine(url, markdown, limit));
    return markdown;
  };
}

function completedLine(url: string, markdown: string, limit: number): string {
  const { count, kept } = firstCodePoints(markdown, limit);
  const cut = count > limit ? `\n[cut: ${count - limit} more characters]` : '';
  return `work-slice fetch completed: ${url} gave ${count} characters of Markdown:\n${kept}${cut}`;
}

// The string iterator gives code points, so the count is not in UTF-16 units and the cut keeps each surrogate pair.
function firstCodePoints(text: string, limit: number): { count: number; kept: string } {
  let count = 0;
  let end = 0;
  for (const codePoint of text) {
    if (count < limit) end += codePoint.length;
    count += 1;
  }
  return { count, kept: text.slice(0, end) };
}

async function notFound(): Promise<Response> {
  return new Response('Not Found', { status: 404 });
}
