import type { Ctx } from '../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';

export function createContext(html: string, overrides: Partial<Ctx> = {}): Ctx {
  return { url: 'https://example.com/', html, removed: 0, skipped: 0, ...overrides };
}
