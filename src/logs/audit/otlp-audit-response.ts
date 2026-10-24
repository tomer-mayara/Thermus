import { AUDIT_SEND_LIMITS } from './audit-send.ts';
import type { AuditSendOutcome } from './audit-send.ts';

export interface AuditHttpResponse {
  readonly statusCode: number;
  readonly contentType?: string;
  readonly retryAfter?: string;
  readonly body: Buffer;
}

function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }

function accepted(body: Buffer): AuditSendOutcome {
  const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
  if (!record(value)) throw new Error();
  const partial = value.partialSuccess;
  if (partial === undefined || partial === null) return { kind: 'accepted' };
  if (!record(partial)) throw new Error();
  const count = partial.rejectedLogRecords ?? '0';
  const message = partial.errorMessage ?? '';
  if (typeof message !== 'string' || ![0, 1, '0', '1'].includes(count as string | number)) throw new Error();
  if (Number(count) === 1) return { kind: 'partial_rejection', rejectedRecords: 1 };
  return { kind: message.length === 0 ? 'accepted' : 'warning' };
}

function retryDelay(value: string | undefined, now: number): number | undefined {
  if (value === undefined) return undefined;
  if (/^\d+$/.test(value)) return Number(value) * 1_000;
  if (!/^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(value)) return undefined;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : undefined;
}

export function interpretAuditResponse(response: AuditHttpResponse, now = Date.now()): AuditSendOutcome {
  if (response.body.length > AUDIT_SEND_LIMITS.responseBytes) return { kind: 'unconfirmed', reason: 'response_too_large' };
  const statusCode = response.statusCode;
  if (statusCode !== 200) {
    if (![429, 502, 503, 504].includes(statusCode)) return { kind: 'permanent_failure', reason: 'http_status', statusCode };
    const delay = retryDelay(response.retryAfter, now);
    if (delay !== undefined && delay > AUDIT_SEND_LIMITS.retryAfterMs) return { kind: 'permanent_failure', reason: 'retry_after_exceeds_limit', statusCode };
    return { kind: 'transient_failure', reason: 'http_status', statusCode, ...(delay === undefined ? {} : { retryAfterMs: delay }) };
  }
  try {
    if (!/^application\/json(?:\s*;|\s*$)/i.test(response.contentType ?? '')) throw new Error();
    return accepted(response.body);
  } catch { return { kind: 'unconfirmed', reason: 'invalid_response' }; }
}
