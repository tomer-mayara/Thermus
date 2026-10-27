import { ACCESS_CONTEXT_HEADER } from '../../accounts/identity/signed-access-context.ts';
import { AUDIT_SEND_LIMITS, type AuditSendOutcome } from './audit-send.ts';
import { retryAfterMs } from './otlp-audit-response.ts';

/** One relay of one audit event: the route of the control plane, the access context of the request, and the event JSON. */
export interface AuditRelay {
  readonly target: URL;
  readonly context: string;
  readonly body: string;
}

// The statuses of a control plane that is busy or restarts. Each other answer is final.
const TRANSIENT_STATUSES: ReadonlySet<number> = new Set([429, 502, 503, 504]);

/**
 * Posts one event to the relay route of the control plane over the private network, within the time limit of an
 * audit send. The outcome is never an exception: a refused, failed, or slow relay gives its outcome, and a redirect
 * is final, because the route never moves.
 */
export async function postAuditRelay(relay: AuditRelay, signal: AbortSignal, timeoutMs: number = AUDIT_SEND_LIMITS.timeoutMs): Promise<AuditSendOutcome> {
  const timeout = AbortSignal.timeout(timeoutMs);
  try {
    const response = await fetch(relay.target, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/json', [ACCESS_CONTEXT_HEADER]: relay.context },
      body: relay.body,
      signal: AbortSignal.any([signal, timeout]),
    });
    await response.body?.cancel();
    return outcomeOf(response);
  } catch {
    if (signal.aborted) return { kind: 'cancelled' };
    return { kind: 'transient_failure', reason: timeout.aborted ? 'timeout' : 'transport' };
  }
}

function outcomeOf(response: Response): AuditSendOutcome {
  const statusCode = response.status;
  if (statusCode >= 200 && statusCode < 300) return { kind: 'accepted' };
  if (!TRANSIENT_STATUSES.has(statusCode)) return { kind: 'permanent_failure', reason: 'http_status', statusCode };
  const delay = retryAfterMs(response.headers.get('Retry-After') ?? undefined, Date.now());
  return { kind: 'transient_failure', reason: 'http_status', statusCode, ...(delay === undefined ? {} : { retryAfterMs: delay }) };
}
