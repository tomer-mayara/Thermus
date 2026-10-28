import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RemovableState } from '../../../src/tenancy/tenants/tenant-fleet-store.ts';
import { removeTenant, type RemovableRow } from '../../../src/tenancy/tenants/tenant-removal.ts';
import { TenantFleetStoreFake } from '../../support/doubles/tenants/tenant-fleet-store-fake.ts';
import { TenantPlatformFake } from './fixtures/tenant-platform-fake.ts';

// The removal of a tenant, which the organization sweep and the delete command of the fleet script share: the platform
// deletes the service first, then the row becomes deleted from the state that the caller read.

const signal = new AbortController().signal;

function fleetOf(state: RemovableState, serviceId: string | null = 'srv-a'): { readonly store: TenantFleetStoreFake; readonly row: RemovableRow } {
  const store = new TenantFleetStoreFake();
  store.put({ organizationId: 'org_A', state, serviceId, serviceName: 'thermus-tenant-org-a', internalUrl: serviceId === null ? null : 'http://thermus-tenant-org-a:8080' });
  return { store, row: { organizationId: 'org_A', state, serviceId } };
}

test('Given a live row with its service, when the tenant is removed, then the platform deletes the service before the row becomes deleted', async () => {
  const platform = new TenantPlatformFake();
  const { store, row } = fleetOf('live');
  const order: string[] = [];
  platform.onCall = (call) => order.push(call);
  store.beforeChange = (operation) => order.push(`registry ${operation}`);

  assert.deepEqual(await removeTenant({ platform, store }, row, signal), { status: 'deleted' });

  assert.deepEqual(order, ['delete srv-a', 'registry deleted']);
  assert.equal(store.stateOf('org_A'), 'deleted');
  assert.equal(store.row('org_A').internalUrl, null);
});

test('Given a row without a service, when the tenant is removed, then no platform call goes and the row becomes deleted', async () => {
  const platform = new TenantPlatformFake();
  const { store, row } = fleetOf('requested', null);
  assert.deepEqual(await removeTenant({ platform, store }, row, signal), { status: 'deleted' });
  assert.deepEqual(platform.calls, []);
  assert.equal(store.stateOf('org_A'), 'deleted');
});

test('Given a delete that the platform refuses or cannot do, when the tenant is removed, then the row stays as it is, and the reason says so', async () => {
  for (const deletion of [{ status: 'refused', reason: 'The tenant registry does not own the Render service srv-a.' }, { status: 'unavailable', reason: 'Render answered 503' }] as const) {
    const platform = new TenantPlatformFake();
    platform.deletions.push(deletion);
    const { store, row } = fleetOf('suspended');
    assert.deepEqual(await removeTenant({ platform, store }, row, signal), { status: 'failed', reason: `The platform did not delete the tenant service srv-a: ${deletion.reason}` });
    assert.equal(store.stateOf('org_A'), 'suspended');
  }
});

test('Given a row that another writer moved during the removal, when the row is marked, then the result is moved, and a repeat finishes it', async () => {
  const platform = new TenantPlatformFake();
  const { store, row } = fleetOf('live');
  store.beforeChange = () => { store.row('org_A').state = 'suspended'; };

  assert.deepEqual(await removeTenant({ platform, store }, row, signal), { status: 'moved' });
  assert.equal(store.stateOf('org_A'), 'suspended');

  store.beforeChange = () => {};
  assert.deepEqual(await removeTenant({ platform, store }, { ...row, state: 'suspended' }, signal), { status: 'deleted' });
});

test('Given a registry that does not take the deleted state, when the tenant is removed, then the result is failed and names the deleted service', async () => {
  const platform = new TenantPlatformFake();
  const { store, row } = fleetOf('failed');
  store.fleetUnavailable.add('deleted');
  assert.deepEqual(await removeTenant({ platform, store }, row, signal), {
    status: 'failed', reason: 'The platform deleted the tenant service srv-a, but the tenant registry did not take the deleted state. A repeat finishes the removal.',
  });
});
