import type { CallToolResult } from '@modelcontextprotocol/server';
import type { RequestContext } from '../../accounts/identity/access-context.ts';
import type { ExecutionContext } from '../../pipelines/execution/execution-context.ts';
import type { SearchOutcome } from '../../pipelines/search/search-pipeline.ts';

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
