// The rows of the tenant registry that the fleet script works on: the rows of its TENANT_NAME_PREFIX, never a row that
// names the production service, and the text of a row for the operator.
import { PRODUCTION_SERVICE_ID } from '../../src/tenancy/providers/render/render-tenant-platform.ts';
import type { FleetRow, TenantFleetStore } from '../../src/tenancy/tenants/tenant-fleet-store.ts';
import { FleetUsageError } from './fleet-settings.ts';

/**
 * The rows of the prefix: a row whose service has the prefix, or a row without a service name yet. A row that names the
 * production service is a fault of the registry: it is left out and counted, so no command reads or changes it.
 */
export interface PrefixRows {
  readonly rows: readonly FleetRow[];
  readonly otherPrefix: number;
  readonly production: number;
}

export class FleetStepError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FleetStepError';
  }
}

export async function rowsOfPrefix(fleet: Pick<TenantFleetStore, 'readFleet'>, prefix: string): Promise<PrefixRows> {
  const read = await fleet.readFleet();
  if (read.status !== 'complete') throw new FleetStepError('The tenant registry cannot be read. Nothing changed.');
  const usable = read.rows.filter((row) => row.serviceId !== PRODUCTION_SERVICE_ID);
  const rows = usable.filter((row) => row.serviceName === null || row.serviceName.startsWith(prefix));
  return { rows, otherPrefix: usable.length - rows.length, production: read.rows.length - usable.length };
}

/** The row of one organization, refused when it names the production service or a service of another prefix. */
export async function rowOfOrganization(fleet: Pick<TenantFleetStore, 'readFleet'>, prefix: string, organizationId: string): Promise<FleetRow | undefined> {
  const read = await fleet.readFleet();
  if (read.status !== 'complete') throw new FleetStepError('The tenant registry cannot be read. Nothing changed.');
  const row = read.rows.find((candidate) => candidate.organizationId === organizationId);
  if (row === undefined) return undefined;
  if (row.serviceId === PRODUCTION_SERVICE_ID) throw new FleetUsageError(`The row of ${organizationId} names the production service ${PRODUCTION_SERVICE_ID}. The fleet script never changes it.`);
  if (row.serviceName !== null && !row.serviceName.startsWith(prefix)) {
    throw new FleetUsageError(`The service ${row.serviceName} of ${organizationId} does not start with TENANT_NAME_PREFIX ${prefix}. Run the script with the prefix of that fleet.`);
  }
  return row;
}

/** The row of the organization, which must exist. */
export async function existingRow(fleet: Pick<TenantFleetStore, 'readFleet'>, prefix: string, organizationId: string): Promise<FleetRow> {
  const row = await rowOfOrganization(fleet, prefix, organizationId);
  if (row === undefined) throw new FleetStepError(`The tenant registry has no row for ${organizationId}. Nothing changed.`);
  return row;
}

/** A count with its noun, such as "1 batch" or "2 batches". */
export function counted(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function shortDigest(digest: string | null): string {
  return digest === null ? '-' : `${digest.slice(0, 19)}…`;
}

/** One line for each row: the organization, the state, the plan, the service, the digest, and the times. */
export function rowLine(row: FleetRow): string {
  const service = row.serviceId === null ? '-' : `${row.serviceId} ${row.serviceName ?? ''}`.trim();
  return [
    row.organizationId, row.state, `plan ${row.plan ?? '-'}`, service, `digest ${shortDigest(row.imageDigest)}`,
    `last use ${row.lastActiveAt ?? '-'}`, `updated ${row.updatedAt}`, row.failureReason === null ? '' : `reason: ${row.failureReason}`,
  ].filter((part) => part !== '').join('  ');
}
