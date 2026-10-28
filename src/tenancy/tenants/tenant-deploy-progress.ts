import type { PlatformDeploy, TenantPlatform } from './tenant-platform.ts';
import type { LiveRecord } from './tenant-provisioning-store.ts';

/** live: the record of a live row. failed: the reason for the operator. pending: what the read saw. */
export type DeployProgressRead =
  | { readonly status: 'live'; readonly live: LiveRecord }
  | { readonly status: 'failed'; readonly reason: string }
  | { readonly status: 'pending'; readonly seen: string };

export type ProgressPlatform = Pick<TenantPlatform, 'newestDeploy' | 'internalAddress'>;

/**
 * One read of the newest deploy of a service, and of its address once the deploy is live. A failed read is pending,
 * because only a failed deploy or a gone service ends a deploy before its budget.
 */
export async function deployProgressOf(platform: ProgressPlatform, serviceId: string, signal: AbortSignal): Promise<DeployProgressRead> {
  const read = await platform.newestDeploy(serviceId, signal);
  if (read.status === 'gone') return { status: 'failed', reason: `The tenant service ${serviceId} no longer exists` };
  if (read.status === 'none') return pending('no deploy yet');
  if (read.status === 'unavailable') return pending(`the deploy list is unavailable (${read.reason})`);
  const { deploy } = read;
  if (deploy.progress === 'failed') return { status: 'failed', reason: `The deploy ${deploy.id} of ${serviceId} ended as ${deploy.status}` };
  return deploy.progress === 'pending' ? pending(`${deploy.id} ${deploy.status}`) : liveProgressOf(platform, deploy, { serviceId, signal });
}

// A live deploy is not yet a live row: the gateway needs the address of the service on the private network.
async function liveProgressOf(platform: ProgressPlatform, deploy: PlatformDeploy, service: { readonly serviceId: string; readonly signal: AbortSignal }): Promise<DeployProgressRead> {
  const address = await platform.internalAddress(service.serviceId, service.signal);
  if (address.status !== 'found') return pending(`${deploy.id} live, internal address ${address.status}`);
  const digest = deploy.imageDigest === undefined ? {} : { imageDigest: deploy.imageDigest };
  return { status: 'live', live: { internalUrl: address.internalUrl, ...digest } };
}

function pending(seen: string): DeployProgressRead {
  return { status: 'pending', seen };
}
