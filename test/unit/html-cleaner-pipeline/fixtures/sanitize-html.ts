import { PromptInjectionRemoverSanitizer } from '../../../../src/pipelines/html-processing/prompt-injection-remover/prompt-injection-remover-sanitizer.ts';
import { createContext } from './html-cleaner-context.ts';

export async function sanitizeHtml(html: string) {
  return new PromptInjectionRemoverSanitizer().invoke(createContext(html));
}
