import { PromptInjectionRemoverSanitizer } from '../../src/html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.js';
import { createContext } from '../support/html-cleaner-context.js';
export async function sanitizeHtml(html) {
    return new PromptInjectionRemoverSanitizer().invoke(createContext(html));
}
//# sourceMappingURL=sanitize-html.js.map