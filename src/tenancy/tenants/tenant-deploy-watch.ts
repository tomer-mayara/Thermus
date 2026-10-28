import type { ProvisioningClock } from './provisioning-clock.ts';
import { deployProgressOf, type DeployProgressRead, type ProgressPlatform } from './tenant-deploy-progress.ts';

// The bounds of 27 October 2026: the newest deploy is read every 5 s, for at most 15 minutes.
const POLL_MS = 5_000;
const BUDGET_MS = 15 * 60_000;

/** live: the record of a live row. failed: the reason for the operator. */
export type WatchOutcome = Exclude<DeployProgressRead, { readonly status: 'pending' }>;

export interface WatchParts {
  readonly platform: ProgressPlatform;
  readonly clock: ProvisioningClock;
}

/**
 * Watches the newest deploy of a service until the row can be live, within the budget of 15 minutes. The failure reason
 * at the end of the budget names the last state seen, so the operator knows where the deploy stopped.
 */
export async function watchDeploy(parts: WatchParts, serviceId: string, signal: AbortSignal): Promise<WatchOutcome> {
  const deadline = parts.clock.now() + BUDGET_MS;
  for (;;) {
    const progress = await deployProgressOf(parts.platform, serviceId, signal);
    if (progress.status !== 'pending') return progress;
    if (parts.clock.now() + POLL_MS >= deadline) {
      return { status: 'failed', reason: `The deploy of ${serviceId} did not reach live within 15 minutes. Last seen: ${progress.seen}` };
    }
    await parts.clock.sleep(POLL_MS, signal);
  }
}
