import { CleanHtmlToMarkdownDefuddle } from '../../../src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.ts';
import { HtmlToMarkdownPipeline } from '../../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';
import { PromptInjectionRemoverSanitizer } from '../../../src/html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.ts';

export function createPipeline(): HtmlToMarkdownPipeline {
  return new HtmlToMarkdownPipeline([
    new PromptInjectionRemoverSanitizer(),
    new CleanHtmlToMarkdownDefuddle(),
  ]);
}
