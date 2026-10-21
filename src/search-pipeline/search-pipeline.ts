import { requirePermission, type RequestContext } from '../auth/access-context.ts';
import type { SearchDocument, SearchEngine } from '../search-engine/search-engine.ts';
import { WebsiteFetchFailure, type WebsiteFetchResult } from '../website-fetcher/website-fetcher.ts';
import { assertOperationId, type ExecutionContext } from '../page-fetch/execution-context.ts';
import type { IncomingStep, OutgoingStep } from '../page-fetch/pipeline-step.ts';
import { reportRendererFailure, type RendererFailureReports } from '../page-fetch/renderer-failure-reports.ts';
import type { StepRecordSink } from '../page-fetch/step-record.ts';
import { throwIfSearchCancelled } from './search-cancellation.ts';
import { SearchQuery } from './search-query.ts';
import { SearchFailure } from './search-failure.ts';
import { executeOutgoingStep } from './execute-outgoing-step.ts';
import { executeIncomingStep } from './execute-incoming-step.ts';

export type SearchOutcome =
  | { status: 'released'; markdown: string }
  | { status: 'withheld'; code: 'scan_failed' | 'scan_limit' };

interface SearchDependencies extends RendererFailureReports {
  engine: SearchEngine;
  outgoing: OutgoingStep;
  incoming: IncomingStep;
  records: StepRecordSink;
}

export class SearchPipeline {
  readonly #dependencies: SearchDependencies;

  constructor(dependencies: SearchDependencies) { this.#dependencies = dependencies; }

  async search(query: string, context: RequestContext, execution: ExecutionContext): Promise<SearchOutcome> {
    const { signal } = execution;
    throwIfSearchCancelled(signal);
    requirePermission(context, 'product:access');
    const input = checkedQuery(query);
    assertOperationId(execution.operationId);
    try {
      await executeOutgoingStep(input.value, execution, this.#dependencies);
      throwIfSearchCancelled(signal);
      const document = await this.searchDocument(input, execution);
      throwIfSearchCancelled(signal);
      const outcome = await executeIncomingStep(document.page, execution, this.#dependencies);
      throwIfSearchCancelled(signal);
      if (outcome.status === 'withheld') return outcome;
      if (document.kind === 'no_results') return { status: 'released', markdown: 'No search results.' };
      if (!/\S/u.test(outcome.markdown)) throw new Error('Search processing failed');
      return outcome;
    } catch (error) {
      throwIfSearchCancelled(signal, error);
      throw error;
    }
  }

  private async searchDocument(query: SearchQuery, execution: ExecutionContext): Promise<SearchDocument> {
    let result: unknown;
    try {
      result = await this.#dependencies.engine.search(query.value, execution.signal);
    } catch (error) {
      throwIfSearchCancelled(execution.signal, error);
      const failure = safeSearchFailure(error);
      try {
        if (error instanceof WebsiteFetchFailure) reportRendererFailure(this.#dependencies, error, execution.operationId);
      } catch { /* An unreadable error cannot change the fixed failure. */ }
      throwIfSearchCancelled(execution.signal);
      throw failure;
    }
    throwIfSearchCancelled(execution.signal);
    try {
      const document = checkedDocument(result);
      throwIfSearchCancelled(execution.signal);
      return document;
    } catch {
      throwIfSearchCancelled(execution.signal);
      throw new SearchFailure();
    }
  }
}

function checkedQuery(value: unknown): SearchQuery {
  try { return new SearchQuery(value); }
  catch { throw new Error('Invalid tool arguments'); }
}

function checkedDocument(value: unknown): SearchDocument {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new SearchFailure();
  const document = value as SearchDocument;
  const page = document.page;
  const kind = document.kind;
  if (!Object.hasOwn(value, 'kind') || !Object.hasOwn(value, 'page') || (kind !== 'results' && kind !== 'no_results')
    || !isPage(page)) throw new SearchFailure();
  return { page, kind };
}

function isPage(value: unknown): value is WebsiteFetchResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const page = value as Record<string, unknown>;
  return ['requestedUrl', 'finalUrl', 'html'].every((field) => Object.hasOwn(page, field) && typeof page[field] === 'string');
}

function safeSearchFailure(error: unknown): SearchFailure {
  try { return new SearchFailure(error instanceof WebsiteFetchFailure ? error.diagnostic : undefined); }
  catch { return new SearchFailure(); }
}
