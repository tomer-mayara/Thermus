import type { ApplicationLogger } from './application.ts';
import { AdRulesFileError, readAdRulesFile } from './config/ad-rules-file.ts';
import { CleanHtmlAdsAdblockRs } from './html-cleaner-pipeline/ad-cleaner/adb/clean-html-ads-adblock-rs.ts';
import { HtmlToMarkdownPipeline } from './html-cleaner-pipeline/html-to-markdown-pipeline.ts';
import { CleanHtmlToMarkdownDefuddle } from './html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.ts';
import { PromptInjectionRemoverSanitizer } from './html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.ts';
import { createFetchToolServer } from './mcp/fetch-tool-server.ts';
import { createGetURLAsMarkdown, type RendererSetupFailure } from './mcp/get-url-as-markdown.ts';
import type { RequestServerBuilder } from './mcp/mcp-server.ts';
import { WebsiteFetcherLightpanda } from './website-fetcher/website-fetcher-lightpanda.ts';

type Environment = Readonly<Record<string, string | undefined>>;

// Only the server loads this module. It reads AD_RULES_FILE and makes the renderer and the cleaning pipeline one
// time. Each MCP request gets its own tool server that uses them. Startup does not run or check the renderer.
export function fetchToolServers(environment: Environment, logger: ApplicationLogger): RequestServerBuilder {
  const pipeline = new HtmlToMarkdownPipeline([
    adCleaner(readAdRulesFile(environment)),
    new PromptInjectionRemoverSanitizer(),
    new CleanHtmlToMarkdownDefuddle(),
  ]);
  const operation = createGetURLAsMarkdown({
    fetcher: new WebsiteFetcherLightpanda(environment.LIGHTPANDA_BIN),
    pipeline,
    reportRendererSetupFailure: rendererSetupReporter(logger),
  });
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
