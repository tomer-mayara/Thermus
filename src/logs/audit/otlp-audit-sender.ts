import type { AuditEvent } from './audit-log.ts';
import { AUDIT_SEND_LIMITS, AuditSendFailure } from './audit-send.ts';
import type { AuditDestination, AuditSendOutcome } from './audit-send.ts';
import { encodeAuditEvent } from './otlp-audit-encoding.ts';
import { parseAuditDestination, resolveAuditAddress } from './public-audit-destination.ts';
import { closeAuditSocket, connectAuditTls } from './audit-https-connection.ts';
import { requestAuditExport } from './otlp-audit-request.ts';

export type { AuditDestination, AuditSendOutcome } from './audit-send.ts';

const verificationFailures = new Set(['UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_CRL', 'UNABLE_TO_DECRYPT_CRL_SIGNATURE', 'CRL_SIGNATURE_FAILURE', 'CRL_NOT_YET_VALID', 'CRL_HAS_EXPIRED', 'ERROR_IN_CRL_LAST_UPDATE_FIELD', 'ERROR_IN_CRL_NEXT_UPDATE_FIELD', 'UNABLE_TO_DECODE_ISSUER_PUBLIC_KEY', 'INVALID_CA', 'PATH_LENGTH_EXCEEDED', 'INVALID_PURPOSE']);

function failureOutcome(error: unknown): AuditSendOutcome {
  if (error instanceof AuditSendFailure) return error.outcome;
  const code = (error as NodeJS.ErrnoException | null)?.code ?? '';
  if (/CERT|ERR_TLS|SELF_SIGNED/.test(code) || verificationFailures.has(code)) return { kind: 'permanent_failure', reason: 'tls' };
  return { kind: 'transient_failure', reason: 'transport' };
}

async function attempt(destination: AuditDestination, event: AuditEvent, signal: AbortSignal): Promise<AuditSendOutcome> {
  try {
    const { url, authorization } = parseAuditDestination(destination);
    const body = encodeAuditEvent(event);
    const address = await resolveAuditAddress(url, signal);
    const socket = await connectAuditTls(url, address, signal);
    try { return await requestAuditExport(socket, url, body, authorization, signal); }
    finally { await closeAuditSocket(socket); }
  } catch (error) { return failureOutcome(error); }
}

/** One bounded attempt, without retries, queue, capture, settings, or a system-log dependency. */
export class OtlpAuditSender {
  private active = 0;

  async send(destination: AuditDestination, event: AuditEvent, signal?: AbortSignal): Promise<AuditSendOutcome> {
    if (signal?.aborted) return { kind: 'cancelled' };
    if (this.active >= AUDIT_SEND_LIMITS.active) return { kind: 'busy' };
    this.active++;
    const controller = new AbortController();
    let aborted: AuditSendOutcome = { kind: 'cancelled' };
    const cancel = () => controller.abort();
    const timer = setTimeout(() => { aborted = { kind: 'unconfirmed', reason: 'timeout' }; cancel(); }, AUDIT_SEND_LIMITS.timeoutMs);
    const cancellation = new Promise<AuditSendOutcome>((resolve) => controller.signal.addEventListener('abort', () => resolve(aborted), { once: true }));
    signal?.addEventListener('abort', cancel, { once: true });
    // A cancelled native DNS lookup still occupies admission until it settles.
    const work = attempt(destination, event, controller.signal).finally(() => { this.active--; });
    try { return await Promise.race([work, cancellation]); }
    finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
  }
}
