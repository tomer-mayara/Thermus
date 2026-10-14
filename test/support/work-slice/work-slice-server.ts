import { composeApplication, operatorFailureReporter } from '../../../src/application.ts';
import type { RequestContext } from '../../../src/auth/access-context.ts';
import { CleanHtmlAdsAdblockRs } from '../../../src/html-cleaner-pipeline/ad-cleaner/adb/clean-html-ads-adblock-rs.ts';
import { HtmlToMarkdownPipeline } from '../../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';
import { CleanHtmlToMarkdownDefuddle } from '../../../src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.ts';
import { PromptInjectionRemoverSanitizer } from '../../../src/html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.ts';
import { startHttpServer, type FetchHandler } from '../../../src/http/server.ts';
import { createFetchToolServer } from '../../../src/mcp/fetch-tool-server.ts';
import { createGetURLAsMarkdown, type RendererSetupFailure } from '../../../src/mcp/get-url-as-markdown.ts';
import { MCPServer } from '../../../src/mcp/mcp-server.ts';
import { WebsiteFetcherLightpanda } from '../../../src/website-fetcher/website-fetcher-lightpanda.ts';
import { NoAuthProvider } from '../auth/no-auth-provider.ts';
import type { WorkSliceSettings } from './work-slice-settings.ts';

export interface WorkSliceLog {
  info(message: string): void;
  error(message: string): void;
}

// url is the listener address, not the public base URL. Each close() call after the first gets the result of the first call.
export interface WorkSliceServer {
  readonly url: URL;
  close(): Promise<void>;
}

// The Markdown of the completed line is cut at this many code points.
export const MARKDOWN_LOG_LIMIT = 64 * 1024;

export type FetchOperation = (url: string, context: RequestContext, signal: AbortSignal) => Promise<string>;

export function observeFetches(operation: FetchOperation, logger: WorkSliceLog, limit = MARKDOWN_LOG_LIMIT): FetchOperation {
  return async (url, context, signal) => {
    logger.info(`work-slice fetch started: ${url}`);
    let markdown: string;
    try {
      markdown = await operation(url, context, signal);
    } catch (error) {
      logger.error(`work-slice fetch failed: ${url}: ${error instanceof Error ? error.message : String(error)}`);
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

export function routeRequests(mcpPath: string, mcp: FetchHandler): FetchHandler {
  return async (request) => {
    if (new URL(request.url).pathname === mcpPath) return mcp(request);
    return new Response('Not Found', { status: 404 });
  };
}

// A second copy of the composition of src/fetch-tool.ts, because that composition does not expose the operation.
export async function startWorkSliceServer(settings: WorkSliceSettings, logger: WorkSliceLog): Promise<WorkSliceServer> {
  const operation = observeFetches(fetchOperation(settings, logger), logger);
  const mcp = mcpServer(settings, operation, logger);
  const application = composeApplication(routeRequests(new URL(settings.mcpResourceUrl).pathname, (request) => mcp.fetch(request)), mcp);
  await using untilListening = new AsyncDisposableStack();
  untilListening.defer(() => application.close());
  const listener = await startHttpServer(application.handle, { listen: settings.listen, publicBaseUrl: settings.publicBaseUrl, logger });
  untilListening.move();
  let closing: Promise<void> | undefined;
  // The production close order: listener.close() starts first, then the MCP work stops, and then the listener drains.
  return { url: listener.url, close: () => (closing ??= application.close(listener.close())) };
}

function fetchOperation(settings: WorkSliceSettings, logger: WorkSliceLog): FetchOperation {
  const pipeline = new HtmlToMarkdownPipeline([
    new CleanHtmlAdsAdblockRs(settings.adRules),
    new PromptInjectionRemoverSanitizer(),
    new CleanHtmlToMarkdownDefuddle(),
  ]);
  const fetcher = new WebsiteFetcherLightpanda(settings.lightpandaBin);
  return createGetURLAsMarkdown({ fetcher, pipeline, reportRendererSetupFailure: rendererSetupReporter(logger) });
}

// The words of src/fetch-tool.ts. A slice run is short, so it writes each failure, not one line for each code.
function rendererSetupReporter(logger: WorkSliceLog): (failure: RendererSetupFailure) => void {
  return ({ failure, code }) => {
    const problem = failure === 'missing' ? 'is missing' : 'cannot start';
    logger.error(`Renderer setup failure: the Lightpanda executable ${problem} (${code}). Each page fetch fails until you correct this. See docs/lightpanda-runtime.md.`);
  };
}

function mcpServer(settings: WorkSliceSettings, operation: FetchOperation, logger: WorkSliceLog): MCPServer {
  const provider = new NoAuthProvider(new URL(settings.mcpResourceUrl));
  return new MCPServer({
    auth: {
      verifier: provider,
      accessResolver: provider,
      resourceMetadataUrl: settings.resourceMetadataUrl,
      expectedResource: new URL(settings.mcpResourceUrl),
    },
    buildServer: (context, lifetime) => createFetchToolServer(context, { operation, logger }, lifetime),
    reportFailure: operatorFailureReporter(logger),
  });
}
