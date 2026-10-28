// The suspend and resume commands. Each sends its one call to the platform first, and the registry follows only when the
// platform took the call, so a refused or failed call changes no row. A resume then waits until the deploy that Render
// starts for it is live, and records the row live, as the provisioner records a resumed row.
import { systemClock } from '../../src/app/system-clock.ts';
import type { FleetRow } from '../../src/tenancy/tenants/tenant-fleet-store.ts';
import type { ServiceChange } from '../../src/tenancy/tenants/tenant-platform.ts';
import { confirmed } from './fleet-confirm.ts';
import { newDeployOf, newestDeployId } from './fleet-deploys.ts';
import type { CommandParts } from './fleet-reads.ts';
import { existingRow, FleetStepError, rowLine } from './fleet-rows.ts';

type ServiceRow = FleetRow & { readonly serviceId: string };

export async function suspendTenant(parts: CommandParts, organizationId: string): Promise<void> {
  const row = await rowIn(parts, organizationId, 'live', 'Only a live tenant is suspended.');
  if (!await confirmed(parts.io, [rowLine(row), `Suspend the Render service ${row.serviceId} of ${organizationId}, then set the row suspended. A suspended tenant costs nothing; the next MCP call of the organization resumes it through the gateway.`])) return;
  const platform = await parts.context.platform();
  changed(await platform.suspendService(row.serviceId, parts.signal), 'suspend');
  const marked = await (await parts.context.stores()).fleet.markSuspended(organizationId);
  if (marked.status !== 'recorded') throw new FleetStepError(`Render took the suspend, but the row did not move to suspended (${marked.status}). Read the status, then run the command again.`);
  parts.io.line(`Done: ${row.serviceId} is suspended, and the row is suspended.`);
}

export async function resumeTenant(parts: CommandParts, organizationId: string): Promise<void> {
  const row = await rowIn(parts, organizationId, 'suspended', 'Only a suspended tenant is resumed.');
  if (!await confirmed(parts.io, [rowLine(row), `Resume the Render service ${row.serviceId} of ${organizationId}, set the row deploying, and wait until the deploy of the resume is live; then the row is live.`])) return;
  const { platform, stores } = { platform: await parts.context.platform(), stores: await parts.context.stores() };
  const previous = await newestDeployId(platform, row.serviceId, parts.signal);
  if ('failure' in previous) throw new FleetStepError(`The resume did not start: ${previous.failure}. Nothing changed.`);
  changed(await platform.resumeService(row.serviceId, parts.signal), 'resume');
  const marked = await stores.fleet.markResumed(organizationId);
  if (marked.status !== 'recorded') throw new FleetStepError(`Render took the resume, but the row did not move to deploying (${marked.status}). Read the status; the provisioner of the control plane finishes a deploying row.`);
  parts.io.line(`Render took the resume, and the row is deploying. Waiting for the deploy of the resume.`);
  const deploy = await newDeployOf({ platform, clock: systemClock }, row.serviceId, previous.id, parts.signal);
  if (deploy.status === 'failed') throw new FleetStepError(`The deploy of the resume did not reach live: ${deploy.reason}. The row stays deploying.`);
  const address = await platform.internalAddress(row.serviceId, parts.signal);
  if (address.status !== 'found') throw new FleetStepError(`${deploy.deploy.id} is live after ${deploy.seconds} s, but the internal address is ${address.status}. The row stays deploying; the provisioner records it.`);
  const recorded = await stores.provisioning.recordLive(organizationId, { internalUrl: address.internalUrl, ...(deploy.deploy.imageDigest === undefined ? {} : { imageDigest: deploy.deploy.imageDigest }) });
  parts.io.line(recorded.status === 'recorded' ? `Done: ${deploy.deploy.id} is live after ${deploy.seconds} s, and the row is live.` : `${deploy.deploy.id} is live after ${deploy.seconds} s; the row was not recorded (${recorded.status}): another writer can have recorded it.`);
}

async function rowIn(parts: CommandParts, organizationId: string, state: 'live' | 'suspended', rule: string): Promise<ServiceRow> {
  const row = await existingRow((await parts.context.stores()).fleet, parts.prefix, organizationId);
  if (row.state !== state || row.serviceId === null) throw new FleetStepError(`The tenant of ${organizationId} is ${row.state}. ${rule} Nothing changed.`);
  return row as ServiceRow;
}

function changed(change: ServiceChange, call: 'suspend' | 'resume'): void {
  if (change.status === 'accepted') return;
  const reason = change.status === 'gone' ? 'the tenant service no longer exists'
    : change.status === 'rate-limited' ? `Render limits the calls of the service for ${Math.ceil(change.retryAfterMs / 1_000)} s` : change.reason;
  throw new FleetStepError(`Render did not take the ${call}: ${reason}. ${change.status === 'unknown' ? 'The call can have reached Render: read the status first.' : 'Nothing changed.'}`);
}
