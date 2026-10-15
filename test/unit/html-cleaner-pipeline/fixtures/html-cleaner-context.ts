import type { Ctx } from '../../../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';

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

export function createContextForUrl(html: string, url = 'https://example.com/'): Ctx {
  return createContext(html, { requestedUrl: url, finalUrl: url });
}
