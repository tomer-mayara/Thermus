import type { RequestContext } from '../../accounts/identity/access-context.ts';
import type { FetchPage } from '../../pipelines/page-fetch/fetch-page.ts';
import type { ExecutionContext } from '../../pipelines/execution/execution-context.ts';

export type FetchOperation = (url: string, context: RequestContext, execution: ExecutionContext) => Promise<string>;

export function createGetURLAsMarkdown(fetchPage: FetchPage): FetchOperation {
  return async (url, context, execution) => {
    const outcome = await fetchPage(url, context, execution);
    if (outcome.status === 'released' && typeof outcome.markdown === 'string') return outcome.markdown;
    if (outcome.status === 'withheld' && (outcome.code === 'scan_failed' || outcome.code === 'scan_limit')) return '';
    throw new Error('Page processing failed');
  };
}
