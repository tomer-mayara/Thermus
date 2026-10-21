import { requirePermission, type RequestContext } from '../../accounts/identity/access-context.ts';
import { WebsiteFetchFailure, type WebsiteFetcher } from '../providers/website-fetcher/website-fetcher.ts';
import { isValidFetchUrl } from './fetch-url.ts';
import { assertOperationId, type ExecutionContext } from '../execution/execution-context.ts';
import { reportRendererFailure, type RendererFailureReports } from '../providers/website-fetcher/renderer-failure-reports.ts';
import { executeOutgoingStep } from './execute-outgoing-step.ts';
import { executeIncomingStep } from './execute-incoming-step.ts';
import type { OutgoingStep, IncomingStep } from '../execution/pipeline-step.ts';
import type { StepRecordSink } from '../execution/step-record.ts';
import { PageFetchFailure } from './fetch-failure.ts';

export type FetchPageOutcome =
  | { status: 'released'; markdown: string }
  | { status: 'withheld'; code: 'scan_failed' | 'scan_limit' };
export type FetchPage = (url: string, context: RequestContext, execution: ExecutionContext) => Promise<FetchPageOutcome>;

export function createFetchPage(dependencies: RendererFailureReports & {
  fetcher: WebsiteFetcher;
  incoming: IncomingStep;
  outgoing: OutgoingStep;
  records: StepRecordSink;
}): FetchPage {
  return async (url, context, execution) => {
    const { signal } = execution;
    throwIfCancelled(signal);
    requirePermission(context, 'product:access');
    if (!isValidFetchUrl(url)) throw new Error('Invalid tool arguments');
    assertOperationId(execution.operationId);

    const outgoingUrl = await executeOutgoingStep(url, execution, dependencies);
    throwIfCancelled(signal);

    let page;
    try {
      page = await dependencies.fetcher.fetchURL(outgoingUrl, signal);
    } catch (error) {
      throwIfCancelled(signal, error);
      reportRendererFailure(dependencies, error, execution.operationId);
      throw new PageFetchFailure(error instanceof WebsiteFetchFailure ? error.diagnostic : undefined);
    }

    throwIfCancelled(signal);
    const outcome = await executeIncomingStep(page, execution, dependencies);
    throwIfCancelled(signal);
    return outcome;
  };
}

function throwIfCancelled(signal: AbortSignal, error?: unknown): void {
  if (signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
    throw new DOMException('Request cancelled', 'AbortError');
  }
}
