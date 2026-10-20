import type { WebsiteFetchResult } from '../website-fetcher/website-fetcher.ts';

export interface SearchDocument {
  page: WebsiteFetchResult;
  kind: 'results' | 'no_results';
}

export interface SearchEngine {
  search(query: string, signal: AbortSignal): Promise<SearchDocument>;
}
