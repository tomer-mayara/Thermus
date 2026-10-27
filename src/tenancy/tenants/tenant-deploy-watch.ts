import type { ProvisioningClock } from './provisioning-clock.ts';
import type { TenantPlatform } from './tenant-platform.ts';
import type { LiveRecord } from './tenant-provisioning-store.ts';

// The bounds of 27 October 2026: the newest deploy is read every 5 s, for at most 15 minutes.
const POLL_MS = 5_000;
const BUDGET_MS = 15 * 60_000;

export type WatchOutcome =
  | ({ readonly status: 'live' } & LiveRecord)
  | { readonly status: 'failed'; readonly reason: string };

type Progress = WatchOutcome | { readonly status: 'pending'; readonly seen: string };

export interface WatchParts {
  readonly platform: Pick<TenantPlatform, 'newestDeploy' | 'internalAddress'>;
  readonly clock: ProvisioningClock;
}

/**
 * Watches the newest deploy of a service until it is live and the platform gives the internal address of the service.
 * A failed read counts as no news, so it does not stop the watch before the budget ends.
 */
export async function watchDeploy(parts: WatchParts, serviceId: string, signal: AbortSignal): Promise<WatchOutcome> {
  const deadline = parts.clock.now() + BUDGET_MS;
  for (;;) {
    const progress = await progressOf(parts.platform, serviceId, signal);
    if (progress.status !== 'pending') return progress;
    if (parts.clock.now() + POLL_MS >= deadline) {
      return { status: 'failed', reason: `The deploy of ${serviceId} did not reach live within 15 minutes. Last seen: ${progress.seen}` };
    }
    await parts.clock.sleep(POLL_MS, signal);
  }
}

async function progressOf(platform: WatchParts['platform'], serviceId: string, signal: AbortSignal): Promise<Progress> {
  const read = await platform.newestDeploy(serviceId, signal);
  if (read.status === 'gone') return { status: 'failed', reason: `The Render service ${serviceId} no longer exists` };
  if (read.status === 'none') return pending('no deploy yet');
  if (read.status === 'unavailable') return pending(`the deploy list is unavailable (${read.reason})`);
  const { deploy } = read;
  if (deploy.progress === 'failed') return { status: 'failed', reason: `The deploy ${deploy.id} of ${serviceId} ended as ${deploy.status}` };
  if (deploy.progress === 'pending') return pending(`${deploy.id} ${deploy.status}`);
  const address = await platform.internalAddress(serviceId, signal);
  if (address.status !== 'found') return pending(`${deploy.id} live, internal address ${address.status}`);
  return { status: 'live', internalUrl: address.internalUrl, ...(deploy.imageDigest === undefined ? {} : { imageDigest: deploy.imageDigest }) };
}

function pending(seen: string): Progress {
  return { status: 'pending', seen };
}
