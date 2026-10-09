import type { Ctx } from '../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';

export function createContext(html: string, overrides: Partial<Ctx> = {}): Ctx {
  return {
    requestedUrl: 'https://example.com/start',
    finalUrl: 'https://example.com/final',
    html,
    removed: 0,
    skipped: 0,
    ...overrides,
  };
}
