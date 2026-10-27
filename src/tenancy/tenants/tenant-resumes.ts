import type { TenantGatewayStore } from './tenant-gateway-store.ts';
import type { ResumedService, ResumeOutcome, TenantResume } from './tenant-resume.ts';

/**
 * sent: this call moved the row to deploying and the platform took the resume. pending: a resume runs or ran, so the
 * row is no longer suspended. failed: the platform refused the resume; the row is suspended again. unavailable: the
 * registry could not be written, so no resume went.
 */
export type ResumeResult =
  | { readonly status: 'sent' | 'pending' | 'unavailable' }
  | { readonly status: 'failed'; readonly reason: string };

const SENT: ResumeResult = Object.freeze({ status: 'sent' });
const PENDING: ResumeResult = Object.freeze({ status: 'pending' });
const UNAVAILABLE: ResumeResult = Object.freeze({ status: 'unavailable' });

/**
 * The resume of a suspended tenant (answer 3 of 27 October 2026). The row moves from suspended to deploying first, and
 * only the call that moved it sends the one resume call, so concurrent calls of any process send one. A failed resume
 * sets the row back to suspended: the next call tries again, and there is no new state. The provisioner then watches
 * the newest deploy of the deploying row and records live.
 */
export class TenantResumes {
  /** The conditional registry statements of a resume. */
  private readonly store: Pick<TenantGatewayStore, 'markResuming' | 'restoreSuspended'>;
  /** The resume call of the platform; SO-10 connects it to Render. */
  private readonly operation: TenantResume;
  /** The organizations whose resume runs in this process. */
  private readonly running = new Set<string>();

  constructor(store: Pick<TenantGatewayStore, 'markResuming' | 'restoreSuspended'>, operation: TenantResume) {
    this.store = store;
    this.operation = operation;
  }

  async resume(organizationId: string): Promise<ResumeResult> {
    // A call of this process that meets a running resume does not wait for the platform.
    if (this.running.has(organizationId)) return PENDING;
    this.running.add(organizationId);
    try {
      return await this.resumeOnce(organizationId);
    } finally {
      this.running.delete(organizationId);
    }
  }

  private async resumeOnce(organizationId: string): Promise<ResumeResult> {
    const mark = await this.store.markResuming(organizationId);
    if (mark.status !== 'resuming') return mark.status === 'moved' ? PENDING : UNAVAILABLE;
    const outcome = await platformResume(this.operation, { organizationId, serviceId: mark.serviceId });
    if (outcome.status === 'resumed') return SENT;
    await this.store.restoreSuspended(organizationId);
    return { status: 'failed', reason: outcome.reason };
  }
}

// The outcome is never an exception. An exception gives a fixed reason, because its text can hold platform details.
async function platformResume(operation: TenantResume, service: ResumedService): Promise<ResumeOutcome> {
  try {
    return await operation.resume(service);
  } catch {
    return { status: 'failed', reason: 'The resume call failed unexpectedly.' };
  }
}
