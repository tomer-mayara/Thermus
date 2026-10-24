import type { AuditEvent } from './audit-log.ts';
import { AUDIT_SEND_LIMITS, AuditSendFailure } from './audit-send.ts';
import type { AuditDestination, AuditSendAttempt, AuditSendOutcome } from './audit-send.ts';
import { encodeAuditEvent } from './otlp-audit-encoding.ts';
import { parseAuditDestination, resolveAuditAddress } from './public-audit-destination.ts';
import { closeAuditSocket, connectAuditTls } from './audit-https-connection.ts';
import { requestAuditExport } from './otlp-audit-request.ts';

export type { AuditDestination, AuditSendOutcome } from './audit-send.ts';

const verificationFailures = new Set(['UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_CRL', 'UNABLE_TO_DECRYPT_CRL_SIGNATURE', 'CRL_SIGNATURE_FAILURE', 'CRL_NOT_YET_VALID', 'CRL_HAS_EXPIRED', 'ERROR_IN_CRL_LAST_UPDATE_FIELD', 'ERROR_IN_CRL_NEXT_UPDATE_FIELD', 'UNABLE_TO_DECODE_ISSUER_PUBLIC_KEY', 'INVALID_CA', 'PATH_LENGTH_EXCEEDED', 'INVALID_PURPOSE']);

function failureOutcome(error: unknown): AuditSendOutcome {
  try {
    if (error instanceof AuditSendFailure) return error.outcome;
    const code = (error as NodeJS.ErrnoException | null)?.code;
    if (typeof code === 'string' && (/CERT|ERR_TLS|SELF_SIGNED/.test(code) || verificationFailures.has(code))) return { kind: 'permanent_failure', reason: 'tls' };
  } catch {
    // Error metadata is not trusted transport data.
  }
  return { kind: 'transient_failure', reason: 'transport' };
}

interface PreparedAuditRequest { readonly url: URL; body?: Buffer; authorization?: string }

function prepare(destination: AuditDestination, event: AuditEvent): PreparedAuditRequest {
  return { ...parseAuditDestination(destination), body: encodeAuditEvent(event) };
}

function clearPayload(request: PreparedAuditRequest): void {
  // The native operation may outlive cancellation. Its reservation must retain no export content.
  request.body?.fill(0);
  request.body = undefined;
  request.authorization = undefined;
}

async function attempt(request: PreparedAuditRequest, signal: AbortSignal): Promise<AuditSendOutcome> {
  const clear = () => clearPayload(request);
  signal.addEventListener('abort', clear, { once: true });
  try {
    signal.throwIfAborted();
    const address = await resolveAuditAddress(request.url, signal);
    const socket = await connectAuditTls(request.url, address, signal);
    try {
      signal.throwIfAborted();
      if (request.body === undefined) throw new AuditSendFailure({ kind: 'cancelled' });
      return await requestAuditExport(socket, request.url, request.body, request.authorization, signal);
    } finally { await closeAuditSocket(socket); }
  } catch (error) { return failureOutcome(error); }
  finally { clear(); signal.removeEventListener('abort', clear); }
}

/** Preparation is synchronous so native work cannot retain the caller's event or destination. */
function beginAttempt(destination: AuditDestination, event: AuditEvent, signal: AbortSignal): Promise<AuditSendOutcome> {
  try { return attempt(prepare(destination, event), signal); }
  catch (error) { return Promise.resolve(failureOutcome(error)); }
}

/** One bounded attempt, without retries, queue, capture, settings, or a system-log dependency. */
export class OtlpAuditSender {
  private active = 0;

  send(destination: AuditDestination, event: AuditEvent, signal?: AbortSignal): Promise<AuditSendOutcome> {
    return this.start(destination, event, signal).outcome;
  }

  start(destination: AuditDestination, event: AuditEvent, signal?: AbortSignal): AuditSendAttempt {
    if (signal?.aborted) return { outcome: Promise.resolve({ kind: 'cancelled' }), settled: Promise.resolve() };
    if (this.active >= AUDIT_SEND_LIMITS.active) return { outcome: Promise.resolve({ kind: 'busy' }), settled: Promise.resolve() };
    this.active++;
    const controller = new AbortController();
    let aborted: AuditSendOutcome = { kind: 'cancelled' };
    const cancel = () => controller.abort();
    const timer = setTimeout(() => { aborted = { kind: 'unconfirmed', reason: 'timeout' }; cancel(); }, AUDIT_SEND_LIMITS.timeoutMs);
    const cancellation = new Promise<AuditSendOutcome>((resolve) => controller.signal.addEventListener('abort', () => resolve(aborted), { once: true }));
    signal?.addEventListener('abort', cancel, { once: true });
    // A cancelled native DNS lookup still occupies admission until it settles.
    const work = beginAttempt(destination, event, controller.signal).finally(() => { this.active--; signal?.removeEventListener('abort', cancel); });
    const outcome = Promise.race([work, cancellation]).finally(() => { clearTimeout(timer); });
    return { outcome, settled: work.then(() => {}) };
  }
}
