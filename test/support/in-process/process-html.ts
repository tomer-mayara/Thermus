import { CleanHtmlAdsAdblockRs } from '../../../src/html-cleaner-pipeline/ad-cleaner/adb/clean-html-ads-adblock-rs.ts';
import { CleanHtmlToMarkdownDefuddle } from '../../../src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.ts';
import { HtmlToMarkdownPipeline, type HtmlProcessingContext } from '../../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';
import { PromptInjectionRemoverSanitizer } from '../../../src/html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.ts';
import { elementHidingRules } from '../fixtures/ad-rules.ts';

export async function processHtml(
  html: string,
  url = 'https://example.com/',
): Promise<HtmlProcessingContext> {
  const pipeline = new HtmlToMarkdownPipeline([
    new CleanHtmlAdsAdblockRs(elementHidingRules),
    new PromptInjectionRemoverSanitizer(),
    new CleanHtmlToMarkdownDefuddle(),
  ]);
  return pipeline.process({ requestedUrl: url, finalUrl: url, html });
}
