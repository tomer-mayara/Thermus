// The delete command: the Render service of the tenant first, through the adapter and its write guard, then the row
// deleted from the state and the service that the command read (answer 7 of 27 October 2026, manager decision of 31
// October 2026). It is the removal that the weekly organization sweep of the control plane uses too.
import { removeTenant } from '../../src/tenancy/tenants/tenant-removal.ts';
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
  const { state } = row;
  const plan = [
    rowLine(row),
    row.serviceId === null ? `The row has no service. Set the row of ${organizationId} deleted.` : `Delete the Render service ${row.serviceId} (${row.serviceName ?? 'no name'}) of ${organizationId}, then set the row deleted. A delete cannot be undone.`,
    ...(state === 'creating' || state === 'deploying' ? [`The row is ${state}: the provisioner of the control plane can still work on it, and a service that it creates after this delete stays without a row (runbook 2).`] : []),
  ];
  if (!await confirmed(parts.io, plan)) return;
  const removal = await removeTenant({ platform: await parts.context.platform(), store: stores.fleet }, { organizationId, serviceId: row.serviceId, state }, parts.signal);
  if (removal.status === 'failed') throw new FleetStepError(removal.reason);
  if (removal.status === 'moved') throw new FleetStepError(`The row of ${organizationId} changed during the delete. Read the status, then run the command again.`);
  parts.io.line(`Done: ${row.serviceId === null ? 'no service to delete' : `${row.serviceId} is deleted`}, and the row of ${organizationId} is deleted.`);
}
