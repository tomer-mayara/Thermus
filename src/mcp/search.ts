import type { CallToolResult } from '@modelcontextprotocol/server';
import type { RequestContext } from '../auth/access-context.ts';
import type { ExecutionContext } from '../page-fetch/execution-context.ts';
import type { SearchOutcome } from '../search-pipeline/search-pipeline.ts';

export type SearchOperation = (query: string, context: RequestContext, execution: ExecutionContext) => Promise<SearchOutcome>;

export function projectSearchOutcome(outcome: SearchOutcome): CallToolResult {
  try {
    if (typeof outcome !== 'object' || outcome === null || Array.isArray(outcome)) throw new Error();
    const status = outcome.status;
    if (status === 'released') {
      const markdown = outcome.markdown;
      if (typeof markdown === 'string' && /\S/u.test(markdown)) return { content: [{ type: 'text', text: markdown }] };
    }
    if (status === 'withheld' && (outcome.code === 'scan_failed' || outcome.code === 'scan_limit')) {
      return { content: [{ type: 'text', text: 'Search content withheld' }], isError: true };
    }
  } catch {
    // Malformed operation values must not expose their contents.
  }
  throw new Error('Search processing failed');
}
