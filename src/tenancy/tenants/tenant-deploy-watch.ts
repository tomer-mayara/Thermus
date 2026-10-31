import type { ProvisioningClock } from './provisioning-clock.ts';
import { deployProgressOf, type DeployProgressRead, type ProgressPlatform } from './tenant-deploy-progress.ts';
import type { LostClaim, RowWork } from './tenant-provisioning-store.ts';

// The bounds of 27 October 2026: the newest deploy is read every 5 s, for at most 15 minutes.
const POLL_MS = 5_000;
const BUDGET_MS = 15 * 60_000;

export type WatchOutcome = Exclude<DeployProgressRead, { readonly status: 'pending' }> | LostClaim;

export interface WatchParts {
  readonly platform: ProgressPlatform;
  readonly clock: ProvisioningClock;
}

/**
 * Watches the newest deploy of a service until the row can be live, within the budget of 15 minutes. The failure reason
 * at the end of the budget names the last state seen, so the operator knows where the deploy stopped. Each read comes
 * after a renewal of the claim of the row, so the claim lasts for the whole deploy. A row that another loop claimed,
 * or that left the work, ends the watch; a registry that does not answer does not.
 */
export async function watchDeploy(parts: WatchParts, serviceId: string, work: RowWork): Promise<WatchOutcome> {
  const deadline = parts.clock.now() + BUDGET_MS;
  for (;;) {
    const held = await work.renew();
    if (held.status === 'moved') return { status: 'lost', claim: held };
    const progress = await deployProgressOf(parts.platform, serviceId, work.signal);
    if (progress.status !== 'pending') return progress;
    if (parts.clock.now() + POLL_MS >= deadline) {
      return { status: 'failed', reason: `The deploy of ${serviceId} did not reach live within 15 minutes. Last seen: ${progress.seen}` };
    }
    await parts.clock.sleep(POLL_MS, work.signal);
  }
}
