import type { CallToolResult } from '@modelcontextprotocol/server';
import type { RequestContext } from '../../accounts/identity/access-context.ts';
import type { ExecutionContext } from '../../pipelines/execution/execution-context.ts';
import { SearchFailure } from '../../pipelines/search/search-failure.ts';
import type { SearchOutcome } from '../../pipelines/search/search-pipeline.ts';
import type { CompletionStatus } from './tool-completion-record.ts';

export type SearchOperation = (query: string, context: RequestContext, execution: ExecutionContext) => Promise<SearchOutcome>;

type WithheldOutcome = Extract<SearchOutcome, { status: 'withheld' }>;

export function projectSearchOutcome(outcome: SearchOutcome): CallToolResult {
  try {
    const result = toolResultOf(outcome);
    if (result !== undefined) return result;
  } catch {
    // Malformed operation values must not expose their contents.
  }
  throw new Error('Search processing failed');
}

function toolResultOf(outcome: SearchOutcome): CallToolResult | undefined {
  if (typeof outcome !== 'object' || outcome === null || Array.isArray(outcome)) return undefined;
  const status = outcome.status;
  if (status === 'released') return releasedResult(outcome.markdown);
  return status === 'withheld' ? withheldResult(outcome) : undefined;
}

function releasedResult(markdown: unknown): CallToolResult | undefined {
  return typeof markdown === 'string' && /\S/u.test(markdown) ? { content: [{ type: 'text', text: markdown }] } : undefined;
}

function withheldResult(outcome: WithheldOutcome): CallToolResult | undefined {
  return outcome.code === 'scan_failed' || outcome.code === 'scan_limit'
    ? { content: [{ type: 'text', text: 'Search content withheld' }], isError: true }
    : undefined;
}

export function safeSearchFailure(error: unknown, signal: AbortSignal): { status: CompletionStatus; message: string } {
  let failure: { status: CompletionStatus; message: string } = { status: 'processing_failed', message: 'Search processing failed' };
  try {
    if (signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
      failure = { status: 'cancelled', message: 'Request cancelled' };
    } else if (error instanceof SearchFailure) {
      failure = { status: 'search_failed', message: error.publicMessage };
    } else {
      const failures = {
        'Server busy. Try again later.': 'busy',
        'Invalid tool arguments': 'invalid_arguments',
        'Access denied': 'access_denied',
        'Search failed': 'search_failed',
        'Search processing failed': 'processing_failed',
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
