import type { AuditEvent } from './audit-log.ts';

/** One caller-supplied destination. No environment, settings, or system-log defaults apply. */
export interface AuditDestination {
  readonly endpoint: string;
  readonly auth: { readonly type: 'none' } | { readonly type: 'bearer'; readonly token: string };
}

type AuditFailureReason = 'invalid_destination' | 'unsafe_destination' | 'dns_limit' | 'invalid_auth' | 'invalid_event' | 'request_too_large' | 'http_status' | 'retry_after_exceeds_limit' | 'invalid_response' | 'response_too_large' | 'transport' | 'tls' | 'timeout';

/** Warning and rejection outcomes never include the receiver's raw diagnostic text. */
export type AuditSendOutcome =
  | { readonly kind: 'accepted' | 'warning' | 'cancelled' | 'busy'; readonly retryAfterMs?: never }
  | { readonly kind: 'partial_rejection'; readonly rejectedRecords: 1; readonly retryAfterMs?: never }
  | { readonly kind: 'permanent_failure' | 'unconfirmed'; readonly reason: AuditFailureReason; readonly statusCode?: number; readonly retryAfterMs?: never }
  | { readonly kind: 'transient_failure'; readonly reason: AuditFailureReason; readonly statusCode?: number; readonly retryAfterMs?: number };

/** Public outcome may settle before native work is disposed. Both promises always fulfill. */
export interface AuditSendAttempt {
  readonly outcome: Promise<AuditSendOutcome>;
  readonly settled: Promise<void>;
}

/** Abort clears sender-owned payload. Native admission stays held until settled fulfills. */
export interface TrackedAuditSender {
  start(destination: AuditDestination, event: AuditEvent, signal?: AbortSignal): AuditSendAttempt;
}

export const AUDIT_SEND_LIMITS = Object.freeze({ active: 4, timeoutMs: 5_000, requestBytes: 262_144, responseBytes: 16_384, headerBytes: 16_384, tokenBytes: 8_192, endpointCharacters: 2_048, dnsAnswers: 32, retryAfterMs: 86_400_000 });

/** Internal control flow carries only a fixed safe outcome, never a transport cause. */
export class AuditSendFailure extends Error {
  readonly outcome: AuditSendOutcome;
  constructor(outcome: AuditSendOutcome) { super('Audit send did not complete'); this.outcome = outcome; }
}
