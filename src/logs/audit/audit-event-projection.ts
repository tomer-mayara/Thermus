import type { AdministrationChange, AuditContext, AuditEvent, DestinationChange, ToolCompletion, ToolInput } from './audit-log.ts';
import { AUDIT_CAPTURE_LIMITS, captureAuditResult, redactAuditText } from './audit-content.ts';

const toolStatuses = new Set(['success', 'access_denied', 'fetch_failed', 'processing_failed', 'cancelled', 'busy', 'search_failed', 'withheld']);
const changeOutcomes = new Set(['applied', 'unchanged', 'denied', 'stale', 'not-pending', 'address-in-use', 'unsupported', 'failed', 'unknown']);
const destinationOutcomes = new Set(['saved', 'unchanged', 'invalid', 'conflict', 'unavailable', 'unconfirmed', 'tested', 'unsaved', 'cancelled', 'busy', 'denied', 'stale']);

function metadata(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.isWellFormed() && Buffer.byteLength(value) <= AUDIT_CAPTURE_LIMITS.metadataBytes;
}

function contextOf(value: AuditContext): AuditContext | undefined {
  const timestamp = value.timestamp;
  const organizationId = value.organizationId;
  const actor = { authority: value.actor.authority, subject: value.actor.subject };
  if (![organizationId, actor.authority, actor.subject].every(metadata)) return undefined;
  if (typeof timestamp !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(timestamp)) return undefined;
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 18_446_744_073_709 || new Date(parsed).toISOString().slice(0, 19) !== timestamp.slice(0, 19)) return undefined;
  return { timestamp, organizationId, actor };
}

function inputText(value: unknown, points: number): value is string {
  if (typeof value !== 'string' || !/\S/u.test(value)) return false;
  let count = 0;
  for (const _point of value) if (++count > points) return false;
  return true;
}

function inputOf(completion: ToolCompletion): ToolInput | undefined {
  const reason = completion.input.reason;
  if (!inputText(reason, 2_000)) return undefined;
  if (completion.tool === 'search') {
    const query = completion.input.query;
    if (!inputText(query, 512) || !query.isWellFormed()) return undefined;
    return { tool: 'search', input: { query: redactAuditText(query), reason: redactAuditText(reason) } };
  }
  if (completion.tool !== 'getURLAsMarkdown') return undefined;
  const url = completion.input.url;
  if (!inputText(url, 8_192) || !/^https?:\/\//i.test(url) || /[\u0000-\u0020\u007f]/.test(url)) return undefined;
  const authority = /^https?:\/\/([^/?#]+)/i.exec(url)?.[1];
  if (authority === undefined || /[@\\]/.test(authority)) return undefined;
  try { if (new URL(url).hostname === '') return undefined; } catch { return undefined; }
  return { tool: 'getURLAsMarkdown', input: { url: redactAuditText(url), reason: redactAuditText(reason) } };
}

export function projectToolCompletion(completion: ToolCompletion): AuditEvent | undefined {
  const context = contextOf(completion);
  const toolInput = inputOf(completion);
  const operationId = completion.operationId;
  const status = completion.status;
  const durationMs = completion.durationMs;
  const result = completion.result;
  if (context === undefined || toolInput === undefined || !metadata(operationId) || !toolStatuses.has(status)) return undefined;
  if (!Number.isFinite(durationMs) || durationMs < 0 || typeof result !== 'string') return undefined;
  const event = { ...context, eventName: 'mcp.tool.completed' as const, ...toolInput, operationId, status, durationMs,
    result: { text: '', originalBytes: Buffer.byteLength(result), capturedBytes: AUDIT_CAPTURE_LIMITS.resultBytes, truncated: false } };
  const projected = { ...event, result: captureAuditResult(result, Buffer.byteLength(JSON.stringify(event))) };
  return Buffer.byteLength(JSON.stringify(projected)) <= AUDIT_CAPTURE_LIMITS.eventBytes ? projected : undefined;
}

export function projectAdministrationChange(change: AdministrationChange): AuditEvent | undefined {
  const context = contextOf(change);
  const action = change.action;
  const role = change.role;
  const outcome = change.outcome;
  const target = 'email' in change.target ? { email: change.target.email } : { invitationId: change.target.invitationId };
  if (context === undefined || !['invite', 'resend-invitation', 'revoke-invitation'].includes(action) || !changeOutcomes.has(outcome)) return undefined;
  if (role !== undefined && role !== 'admin' && role !== 'user') return undefined;
  if (!metadata('email' in target ? target.email : target.invitationId)) return undefined;
  return { ...context, eventName: 'organization.changed', action, target, ...(role === undefined ? {} : { role }), outcome };
}

export function projectDestinationChange(change: DestinationChange): AuditEvent | undefined {
  const context = contextOf(change);
  const action = change.action;
  const outcome = change.outcome;
  if (context === undefined || !['save', 'test'].includes(action) || !destinationOutcomes.has(outcome)) return undefined;
  return { ...context, eventName: 'audit.destination.changed', action, outcome };
}
