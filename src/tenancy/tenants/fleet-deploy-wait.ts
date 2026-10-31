import type { ProvisioningClock } from './provisioning-clock.ts';
import type { DeployRead, DeployStart, PlatformDeploy, TenantPlatform } from './tenant-platform.ts';

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

/** An upgrade deploy that started, with the digest of its image. */
export type StartedImageDeploy = StartedDeploy & { readonly digest: string };

export interface FleetDeployParts {
  readonly platform: Pick<TenantPlatform, 'newestDeploy'>;
  readonly clock: ProvisioningClock;
}

/** The ID of the newest deploy before a write, undefined for none, or the reason that the read failed. */
export type DeployBefore =
  | { readonly status: 'read'; readonly id: string | undefined }
  | { readonly status: 'failed'; readonly reason: string };

export type ImageDeployStart =
  | { readonly status: 'started'; readonly started: StartedImageDeploy }
  | { readonly status: 'not-started'; readonly reason: string };

type DeployIdentity = 'confirmed' | 'unconfirmed';

export type DeployWait =
  | { readonly status: 'live'; readonly deploy: PlatformDeploy; readonly identity: DeployIdentity; readonly seconds: number }
  | { readonly status: 'failed'; readonly reason: string };

/** recordable: the live deploy names the requested digest. stopped: the registry keeps its digest, and the upgrade stops. */
export type ImageDeployEnd =
  | { readonly status: 'recordable'; readonly deploy: PlatformDeploy; readonly identity: DeployIdentity; readonly seconds: number }
  | { readonly status: 'stopped'; readonly reason: string };

type Step = { readonly status: 'live'; readonly deploy: PlatformDeploy } | { readonly status: 'failed'; readonly reason: string } | { readonly status: 'pending'; readonly seen: string };

const GONE = 'the tenant service no longer exists';

/** The digest of an image reference by digest, such as ghcr.io/owner/name@sha256:<64 hexadecimal digits>. */
export function imageDigestOf(image: string): string {
  return image.slice(image.lastIndexOf('@') + 1);
}

export async function newestDeployBefore(platform: Pick<TenantPlatform, 'newestDeploy'>, serviceId: string, signal: AbortSignal): Promise<DeployBefore> {
  const read = await platform.newestDeploy(serviceId, signal);
  if (read.status === 'found') return { status: 'read', id: read.deploy.id };
  if (read.status === 'none') return { status: 'read', id: undefined };
  return { status: 'failed', reason: read.status === 'gone' ? GONE : `the deploy list is unavailable (${read.reason})` };
}

/** The newest deploy before the write, then the one deploy call of the image, which the platform sends one time only. */
export async function startImageDeploy(platform: Pick<TenantPlatform, 'newestDeploy' | 'deployImage'>, request: { readonly serviceId: string; readonly image: string }, signal: AbortSignal): Promise<ImageDeployStart> {
  const { serviceId, image } = request;
  const before = await newestDeployBefore(platform, serviceId, signal);
  if (before.status === 'failed') return { status: 'not-started', reason: before.reason };
  const start = await platform.deployImage(serviceId, image, signal);
  if (start.status !== 'started') return { status: 'not-started', reason: startFailureOf(start) };
  const deploy: StartedDeploy = start.deploy === undefined ? { kind: 'unnamed', serviceId, before: before.id } : { kind: 'named', serviceId, id: start.deploy.id, before: before.id };
  return { status: 'started', started: { ...deploy, digest: imageDigestOf(image) } };
}

export async function waitForStartedDeploy(parts: FleetDeployParts, started: StartedDeploy, signal: AbortSignal): Promise<DeployWait> {
  const startedAt = parts.clock.now();
  for (;;) {
    const step = stepOf(await parts.platform.newestDeploy(started.serviceId, signal), started);
    if (step.status === 'live') return { status: 'live', deploy: step.deploy, identity: started.kind === 'named' ? 'confirmed' : 'unconfirmed', seconds: Math.round((parts.clock.now() - startedAt) / 100) / 10 };
    if (step.status === 'failed') return step;
    if (parts.clock.now() - startedAt + POLL_MS >= BUDGET_MS) return { status: 'failed', reason: `no deploy of this write reached live within 15 minutes; last seen: ${step.seen}` };
    await parts.clock.sleep(POLL_MS, signal);
  }
}

/** The wait of an upgrade deploy, and whether its live deploy may record the requested digest. */
export async function finishImageDeploy(parts: FleetDeployParts, started: StartedImageDeploy, signal: AbortSignal): Promise<ImageDeployEnd> {
  const wait = await waitForStartedDeploy(parts, started, signal);
  if (wait.status === 'failed') return { status: 'stopped', reason: `did not reach live: ${wait.reason}` };
  const { deploy, seconds } = wait;
  if (deploy.imageDigest === started.digest) return { status: 'recordable', deploy, identity: wait.identity, seconds };
  const runs = deploy.imageDigest === undefined ? ', digest unconfirmed: the deploy names no digest' : ` with ${shortDigestOf(deploy.imageDigest)}, not ${shortDigestOf(started.digest)}`;
  return { status: 'stopped', reason: `${deploy.id} live after ${seconds} s${runs}; the registry keeps its digest` };
}

// One read of the newest deploy against the deploy of the write. The deploy from before the write, a failed read, and
// no deploy yet are pending; only a gone service or the end of the deploy of the write ends the wait early.
function stepOf(read: DeployRead, started: StartedDeploy): Step {
  if (read.status === 'gone') return { status: 'failed', reason: GONE };
  if (read.status === 'none') return { status: 'pending', seen: 'no deploy' };
  if (read.status === 'unavailable') return { status: 'pending', seen: `the deploy list is unavailable (${read.reason})` };
  const { deploy } = read;
  if (deploy.id === started.before) return { status: 'pending', seen: `${deploy.id} ${deploy.status}, the deploy before the write` };
  if (started.kind === 'named' && deploy.id !== started.id) return { status: 'failed', reason: `the newer deploy ${deploy.id} superseded the deploy ${started.id} of this write` };
  if (deploy.progress === 'live') return { status: 'live', deploy };
  if (deploy.progress === 'failed') return { status: 'failed', reason: `the deploy ${deploy.id} ended as ${deploy.status}` };
  return { status: 'pending', seen: `${deploy.id} ${deploy.status}` };
}

function startFailureOf(start: Exclude<DeployStart, { readonly status: 'started' }>): string {
  if (start.status === 'gone') return GONE;
  if (start.status === 'rate-limited') return `the platform limits the deploys of the service for ${Math.ceil(start.retryAfterMs / 1_000)} s`;
  return start.status === 'unknown' ? `the deploy call got no clear answer (${start.reason}); a deploy can run, so read the status first` : start.reason;
}

function shortDigestOf(digest: string): string {
  return `${digest.slice(0, 19)}…`;
}
