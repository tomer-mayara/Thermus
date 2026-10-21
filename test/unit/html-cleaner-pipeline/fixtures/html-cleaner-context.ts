import type { HtmlProcessingContext } from '../../../../src/pipelines/html-processing/html-to-markdown-pipeline.ts';

export function createContext(html: string, overrides: Partial<HtmlProcessingContext> = {}): HtmlProcessingContext {
  return {
    requestedUrl: 'https://example.com/start',
    finalUrl: 'https://example.com/final',
    html,
    removed: 0,
    skipped: 0,
    ...overrides,
  };
}

export function createContextForUrl(html: string, url = 'https://example.com/'): HtmlProcessingContext {
  return createContext(html, { requestedUrl: url, finalUrl: url });
}
