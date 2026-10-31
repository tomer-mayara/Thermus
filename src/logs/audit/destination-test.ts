import type { AuditContext, AuditEvent } from './audit-log.ts';
import type { AuditDestination, AuditSendOutcome } from './audit-send.ts';
import type { ReadSettingsResult } from './destination-settings-store.ts';

export interface DestinationTestSender {
  send(destination: AuditDestination, event: AuditEvent, signal?: AbortSignal): Promise<AuditSendOutcome>;
}

export type DestinationTestResult =
  | { readonly status: 'tested'; readonly revision: string; readonly outcome: AuditSendOutcome }
  | { readonly status: 'conflict' | 'unavailable' | 'unsaved' | 'busy' | 'cancelled' | 'unconfirmed' };

export type TestRequester = Pick<AuditContext, 'organizationId' | 'actor'>;

export const DESTINATION_TEST_LIMITS = Object.freeze({ active: 4, timeoutMs: 5_000 });

/** Retain Test admission until its callback ends, including reads that ignore cancellation.
 * The sender separately retains its own admission for native work after send() settles. */
export class DestinationTestLifetime {
  private active = 0;

  async run(work: (signal: AbortSignal) => Promise<DestinationTestResult>, signal?: AbortSignal): Promise<DestinationTestResult> {
    if (signal?.aborted) return { status: 'cancelled' };
    if (this.active >= DESTINATION_TEST_LIMITS.active) return { status: 'busy' };
    this.active++;
    const controller = new AbortController();
    let stopped: DestinationTestResult = { status: 'cancelled' };
    const cancel = () => controller.abort();
    const timer = setTimeout(() => { stopped = { status: 'unconfirmed' }; cancel(); }, DESTINATION_TEST_LIMITS.timeoutMs);
    const cancellation = new Promise<DestinationTestResult>(resolve => controller.signal.addEventListener('abort', () => resolve(stopped), { once: true }));
    signal?.addEventListener('abort', cancel, { once: true });
    const pending = work(controller.signal).catch(() => ({ status: 'unavailable' as const })).finally(() => { this.active--; });
    try { return await Promise.race([pending, cancellation]); }
    finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
  }
}

export function testEvent(requester: TestRequester, revision: string): AuditEvent {
  return { eventName: 'audit.destination.test', timestamp: new Date().toISOString(), organizationId: requester.organizationId, actor: requester.actor, destinationRevision: revision };
}

export function confirmedTest(after: ReadSettingsResult, revision: string, outcome: AuditSendOutcome): DestinationTestResult {
  if (after.status === 'unavailable') return { status: 'unconfirmed' };
  if (after.status !== 'found' || after.settings.revision !== revision) return { status: 'conflict' };
  return { status: 'tested', revision, outcome };
}
