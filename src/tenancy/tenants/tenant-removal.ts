import type { FleetRow, RemovableState, TenantFleetStore } from './tenant-fleet-store.ts';
import type { TenantPlatform } from './tenant-platform.ts';

/** deleted: the service is gone and the row is deleted. moved: another writer changed the row; a repeat finishes it. */
export type RemovalOutcome =
  | { readonly status: 'deleted' | 'moved' }
  | { readonly status: 'failed'; readonly reason: string };

export interface RemovalParts {
  readonly platform: Pick<TenantPlatform, 'deleteService'>;
  readonly store: Pick<TenantFleetStore, 'markDeleted'>;
}

/** The row of a tenant to remove, with the state and the service that the caller read. */
export type RemovableRow = Pick<FleetRow, 'organizationId' | 'serviceId'> & { readonly state: RemovableState };

/**
 * Removes the tenant of a row: the platform deletes its service first, and then the row becomes deleted from the state
 * and the service that the caller read. A row without a service ID has no service to delete. A failed delete leaves the
 * row as it is, so the next sweep or command finds it again; an absent service counts as deleted, so a repeat is safe.
 * A row that another writer changed meanwhile, also a replacement with a new service in the same state, is moved.
 */
export async function removeTenant(parts: RemovalParts, row: RemovableRow, signal: AbortSignal): Promise<RemovalOutcome> {
  const { serviceId } = row;
  if (serviceId !== null) {
    const deletion = await parts.platform.deleteService(serviceId, signal);
    if (deletion.status !== 'deleted') return { status: 'failed', reason: `The platform did not delete the tenant service ${serviceId}: ${deletion.reason}` };
  }
  const marked = await parts.store.markDeleted(row.organizationId, row.state, serviceId);
  if (marked.status !== 'unavailable') return { status: marked.status === 'recorded' ? 'deleted' : 'moved' };
  const lead = serviceId === null ? 'The' : `The platform deleted the tenant service ${serviceId}, but the`;
  return { status: 'failed', reason: `${lead} tenant registry did not take the deleted state. A repeat finishes the removal.` };
}
