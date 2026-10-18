import type { WebsiteFetchResult } from '../website-fetcher/website-fetcher.ts';

export interface PageProcessor {
  process(page: WebsiteFetchResult, signal: AbortSignal): Promise<string>;
}
