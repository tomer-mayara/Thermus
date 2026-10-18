import { requirePermission, type RequestContext } from '../auth/access-context.ts';
import type { WebsiteFetcher } from '../website-fetcher/website-fetcher.ts';
import { isValidFetchUrl } from './fetch-url.ts';
import { assertOperationId, type ExecutionContext } from './execution-context.ts';
import type { PageProcessor } from './page-processor.ts';
import { reportRendererFailure, type RendererFailureReports } from './renderer-failure-reports.ts';

type FetchPageOutcome = { status: 'released'; markdown: string };
export type FetchPage = (url: string, context: RequestContext, execution: ExecutionContext) => Promise<FetchPageOutcome>;

export function createFetchPage(dependencies: RendererFailureReports & {
  fetcher: WebsiteFetcher;
  processor: PageProcessor;
}): FetchPage {
  return async (url, context, execution) => {
    const { signal } = execution;
    throwIfCancelled(signal);
    requirePermission(context, 'product:access');
    if (!isValidFetchUrl(url)) throw new Error('Invalid tool arguments');
    assertOperationId(execution.operationId);

    let page;
    try {
      page = await dependencies.fetcher.fetchURL(url, signal);
    } catch (error) {
      throwIfCancelled(signal, error);
      reportRendererFailure(dependencies, error);
      throw new Error('Page fetch failed');
    }

    throwIfCancelled(signal);
    try {
      const markdown = await dependencies.processor.process(page, signal);
      throwIfCancelled(signal);
      return { status: 'released', markdown };
    } catch (error) {
      throwIfCancelled(signal, error);
      throw new Error('Page processing failed');
    }
  };
}

function throwIfCancelled(signal: AbortSignal, error?: unknown): void {
  if (signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
    throw new DOMException('Request cancelled', 'AbortError');
  }
}
