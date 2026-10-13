import { CleanHtmlAdsAdblockRs } from '../../src/html-cleaner-pipeline/ad-cleaner/adb/clean-html-ads-adblock-rs.js';
import { CleanHtmlToMarkdownDefuddle } from '../../src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.js';
import { HtmlToMarkdownPipeline } from '../../src/html-cleaner-pipeline/html-to-markdown-pipeline.js';
import { PromptInjectionRemoverSanitizer } from '../../src/html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.js';
import { elementHidingRules } from '../support/ad-rules.js';
export async function processHtml(html, url = 'https://example.com/') {
    const pipeline = new HtmlToMarkdownPipeline([
        new CleanHtmlAdsAdblockRs(elementHidingRules),
        new PromptInjectionRemoverSanitizer(),
        new CleanHtmlToMarkdownDefuddle(),
    ]);
    return pipeline.process({ requestedUrl: url, finalUrl: url, html });
}
//# sourceMappingURL=process-html.js.map