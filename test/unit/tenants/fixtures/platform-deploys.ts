import type { DeployRead, PlatformDeploy } from '../../../../src/tenancy/tenants/tenant-platform.ts';

// Fixture data of the deploy reads of the tenant platform, for the queues of the platform fake: a deploy with its
// progress, the Render status of that progress, and its digest when the platform gives one.

export function deployOf(id: string, progress: PlatformDeploy['progress'], imageDigest?: string): PlatformDeploy {
  const status = { live: 'live', failed: 'update_failed', pending: 'update_in_progress' }[progress];
  return { id, progress, status, ...(imageDigest === undefined ? {} : { imageDigest }) };
}

export function found(id: string, progress: PlatformDeploy['progress'], imageDigest?: string): DeployRead {
  return { status: 'found', deploy: deployOf(id, progress, imageDigest) };
}
