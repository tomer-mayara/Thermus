import type { RequestContext } from '../../accounts/identity/access-context.ts';
import { PageFetchFailure } from '../../pipelines/page-fetch/fetch-failure.ts';
import type { FetchPage } from '../../pipelines/page-fetch/fetch-page.ts';
import type { ExecutionContext } from '../../pipelines/execution/execution-context.ts';
import type { CompletionStatus } from './tool-completion-record.ts';

export type FetchOperation = (url: string, context: RequestContext, execution: ExecutionContext) => Promise<string>;

export function createGetURLAsMarkdown(fetchPage: FetchPage): FetchOperation {
  return async (url, context, execution) => {
    const outcome = await fetchPage(url, context, execution);
    if (outcome.status === 'released' && typeof outcome.markdown === 'string') return outcome.markdown;
    if (outcome.status === 'withheld' && (outcome.code === 'scan_failed' || outcome.code === 'scan_limit')) return '';
    throw new Error('Page processing failed');
  };
}

export function safeFetchFailure(error: unknown, signal: AbortSignal): { status: CompletionStatus; message: string } {
  let failure: { status: CompletionStatus; message: string } = { status: 'processing_failed', message: 'Page processing failed' };
  try {
    if (signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
      failure = { status: 'cancelled', message: 'Request cancelled' };
    } else if (error instanceof PageFetchFailure) {
      failure = { status: 'fetch_failed', message: error.publicMessage };
    } else {
      const failures = {
        'Server busy. Try again later.': 'busy',
        'Invalid tool arguments': 'invalid_arguments',
        'Access denied': 'access_denied',
        'Page fetch failed': 'fetch_failed',
        'Page processing failed': 'processing_failed',
      } as const;
      const message = error instanceof Error ? error.message : undefined;
      if (typeof message === 'string' && Object.hasOwn(failures, message)) {
        failure = { status: failures[message as keyof typeof failures], message };
      }
    }
  } catch {
    // An untrusted error can throw when its fields are read.
  }
  return signal.aborted ? { status: 'cancelled', message: 'Request cancelled' } : failure;
}
