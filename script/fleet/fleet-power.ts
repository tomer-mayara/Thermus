// The suspend and resume commands. Each sends its one call to the platform first, and the registry follows only when the
// platform took the call, so a refused or failed call changes no row. Each mark names the state and the service that
// the command read, so a row that another writer changed or replaced stays as it is. A resume then waits until the
// first new deploy after it is live, and records the row live on its service, as the provisioner records a resumed row.
// Render names no deploy in the answer of a resume, so the identity of that deploy stays unconfirmed. Since SO-10, the
// next MCP call of the organization also resumes a suspended tenant; the resume command brings it back without a call.
import { systemClock } from '../../src/app/system-clock.ts';
import { newestDeployBefore, waitForStartedDeploy } from '../../src/tenancy/tenants/fleet-deploy-wait.ts';
import { serviceChangeReason } from '../../src/tenancy/tenants/service-change-reason.ts';
import type { FleetRow } from '../../src/tenancy/tenants/tenant-fleet-store.ts';
import type { ServiceChange } from '../../src/tenancy/tenants/tenant-platform.ts';
import { confirmed } from './fleet-confirm.ts';
import type { CommandParts } from './fleet-reads.ts';
import { existingRow, FleetStepError, rowLine } from './fleet-rows.ts';

type ServiceRow = FleetRow & { readonly serviceId: string };

export async function suspendTenant(parts: CommandParts, organizationId: string): Promise<void> {
  const row = await rowIn(parts, organizationId, 'live', 'Only a live tenant is suspended.');
  if (!await confirmed(parts.io, [rowLine(row), `Suspend the Render service ${row.serviceId} of ${organizationId}, then set the row suspended. A suspended tenant costs nothing. The next MCP call of the organization resumes it: the calls of about a minute get a 503 with Retry-After 60 until the tenant is live. fleet.ts resume brings it back without a call.`])) return;
  const platform = await parts.context.platform();
  changed(await platform.suspendService(row.serviceId, parts.signal), 'suspend');
  const marked = await (await parts.context.stores()).fleet.markSuspended(organizationId, row.serviceId);
  if (marked.status !== 'recorded') throw new FleetStepError(`Render took the suspend, but the row did not move to suspended (${marked.status}). Read the status, then run the command again.`);
  parts.io.line(`Done: ${row.serviceId} is suspended, and the row is suspended.`);
}

export async function resumeTenant(parts: CommandParts, organizationId: string): Promise<void> {
  const row = await rowIn(parts, organizationId, 'suspended', 'Only a suspended tenant is resumed.');
  if (!await confirmed(parts.io, [rowLine(row), `Resume the Render service ${row.serviceId} of ${organizationId}, set the row deploying, and wait until the deploy of the resume is live; then the row is live.`])) return;
  const { platform, stores } = { platform: await parts.context.platform(), stores: await parts.context.stores() };
  const before = await newestDeployBefore(platform, row.serviceId, parts.signal);
  if (before.status === 'failed') throw new FleetStepError(`The resume did not start: ${before.reason}. Nothing changed.`);
  changed(await platform.resumeService(row.serviceId, parts.signal), 'resume');
  const marked = await stores.fleet.markResumed(organizationId, row.serviceId);
  if (marked.status !== 'recorded') throw new FleetStepError(`Render took the resume, but the row did not move to deploying (${marked.status}). Read the status; the provisioner of the control plane finishes a deploying row.`);
  parts.io.line(`Render took the resume, and the row is deploying. Waiting for the first new deploy after the resume.`);
  const deploy = await waitForStartedDeploy({ platform, clock: systemClock }, { kind: 'unnamed', serviceId: row.serviceId, before: before.id }, parts.signal);
  if (deploy.status === 'failed') throw new FleetStepError(`The deploy of the resume did not reach live: ${deploy.reason}. The row stays deploying.`);
  const live = `${deploy.deploy.id} is live after ${deploy.seconds} s (the answer of a resume names no deploy: identity unconfirmed)`;
  const address = await platform.internalAddress(row.serviceId, parts.signal);
  if (address.status !== 'found') throw new FleetStepError(`${live}, but the internal address is ${address.status}. The row stays deploying; the provisioner records it.`);
  const recorded = await stores.provisioning.recordLive(organizationId, row.serviceId, { internalUrl: address.internalUrl, ...(deploy.deploy.imageDigest === undefined ? {} : { imageDigest: deploy.deploy.imageDigest }) });
  parts.io.line(recorded.status === 'recorded' ? `Done: ${live}, and the row is live.` : `${live}; the row was not recorded (${recorded.status}): another writer changed it.`);
}

async function rowIn(parts: CommandParts, organizationId: string, state: 'live' | 'suspended', rule: string): Promise<ServiceRow> {
  const row = await existingRow((await parts.context.stores()).fleet, parts.prefix, organizationId);
  if (row.state !== state || row.serviceId === null) throw new FleetStepError(`The tenant of ${organizationId} is ${row.state}. ${rule} Nothing changed.`);
  return row as ServiceRow;
}

function changed(change: ServiceChange, call: 'suspend' | 'resume'): void {
  if (change.status === 'accepted') return;
  throw new FleetStepError(`Render did not take the ${call}: ${serviceChangeReason(change)}. ${change.status === 'unknown' ? 'The call can have reached Render: read the status first.' : 'Nothing changed.'}`);
}
