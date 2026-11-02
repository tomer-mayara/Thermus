// The delete command: the Render service of the tenant first, through the adapter and its write guard, then the row
// deleted from the state and the service that the command read (answer 7 of 27 October 2026, manager decision of 31
// October 2026). It is the removal that the weekly organization sweep of the control plane uses too. The command reads
// the organization in WorkOS before its confirmation. That read gives the cause of the removal (owner decision of
// 2 November 2026). An organization that WorkOS no longer has gives organization-absent: the deleted row loses its
// organization name, as after the sweep. An organization that WorkOS has gives operator: the row keeps the name, so the
// repair "delete, then request" gives the revived row the same service name. A failed read stops the command.
import type { FleetRow } from '../../src/tenancy/tenants/tenant-fleet-store.ts';
import { removalCauseOf, removeTenant, type RemovalCause } from '../../src/tenancy/tenants/tenant-removal.ts';
import { confirmed } from './fleet-confirm.ts';
import type { CommandParts } from './fleet-reads.ts';
import { existingRow, FleetStepError, rowLine } from './fleet-rows.ts';

export async function deleteTenant(parts: CommandParts, organizationId: string): Promise<void> {
  const stores = await parts.context.stores();
  const row = await existingRow(stores.fleet, parts.prefix, organizationId);
  if (row.state === 'deleted') {
    parts.io.line(`${rowLine(row)}\nThe row is deleted already: nothing to do.`);
    return;
  }
  const cause = await removalCause(parts, organizationId);
  if (!await confirmed(parts.io, planOf(row, cause))) return;
  const { state } = row;
  const removal = await removeTenant({ platform: await parts.context.platform(), store: stores.fleet }, { organizationId, serviceId: row.serviceId, state, cause }, parts.signal);
  if (removal.status === 'failed') throw new FleetStepError(removal.reason);
  if (removal.status === 'moved') throw new FleetStepError(`The row of ${organizationId} changed during the delete. Read the status, then run the command again.`);
  parts.io.line(doneLine(row, cause));
}

/** The plan before the answer yes: the row, the service and the delete, the cause with what the row keeps, and a warning for a row in work. */
function planOf(row: FleetRow, cause: RemovalCause): string[] {
  const { organizationId, state } = row;
  return [
    rowLine(row),
    row.serviceId === null ? `The row has no service. Set the row of ${organizationId} deleted.` : `Delete the Render service ${row.serviceId} (${row.serviceName ?? 'no name'}) of ${organizationId}, then set the row deleted. A delete cannot be undone.`,
    causeLine(cause, organizationId),
    ...(state === 'creating' || state === 'deploying' ? [`The row is ${state}: the provisioner of the control plane can still work on it, and a service that it creates after this delete stays without a row (runbook 2).`] : []),
  ];
}

function doneLine(row: FleetRow, cause: RemovalCause): string {
  const service = row.serviceId === null ? 'no service to delete' : `${row.serviceId} is deleted`;
  const name = cause === 'organization-absent' ? ' without its organization name' : '';
  return `Done: ${service}, and the row of ${row.organizationId} is deleted${name}.`;
}

/** The cause of the removal, from the read of the organization in WorkOS; a failed read stops the command before the confirmation. */
async function removalCause({ context, signal }: CommandParts, organizationId: string): Promise<RemovalCause> {
  const read = await context.inventory().readOrganization(organizationId, signal);
  if (read.status === 'unavailable') throw new FleetStepError(`The read of the organization ${organizationId} failed: ${read.reason}. Nothing changed.`);
  return removalCauseOf(read);
}

// The line of the plan that names the cause, so the operator sees what the deleted row keeps before the answer yes.
function causeLine(cause: RemovalCause, organizationId: string): string {
  if (cause === 'organization-absent') return `WorkOS has no organization ${organizationId}: the deleted row loses its organization name, if it has one, as after the organization sweep.`;
  return `WorkOS has the organization ${organizationId}: the deleted row keeps its organization name, if it has one, so a later request gives the revived row the same service name.`;
}
