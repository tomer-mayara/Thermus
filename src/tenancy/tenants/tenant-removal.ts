import type { FleetRow, FleetWrite, RemovableState, TenantFleetStore } from './tenant-fleet-store.ts';
import type { TenantPlatform } from './tenant-platform.ts';

/** deleted: the service is gone and the row is deleted. moved: another writer changed the row; a repeat finishes it. */
export type RemovalOutcome =
  | { readonly status: 'deleted' | 'moved' }
  | { readonly status: 'failed'; readonly reason: string };

export interface RemovalParts {
  readonly platform: Pick<TenantPlatform, 'deleteService'>;
  readonly store: Pick<TenantFleetStore, 'markDeleted' | 'markDeletedWithoutOrganizationName'>;
}

/** Why the tenant goes: the identity provider no longer has its organization (the sweep), or the operator deletes it (the fleet command). */
export type RemovalCause = 'organization-absent' | 'operator';

/** The row of a tenant to remove, with the state and the service that the caller read, and the cause of the removal. */
export type TenantRemoval = Pick<FleetRow, 'organizationId' | 'serviceId'> & { readonly state: RemovableState; readonly cause: RemovalCause };

/**
 * Removes the tenant of a row: the platform deletes its service first, and then the row becomes deleted from the state
 * and the service that the caller read. A row without a service ID has no service to delete. A failed delete leaves the
 * row as it is, so the next sweep or command finds it again; an absent service counts as deleted, so a repeat is safe.
 * A row that another writer changed meanwhile, also a replacement with a new service in the same state, is moved.
 * The deleted row of an absent organization loses its organization name; the delete of the operator keeps it, so the
 * repair "delete, then request" gives the revived row the same service name (2 November 2026). The service name stays
 * in both cases, for the record of the deleted service.
 */
export async function removeTenant(parts: RemovalParts, removal: TenantRemoval, signal: AbortSignal): Promise<RemovalOutcome> {
  const { serviceId } = removal;
  if (serviceId !== null) {
    const deletion = await parts.platform.deleteService(serviceId, signal);
    if (deletion.status !== 'deleted') return { status: 'failed', reason: `The platform did not delete the tenant service ${serviceId}: ${deletion.reason}` };
  }
  const marked = await deleteRow(parts.store, removal);
  if (marked.status !== 'unavailable') return { status: marked.status === 'recorded' ? 'deleted' : 'moved' };
  const lead = serviceId === null ? 'The' : `The platform deleted the tenant service ${serviceId}, but the`;
  return { status: 'failed', reason: `${lead} tenant registry did not take the deleted state. A repeat finishes the removal.` };
}

// The statement of the cause: the one of the sweep also clears the organization name.
function deleteRow(store: RemovalParts['store'], { organizationId, state, serviceId, cause }: TenantRemoval): Promise<FleetWrite> {
  if (cause === 'organization-absent') return store.markDeletedWithoutOrganizationName(organizationId, state, serviceId);
  return store.markDeleted(organizationId, state, serviceId);
}
