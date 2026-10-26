import type { AuditLog } from '../logs/audit/audit-log.ts';
import type { SystemLog } from '../logs/system/system-logger.ts';
import { AdRulesFileError, readAdRulesFile } from '../runtime/config/ad-rules-file.ts';
import { CleanHtmlAdsAdblockRs } from '../pipelines/html-processing/ad-cleaner/adb/clean-html-ads-adblock-rs.ts';
import { HtmlToMarkdownPipeline } from '../pipelines/html-processing/html-to-markdown-pipeline.ts';
import { ProcessHtmlStep } from '../pipelines/html-processing/process-html-step.ts';
import { CleanHtmlToMarkdownDefuddle } from '../pipelines/html-processing/html-to-markdown/clean-html-to-markdown-defuddle.ts';
import { PromptInjectionRemoverSanitizer } from '../pipelines/html-processing/prompt-injection-remover/prompt-injection-remover-sanitizer.ts';
import { BraveHTTPResultCleanup } from '../pipelines/html-processing/search-results/brave-http-result-cleanup.ts';
import { createFetchToolServer, type ToolOperations } from '../interfaces/mcp/fetch-tool-server.ts';
import { createGetURLAsMarkdown } from '../interfaces/mcp/get-url-as-markdown.ts';
import { OperationCapacity } from './operation-capacity.ts';
import { SearchEngineBraveHttp } from '../pipelines/providers/search-engine/search-engine-brave-http.ts';
import { SearchPipeline } from '../pipelines/search/search-pipeline.ts';
import type { RequestServerBuilder } from '../interfaces/mcp/mcp-server.ts';
import { createFetchPage } from '../pipelines/page-fetch/fetch-page.ts';
import { ObserveRequestStep } from '../pipelines/execution/observe-request-step.ts';
import type { StepRecordSink } from '../pipelines/execution/step-record.ts';
import type { RendererFailureReports, RendererSetupFailure } from '../pipelines/providers/website-fetcher/renderer-failure-reports.ts';
import { WebsiteFetcherLightpanda } from '../pipelines/providers/website-fetcher/website-fetcher-lightpanda.ts';

type Environment = Readonly<Record<string, string | undefined>>;

export type { ToolOperations } from '../interfaces/mcp/fetch-tool-server.ts';

// One application owns the renderer, rules, compatible cleaners, and setup reports for both tools.
export function createToolOperations(environment: Environment, logger: SystemLog): ToolOperations {
  const ads = adCleaner(readAdRulesFile(environment));
  const sanitizer = new PromptInjectionRemoverSanitizer();
  const fetcher = new WebsiteFetcherLightpanda(environment.LIGHTPANDA_BIN);
  const shared: RendererFailureReports & { outgoing: ObserveRequestStep; records: StepRecordSink } = {
    outgoing: new ObserveRequestStep(),
    records: { record: (event) => logger.info(JSON.stringify(event)) },
    reportRendererSetupFailure: rendererSetupReporter(logger),
    reportFetchFailure: (failure) => {
      logger.error(JSON.stringify({ event: 'renderer.fetch.failed', ...failure }));
    },
  };
  const fetch = createGetURLAsMarkdown(createFetchPage({
    ...shared,
    fetcher,
    incoming: new ProcessHtmlStep(new HtmlToMarkdownPipeline([ads, sanitizer, new CleanHtmlToMarkdownDefuddle()])),
  }));
  const search = new SearchPipeline({
    ...shared,
    engine: new SearchEngineBraveHttp(fetcher),
    incoming: new ProcessHtmlStep(new HtmlToMarkdownPipeline([ads, sanitizer, new BraveHTTPResultCleanup(), new CleanHtmlToMarkdownDefuddle({ preserveSearchResults: true })])),
  });
  return { fetch, search: (query, context, execution) => search.search(query, context, execution) };
}

export function createHostedToolOperations(environment: Environment, logger: SystemLog): ToolOperations {
  const operations = createToolOperations(environment, logger);
  const capacity = new OperationCapacity(1);
  return { fetch: capacity.wrap(operations.fetch), search: capacity.wrap(operations.search) };
}

export function fetchToolServers(operations: ToolOperations, logger: SystemLog, audit?: Pick<AuditLog, 'toolCompleted'>): RequestServerBuilder {
  return (context, lifetime) => createFetchToolServer(context, { operations, logger, audit }, lifetime);
}

// One line for each code in the life of the server keeps the log short when the renderer stays missing.
function rendererSetupReporter(logger: SystemLog): (failure: RendererSetupFailure) => void {
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
