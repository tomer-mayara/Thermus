import type { ProvisioningClock } from './provisioning-clock.ts';
import type { DeployRead, PlatformDeploy, TenantPlatform } from './tenant-platform.ts';

// The wait of the fleet writes for the deploy that they started: an upgrade deploy, or the deploy of a resume (SO-09).
// It reads the newest deploy every 5 s for at most 15 minutes, the bounds of the provisioner. A deploy that reaches
// live counts as healthy: there is no health probe over the private network (answer 1 of 27 October 2026).
const POLL_MS = 5_000;
const BUDGET_MS = 15 * 60_000;

/**
 * The deploy that a write started on a service (manager decision of 31 October 2026). named: the answer of the
 * platform gave the deploy, so the wait follows that ID only, and a newer deploy with another ID superseded it.
 * unnamed: the answer gave no deploy, as Render does for a queued deploy and for each resume, so the wait takes the
 * first deploy other than the newest one before the write, and its identity stays unconfirmed.
 */
export type StartedDeploy =
  | { readonly kind: 'named'; readonly serviceId: string; readonly id: string; readonly before: string | undefined }
  | { readonly kind: 'unnamed'; readonly serviceId: string; readonly before: string | undefined };

export interface FleetDeployParts {
  readonly platform: Pick<TenantPlatform, 'newestDeploy'>;
  readonly clock: ProvisioningClock;
}

/** The ID of the newest deploy before a write, undefined for none, or the reason that the read failed. */
export type DeployBefore =
  | { readonly status: 'read'; readonly id: string | undefined }
  | { readonly status: 'failed'; readonly reason: string };

/** confirmed: the answer of the write named the deploy. unconfirmed: the first new deploy after the write. */
export type DeployIdentity = 'confirmed' | 'unconfirmed';

/** live: the deploy of the write, its identity, and the seconds of the wait. failed: the reason for the operator. */
export type DeployWait =
  | { readonly status: 'live'; readonly deploy: PlatformDeploy; readonly identity: DeployIdentity; readonly seconds: number }
  | { readonly status: 'failed'; readonly reason: string };

// One read of the wait: the live deploy of the write, the end of the wait with its reason, or what the read saw.
type Step = { readonly status: 'live'; readonly deploy: PlatformDeploy } | { readonly status: 'failed'; readonly reason: string } | { readonly status: 'pending'; readonly seen: string };

/** The newest deploy before a write. The wait leaves it out: right after a resume it can still show live (SO-09 record). */
export async function newestDeployBefore(platform: Pick<TenantPlatform, 'newestDeploy'>, serviceId: string, signal: AbortSignal): Promise<DeployBefore> {
  const read = await platform.newestDeploy(serviceId, signal);
  if (read.status === 'found') return { status: 'read', id: read.deploy.id };
  if (read.status === 'none') return { status: 'read', id: undefined };
  return { status: 'failed', reason: read.status === 'gone' ? 'the tenant service no longer exists' : `the deploy list is unavailable (${read.reason})` };
}

/** Reads the newest deploy until the deploy of the write is live or failed, a newer deploy superseded it, or the budget ends. */
export async function waitForStartedDeploy(parts: FleetDeployParts, started: StartedDeploy, signal: AbortSignal): Promise<DeployWait> {
  const startedAt = parts.clock.now();
  // The last read comes before the end of the budget, as in the watch of the provisioner.
  const lastReadAt = startedAt + BUDGET_MS - POLL_MS;
  const identity: DeployIdentity = started.kind === 'named' ? 'confirmed' : 'unconfirmed';
  for (;;) {
    const step = stepOf(await parts.platform.newestDeploy(started.serviceId, signal), started);
    if (step.status === 'live') return { ...step, identity, seconds: Math.round((parts.clock.now() - startedAt) / 100) / 10 };
    if (step.status === 'failed') return step;
    if (parts.clock.now() >= lastReadAt) return { status: 'failed', reason: `no deploy of this write reached live within 15 minutes; last seen: ${step.seen}` };
    await parts.clock.sleep(POLL_MS, signal);
  }
}

// One read against the deploy of the write. A failed read and no deploy yet are pending; a gone service ends the wait.
function stepOf(read: DeployRead, started: StartedDeploy): Step {
  if (read.status === 'gone') return { status: 'failed', reason: 'the tenant service no longer exists' };
  if (read.status !== 'found') return { status: 'pending', seen: read.status === 'none' ? 'no deploy' : `the deploy list is unavailable (${read.reason})` };
  return deployStepOf(read.deploy, started);
}

// The deploy from before the write is pending; another new ID than the named one superseded the deploy of the write.
function deployStepOf(deploy: PlatformDeploy, started: StartedDeploy): Step {
  if (deploy.id === started.before) return { status: 'pending', seen: `${deploy.id} ${deploy.status}, the deploy before the write` };
  if (started.kind === 'named' && deploy.id !== started.id) return { status: 'failed', reason: `the newer deploy ${deploy.id} superseded the deploy ${started.id} of this write` };
  if (deploy.progress === 'failed') return { status: 'failed', reason: `the deploy ${deploy.id} ended as ${deploy.status}` };
  return deploy.progress === 'live' ? { status: 'live', deploy } : { status: 'pending', seen: `${deploy.id} ${deploy.status}` };
}
