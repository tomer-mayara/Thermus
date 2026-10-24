import type { RequestContext } from '../../accounts/identity/access-context.ts';

export type CompletionStatus = 'success' | 'invalid_arguments' | 'unknown_tool' | 'access_denied' | 'fetch_failed' | 'processing_failed' | 'cancelled' | 'busy' | 'search_failed' | 'withheld';

export function formatToolCompletion(context: RequestContext, call: { operationId: string; name: string; status: CompletionStatus; durationMs: number }): string {
  return JSON.stringify({
    event: 'mcp.tool.completed',
    operationId: call.operationId,
    authority: context.user.authority,
    subject: context.user.subject,
    tenantId: context.tenantId,
    tool: call.name === 'getURLAsMarkdown' || call.name === 'search' ? call.name : 'unknown',
    status: call.status,
    durationMs: call.durationMs,
  });
}
