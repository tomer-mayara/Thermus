// The read commands of the fleet script: list, status, and summary. They change nothing, so they ask for no yes.
import { PRODUCTION_SERVICE_ID } from '../../src/tenancy/providers/render/render-tenant-platform.ts';
import { FleetSummary, fleetSummaryLine } from '../../src/tenancy/tenants/fleet-summary.ts';
import type { FleetIo } from './fleet-confirm.ts';
import type { FleetContext } from './fleet-context.ts';
import { counted, existingRow, FleetStepError, rowLine, rowsOfPrefix, shortDigest } from './fleet-rows.ts';
import { freePlanOf } from './fleet-settings.ts';

export interface CommandParts {
  readonly context: FleetContext;
  readonly io: FleetIo;
  readonly prefix: string;
  readonly signal: AbortSignal;
}

/** list: one line for each row of the prefix, from the registry alone. */
export async function listTenants({ context, io, prefix }: CommandParts): Promise<void> {
  const { rows, otherPrefix, production } = await rowsOfPrefix((await context.stores()).fleet, prefix);
  io.line(`Tenants of the prefix ${prefix}: ${counted(rows.length, 'row', 'rows')}.${otherPrefix === 0 ? '' : ` ${counted(otherPrefix, 'row', 'rows')} of another prefix not shown.`}`);
  if (production > 0) io.line(`${counted(production, 'row names', 'rows name')} the production service ${PRODUCTION_SERVICE_ID}: a fault of the registry. No command reads or changes such a row; tell the owner.`);
  for (const row of rows) io.line(rowLine(row));
}

/** status: the row of one organization, and its newest deploy and internal address on the platform. */
export async function tenantStatus({ context, io, prefix, signal }: CommandParts, organizationId: string): Promise<void> {
  const row = await existingRow((await context.stores()).fleet, prefix, organizationId);
  io.line(rowLine(row));
  if (row.serviceId === null) {
    io.line('The row has no service yet.');
    return;
  }
  const platform = await context.platform();
  const deploy = await platform.newestDeploy(row.serviceId, signal);
  if (deploy.status === 'found') io.line(`Newest deploy: ${deploy.deploy.id} ${deploy.deploy.status}, digest ${shortDigest(deploy.deploy.imageDigest ?? null)}.`);
  else io.line(`Newest deploy: ${deploy.status === 'unavailable' ? `unavailable (${deploy.reason})` : deploy.status}.`);
  const address = await platform.internalAddress(row.serviceId, signal);
  io.line(`Internal address: ${address.status === 'found' ? address.internalUrl : address.status}.`);
}

/** summary: the line of the daily summary of the control plane, made now from this registry, Render, and WorkOS. */
export async function fleetSummary({ context, io, signal }: CommandParts): Promise<void> {
  const summary = new FleetSummary({ store: (await context.stores()).fleet, platform: await context.platform(), inventory: context.inventory(), freePlan: freePlanOf(context.environment) });
  const record = await summary.record(Date.now(), signal);
  if (record === undefined) throw new FleetStepError('The tenant registry cannot be read.');
  io.line(fleetSummaryLine(record));
}
