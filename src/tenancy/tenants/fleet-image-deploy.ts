import { newestDeployBefore, waitForStartedDeploy, type DeployIdentity, type FleetDeployParts, type StartedDeploy } from './fleet-deploy-wait.ts';
import type { DeployStart, PlatformDeploy, TenantPlatform } from './tenant-platform.ts';

// One upgrade deploy of the fleet script (SO-09): its start, and the end of its wait. The registry may record the
// digest only when the live deploy names the requested digest (manager decision of 31 October 2026): a live deploy
// without a digest or with another digest stops the upgrade, as a deploy that does not reach live does.

/** An upgrade deploy that started, with the digest of its image. */
export type StartedImageDeploy = StartedDeploy & { readonly digest: string };

/** started: the platform took the deploy call, so a deploy runs. not-started: no deploy runs, and the reason says why. */
export type ImageDeployStart =
  | { readonly status: 'started'; readonly started: StartedImageDeploy }
  | { readonly status: 'not-started'; readonly reason: string };

/** recordable: the live deploy names the requested digest. stopped: the registry keeps its digest, and the upgrade stops. */
export type ImageDeployEnd =
  | { readonly status: 'recordable'; readonly deploy: PlatformDeploy; readonly identity: DeployIdentity; readonly seconds: number }
  | { readonly status: 'stopped'; readonly reason: string };

/** The digest of an image reference by digest, such as ghcr.io/owner/name@sha256:<64 hexadecimal digits>. */
export function imageDigestOf(image: string): string {
  return image.slice(image.lastIndexOf('@') + 1);
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

/** The wait of an upgrade deploy, and whether its live deploy may record the requested digest. */
export async function finishImageDeploy(parts: FleetDeployParts, started: StartedImageDeploy, signal: AbortSignal): Promise<ImageDeployEnd> {
  const wait = await waitForStartedDeploy(parts, started, signal);
  if (wait.status === 'failed') return { status: 'stopped', reason: `did not reach live: ${wait.reason}` };
  const { deploy, identity, seconds } = wait;
  if (deploy.imageDigest === started.digest) return { status: 'recordable', deploy, identity, seconds };
  const runs = deploy.imageDigest === undefined ? ', digest unconfirmed: the deploy names no digest' : ` with ${shortDigestOf(deploy.imageDigest)}, not ${shortDigestOf(started.digest)}`;
  return { status: 'stopped', reason: `${deploy.id} live after ${seconds} s${runs}; the registry keeps its digest` };
}

// The reason of a deploy call that the platform did not take. An unknown answer can still have started a deploy.
function startFailureOf(start: Exclude<DeployStart, { readonly status: 'started' }>): string {
  if (start.status === 'gone') return 'the tenant service no longer exists';
  if (start.status === 'rate-limited') return `the platform limits the deploys of the service for ${Math.ceil(start.retryAfterMs / 1_000)} s`;
  return start.status === 'unknown' ? `the deploy call got no clear answer (${start.reason}); a deploy can run, so read the status first` : start.reason;
}

// The first 12 hexadecimal digits of a digest, as the lines of the fleet script show it.
function shortDigestOf(digest: string): string {
  return `${digest.slice(0, 19)}…`;
}
