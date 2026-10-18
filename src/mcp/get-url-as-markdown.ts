import type { RequestContext } from '../auth/access-context.ts';
import type { FetchPage } from '../page-fetch/fetch-page.ts';
import type { ExecutionContext } from '../page-fetch/execution-context.ts';

export type FetchOperation = (url: string, context: RequestContext, execution: ExecutionContext) => Promise<string>;

export function createGetURLAsMarkdown(fetchPage: FetchPage): FetchOperation {
  return async (url, context, execution) => (await fetchPage(url, context, execution)).markdown;
}
