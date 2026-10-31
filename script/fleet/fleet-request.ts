// The request command: a tenant for an organization that WorkOS has. Without a row, it inserts a requested row inside
// FREE_TENANT_LIMIT, as signup and the gateway do; a deleted row becomes requested again, the repair "delete, then
// request". The provisioner of the control plane then creates the service.
import { reviveTenant, TenantRequests } from '../../src/tenancy/tenants/tenant-requests.ts';
import { confirmed } from './fleet-confirm.ts';
import type { CommandParts } from './fleet-reads.ts';
import { FleetStepError, rowOfOrganization } from './fleet-rows.ts';
import { freeTenantLimitOf } from './fleet-settings.ts';

export async function requestTenant({ context, io, prefix, signal }: CommandParts, organizationId: string): Promise<void> {
  const read = await context.inventory().readOrganization(organizationId, signal);
  if (read.status === 'unavailable') throw new FleetStepError(`The read of the organization ${organizationId} failed: ${read.reason}. Nothing changed.`);
  if (read.status === 'absent') throw new FleetStepError(`WorkOS has no organization ${organizationId}. Nothing changed.`);
  const stores = await context.stores();
  const row = await rowOfOrganization(stores.fleet, prefix, organizationId);
  if (row !== undefined && row.state !== 'deleted') {
    io.line(`The organization ${organizationId} has a row in state ${row.state}. A request keeps it: nothing to do.`);
    return;
  }
  const limit = freeTenantLimitOf(context.environment);
  const action = row === undefined ? 'insert a requested row' : 'move the deleted row back to requested, as a new request without its old service';
  const plan = [`Request a tenant for ${organizationId}: ${action}, inside FREE_TENANT_LIMIT ${limit}.`, 'The provisioner of the control plane then creates its service.'];
  if (!await confirmed(io, plan)) return;
  const result = row === undefined ? await new TenantRequests(stores.registry, limit).request(organizationId) : await reviveTenant(stores.fleet, organizationId, limit);
  if (result.status === 'requested' || result.status === 'revived') {
    io.line(`Done: the row of ${organizationId} is requested.`);
    return;
  }
  throw new FleetStepError(`The request did not change the row: ${result.status === 'present' ? `the row is now in state ${result.state}` : result.status}.`);
}
