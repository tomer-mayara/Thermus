import { CleanHtmlToMarkdownDefuddle } from '../../../../../../src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.js';
import { HtmlToMarkdownPipeline } from '../../../../../../src/html-cleaner-pipeline/html-to-markdown-pipeline.js';
import { PromptInjectionRemoverSanitizer } from '../../../../../../src/html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.js';
export function createPipeline() {
    const pipeline = new HtmlToMarkdownPipeline([
        new PromptInjectionRemoverSanitizer(),
        new CleanHtmlToMarkdownDefuddle(),
    ]);
    return {
        process(url, html) {
            return pipeline.process({ requestedUrl: url, finalUrl: url, html });
        },
    };
}
export async function cleanBody(body, head = '') {
    return createPipeline().process('https://example.com/', `<!doctype html><html><head>${head}</head><body><main>${body}` +
        '<p>Visible sibling</p></main></body></html>');
}
//# sourceMappingURL=css-pipeline.js.map