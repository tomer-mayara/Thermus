import { CleanHtmlToMarkdownDefuddle } from '../../../../../../src/pipelines/html-processing/html-to-markdown/clean-html-to-markdown-defuddle.ts';
import { HtmlToMarkdownPipeline } from '../../../../../../src/pipelines/html-processing/html-to-markdown-pipeline.ts';
import { PromptInjectionRemoverSanitizer } from '../../../../../../src/pipelines/html-processing/prompt-injection-remover/prompt-injection-remover-sanitizer.ts';

export function createPipeline() {
  const pipeline = new HtmlToMarkdownPipeline([
    new PromptInjectionRemoverSanitizer(),
    new CleanHtmlToMarkdownDefuddle(),
  ]);
  return {
    process(url: string, html: string) {
      return pipeline.process({ requestedUrl: url, finalUrl: url, html });
    },
  };
}

export async function cleanBody(body: string, head = '') {
  return createPipeline().process('https://example.com/',
    `<!doctype html><html><head>${head}</head><body><main>${body}` +
    '<p>Visible sibling</p></main></body></html>');
}
