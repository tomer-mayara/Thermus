import type { ApplicationLogger } from './application.ts';
import { AdRulesFileError, readAdRulesFile } from './config/ad-rules-file.ts';
import { CleanHtmlAdsAdblockRs } from './html-cleaner-pipeline/ad-cleaner/adb/clean-html-ads-adblock-rs.ts';
import { HtmlToMarkdownPipeline } from './html-cleaner-pipeline/html-to-markdown-pipeline.ts';
import { ProcessHtmlStep } from './html-cleaner-pipeline/process-html-step.ts';
import { CleanHtmlToMarkdownDefuddle } from './html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.ts';
import { PromptInjectionRemoverSanitizer } from './html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.ts';
import { createFetchToolServer } from './mcp/fetch-tool-server.ts';
import { createGetURLAsMarkdown, type FetchOperation } from './mcp/get-url-as-markdown.ts';
import type { RequestServerBuilder } from './mcp/mcp-server.ts';
import { createFetchPage } from './page-fetch/fetch-page.ts';
import { ObserveRequestStep } from './page-fetch/observe-request-step.ts';
import type { RendererSetupFailure } from './page-fetch/renderer-failure-reports.ts';
import { WebsiteFetcherLightpanda } from './website-fetcher/website-fetcher-lightpanda.ts';

type Environment = Readonly<Record<string, string | undefined>>;

// Only a server composition loads this module. createFetchOperation reads AD_RULES_FILE and makes the renderer and
// the cleaning pipeline one time. It does not run or check the renderer. fetchToolServers gives each MCP request its
// own tool server, and each tool server uses that one operation.
export function createFetchOperation(environment: Environment, logger: ApplicationLogger): FetchOperation {
  const pipeline = new HtmlToMarkdownPipeline([
    adCleaner(readAdRulesFile(environment)),
    new PromptInjectionRemoverSanitizer(),
    new CleanHtmlToMarkdownDefuddle(),
  ]);
  return createGetURLAsMarkdown(createFetchPage({
    outgoing: new ObserveRequestStep(),
    records: { record: (event) => logger.info(JSON.stringify(event)) },
    fetcher: new WebsiteFetcherLightpanda(environment.LIGHTPANDA_BIN),
    incoming: new ProcessHtmlStep(pipeline),
    reportRendererSetupFailure: rendererSetupReporter(logger),
    reportRendererReadinessTimeout: ({ category, budgetMs }) => {
      logger.error(JSON.stringify({ event: 'renderer.fetch.failed', category, budgetMs }));
    },
  }));
}

export function fetchToolServers(operation: FetchOperation, logger: ApplicationLogger): RequestServerBuilder {
  return (context, lifetime) => createFetchToolServer(context, { operation, logger }, lifetime);
}

// One line for each code in the life of the server keeps the log short when the renderer stays missing.
function rendererSetupReporter(logger: ApplicationLogger): (failure: RendererSetupFailure) => void {
  const reported = new Set<string>();
  return ({ failure, code }) => {
    if (reported.has(code)) return;
    reported.add(code);
    const problem = failure === 'missing' ? 'is missing' : 'cannot start';
    logger.error(`Renderer setup failure: the Lightpanda executable ${problem} (${code}). Each page fetch fails until you correct this. See docs/lightpanda-runtime.md.`);
  };
}

// A native parser error can repeat rule text, so the startup error keeps that error only as its cause.
function adCleaner(rules: string): CleanHtmlAdsAdblockRs {
  try {
    return new CleanHtmlAdsAdblockRs(rules);
  } catch (cause) {
    throw new AdRulesFileError('The ad cleaner could not load the rules in AD_RULES_FILE.', { cause });
  }
}
