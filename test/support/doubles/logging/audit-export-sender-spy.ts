import type { AuditEvent } from '../../../../src/logs/audit/audit-log.ts';
import type { AuditDestination, AuditSendAttempt, AuditSendOutcome } from '../../../../src/logs/audit/audit-send.ts';

export interface ExportAttempt {
  readonly destination: AuditDestination;
  readonly event: AuditEvent;
  readonly signal?: AbortSignal;
  complete(outcome?: AuditSendOutcome): void;
}

export class AuditExportSenderSpy {
  readonly attempts: ExportAttempt[] = [];
  held = false;
  private readonly waiters: { count: number; ready: () => void }[] = [];

  start(destination: AuditDestination, event: AuditEvent, signal?: AbortSignal): AuditSendAttempt {
    const outcome = Promise.withResolvers<AuditSendOutcome>();
    const settled = Promise.withResolvers<void>();
    const cancel = () => outcome.resolve({ kind: 'cancelled' });
    signal?.addEventListener('abort', cancel, { once: true });
    const attempt = { destination, event, signal, complete: (result: AuditSendOutcome = { kind: 'accepted' }) => {
      signal?.removeEventListener('abort', cancel);
      outcome.resolve(result); settled.resolve();
    } };
    this.attempts.push(attempt);
    for (const waiter of this.waiters) if (this.attempts.length >= waiter.count) waiter.ready();
    if (!this.held) queueMicrotask(() => attempt.complete());
    return { outcome: outcome.promise, settled: settled.promise };
  }

  send(destination: AuditDestination, event: AuditEvent, signal?: AbortSignal): Promise<AuditSendOutcome> {
    return this.start(destination, event, signal).outcome;
  }

  untilAttempts(count: number): Promise<void> {
    if (this.attempts.length >= count) return Promise.resolve();
    const ready = Promise.withResolvers<void>();
    this.waiters.push({ count, ready: () => ready.resolve() });
    return ready.promise;
  }
}
