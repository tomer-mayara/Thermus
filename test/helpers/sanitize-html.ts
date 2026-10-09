import { PromptInjectionRemoverSanitizer } from '../../src/html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.ts';

export async function sanitizeHtml(html: string) {
  return new PromptInjectionRemoverSanitizer().invoke({
    url: 'https://example.com/', html, removed: 0, skipped: 0,
  });
}
