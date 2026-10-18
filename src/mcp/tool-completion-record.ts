import type { RequestContext } from '../auth/access-context.ts';
import { isValidFetchUrl } from '../page-fetch/fetch-url.ts';
import { fetchToolInputSchema, fieldStatus } from './fetch-tool-schema.ts';

export type CompletionStatus = 'success' | 'invalid_arguments' | 'unknown_tool' | 'access_denied' | 'fetch_failed' | 'processing_failed' | 'cancelled' | 'busy';

export function formatToolCompletion(context: RequestContext, call: { operationId: string; name: string; arguments: unknown; status: CompletionStatus; durationMs: number }): string {
  const args = typeof call.arguments === 'object' && call.arguments !== null ? call.arguments as Record<string, unknown> : {};
  return JSON.stringify({
    event: 'mcp.tool.completed',
    operationId: call.operationId,
    authority: context.user.authority,
    subject: context.user.subject,
    tenantId: context.tenantId,
    tool: call.name === 'getURLAsMarkdown' ? 'getURLAsMarkdown' : 'unknown',
    ...safeUrl(args.url),
    ...safeReason(args.reason),
    status: call.status,
    durationMs: call.durationMs,
  });
}

function safeUrl(value: unknown): { url?: string; urlStatus: string } {
  const status = fieldStatus(value, fetchToolInputSchema.properties.url);
  if (status !== 'valid') return { urlStatus: status };
  try {
    const url = new URL(value as string);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return { urlStatus: 'invalid' };
    return { url: `${url.origin}${url.pathname}`, urlStatus: isValidFetchUrl(value) ? 'valid' : 'invalid' };
  } catch {
    return { urlStatus: 'invalid' };
  }
}

function safeReason(value: unknown): { reason?: string; reasonStatus: string } {
  const status = fieldStatus(value, fetchToolInputSchema.properties.reason);
  if (status !== 'valid') return { reasonStatus: status };
  const reason = value as string;
  if (!new RegExp(fetchToolInputSchema.properties.reason.pattern).test(reason)) return { reasonStatus: 'blank' };
  return { reason, reasonStatus: 'valid' };
}
