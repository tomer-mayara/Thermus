import assert from 'node:assert/strict';
import test from 'node:test';
import type { TestContext } from 'node:test';
import { createPgSettingsRuntime } from '../../../src/runtime/sql/bounded-sql-runtime.ts';
import { PgTenantRegistryStore } from '../../../src/tenancy/tenants/pg-tenant-registry-store.ts';
import { TenantRequests } from '../../../src/tenancy/tenants/tenant-requests.ts';
import { postgresSettingsSite } from '../../support/in-process/postgres-settings-site.ts';

type Site = Awaited<ReturnType<typeof postgresSettingsSite>>;

function storeOn(t: TestContext, site: Site): PgTenantRegistryStore {
  const runtime = createPgSettingsRuntime(site.connection);
  t.after(() => runtime.close());
  return new PgTenantRegistryStore(runtime);
}

async function tenantRows(site: Site): Promise<string[]> {
  const rows = await site.ownerQuery("SELECT organization_id || ' ' || state FROM thermus_admin.tenants ORDER BY organization_id");
  return rows === '' ? [] : rows.split('\n');
}

test('Given a suspended row, when two pools mark it resuming at the same time, then one write moves it to deploying with its service ID, the other finds it moved, and a restore after a failed resume makes it suspended again', { timeout: 60_000 }, async (t) => {
  const site = await postgresSettingsSite(t);
  const [first, second] = [storeOn(t, site), storeOn(t, site)];
  assert.deepEqual(await new TenantRequests(first, 25).request('org_A'), { status: 'requested' });
  await site.ownerQuery("UPDATE thermus_admin.tenants SET state = 'suspended', render_service_id = 'srv-d0tenantaaaaaaaaaaaa', updated_at = now() - interval '1 day' WHERE organization_id = 'org_A'");

  const marks = await Promise.all([first.markResuming('org_A'), second.markResuming('org_A')]);
  const deployingSince = await site.ownerQuery("SELECT state || ' ' || (updated_at > now() - interval '1 minute') FROM thermus_admin.tenants WHERE organization_id = 'org_A'");
  const restored = await first.restoreSuspended('org_A', 'srv-d0tenantaaaaaaaaaaaa');
  const restoredAgain = await second.restoreSuspended('org_A', 'srv-d0tenantaaaaaaaaaaaa');

  assert.deepEqual(marks.map((mark) => mark.status).sort(), ['moved', 'resuming']);
  assert.deepEqual(marks.find((mark) => mark.status === 'resuming'), { status: 'resuming', serviceId: 'srv-d0tenantaaaaaaaaaaaa' });
  assert.equal(deployingSince, 'deploying true');
  assert.deepEqual([restored, restoredAgain], [{ status: 'recorded' }, { status: 'moved' }]);
  assert.deepEqual(await tenantRows(site), ['org_A suspended']);
});

// Each state-only write names the observed service (manager decision of 31 October 2026), so a failed resume of an old
// service cannot restore a row that another writer gave a new service.
test('Given a deploying row that another writer gave a new service, when a restore after a failed resume names the old service, then the row stays deploying on its new service', { timeout: 60_000 }, async (t) => {
  const site = await postgresSettingsSite(t);
  const store = storeOn(t, site);
  assert.deepEqual(await new TenantRequests(store, 25).request('org_A'), { status: 'requested' });
  await site.ownerQuery("UPDATE thermus_admin.tenants SET state = 'deploying', render_service_id = 'srv-d0tenantnewaaaaaaa' WHERE organization_id = 'org_A'");

  assert.deepEqual(await store.restoreSuspended('org_A', 'srv-d0tenantoldaaaaaaa'), { status: 'moved' });
  assert.equal(await site.ownerQuery("SELECT state || ' ' || render_service_id FROM thermus_admin.tenants WHERE organization_id = 'org_A'"), 'deploying srv-d0tenantnewaaaaaaa');
});

test('Given a suspended row without a service ID, or a row in another state, when the gateway marks it resuming, then nothing changes', { timeout: 60_000 }, async (t) => {
  const site = await postgresSettingsSite(t);
  const store = storeOn(t, site);
  const requests = new TenantRequests(store, 25);
  for (const organizationId of ['org_A', 'org_B']) assert.deepEqual(await requests.request(organizationId), { status: 'requested' });
  await site.ownerQuery("UPDATE thermus_admin.tenants SET state = 'suspended' WHERE organization_id = 'org_A'");

  assert.deepEqual(await store.markResuming('org_A'), { status: 'moved' });
  assert.deepEqual(await store.markResuming('org_B'), { status: 'moved' });
  assert.deepEqual(await store.restoreSuspended('org_B', 'srv-d0tenantaaaaaaaaaaaa'), { status: 'moved' });
  assert.deepEqual(await tenantRows(site), ['org_A suspended', 'org_B requested']);
});

test('Given a row, when the gateway records its use, then last_active_at gets the time of the database and the state and updated_at stay; an organization without a row gets no row', { timeout: 60_000 }, async (t) => {
  const site = await postgresSettingsSite(t);
  const store = storeOn(t, site);
  assert.deepEqual(await new TenantRequests(store, 25).request('org_A'), { status: 'requested' });
  await site.ownerQuery("UPDATE thermus_admin.tenants SET state = 'live', render_service_id = 'srv-d0tenantaaaaaaaaaaaa', internal_url = 'http://thermus-tenant-org-a:8080', updated_at = now() - interval '1 day' WHERE organization_id = 'org_A'");

  assert.deepEqual(await store.recordActive('org_A'), { status: 'recorded' });
  assert.deepEqual(await store.recordActive('org_NONE'), { status: 'moved' });

  assert.equal(await site.ownerQuery("SELECT state || ' ' || (last_active_at > now() - interval '1 minute') || ' ' || (updated_at < now() - interval '1 hour') FROM thermus_admin.tenants WHERE organization_id = 'org_A'"), 'live true true');
  assert.deepEqual(await tenantRows(site), ['org_A live']);
});
