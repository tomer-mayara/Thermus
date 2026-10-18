import type { RequestContext } from '../auth/access-context.ts';
import type { FetchPage } from '../page-fetch/fetch-page.ts';

export type FetchOperation = (url: string, context: RequestContext, signal: AbortSignal) => Promise<string>;

export function createGetURLAsMarkdown(fetchPage: FetchPage): FetchOperation {
  return async (url, context, signal) => (await fetchPage(url, context, signal)).markdown;
}
