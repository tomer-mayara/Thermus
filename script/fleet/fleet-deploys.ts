// The wait of the fleet script for the deploy that a write started: a deploy other than the newest deploy before the
// write, until it is live or failed, read every 5 s for at most 15 minutes, the bounds of the provisioner. A deploy that
// reaches live counts as healthy: there is no health probe over the private network (answer 1 of 27 October 2026).
import type { ProvisioningClock } from '../../src/tenancy/tenants/provisioning-clock.ts';
import type { PlatformDeploy, TenantPlatform } from '../../src/tenancy/tenants/tenant-platform.ts';

const POLL_MS = 5_000;
const BUDGET_MS = 15 * 60_000;

export type NewDeploy =
  | { readonly status: 'live'; readonly deploy: PlatformDeploy; readonly seconds: number }
  | { readonly status: 'failed'; readonly reason: string };

/** The ID of the newest deploy before a write, undefined for none, or the reason that the read failed. */
export async function newestDeployId(platform: Pick<TenantPlatform, 'newestDeploy'>, serviceId: string, signal: AbortSignal): Promise<{ readonly id?: string } | { readonly failure: string }> {
  const read = await platform.newestDeploy(serviceId, signal);
  if (read.status === 'found') return { id: read.deploy.id };
  if (read.status === 'none') return {};
  return { failure: read.status === 'gone' ? 'the tenant service no longer exists' : `the deploy list is unavailable (${read.reason})` };
}

export async function newDeployOf(parts: { readonly platform: Pick<TenantPlatform, 'newestDeploy'>; readonly clock: ProvisioningClock }, serviceId: string, previousId: string | undefined, signal: AbortSignal): Promise<NewDeploy> {
  const started = parts.clock.now();
  let seen = 'no read';
  for (;;) {
    const read = await parts.platform.newestDeploy(serviceId, signal);
    if (read.status === 'gone') return { status: 'failed', reason: 'the tenant service no longer exists' };
    if (read.status === 'found' && read.deploy.id !== previousId) {
      const { deploy } = read;
      if (deploy.progress === 'live') return { status: 'live', deploy, seconds: Math.round((parts.clock.now() - started) / 100) / 10 };
      if (deploy.progress === 'failed') return { status: 'failed', reason: `the deploy ${deploy.id} ended as ${deploy.status}` };
    }
    seen = read.status === 'found' ? `${read.deploy.id} ${read.deploy.status}` : read.status;
    if (parts.clock.now() - started + POLL_MS >= BUDGET_MS) return { status: 'failed', reason: `no new deploy reached live within 15 minutes; last seen: ${seen}` };
    await parts.clock.sleep(POLL_MS, signal);
  }
}
