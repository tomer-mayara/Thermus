import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import type { TestContext } from 'node:test';
import { promisify } from 'node:util';
import { PgDestinationSettingsStore } from '../../../src/logs/audit/pg-destination-settings-store.ts';
import { loadFreeTenantLimit } from '../../../src/runtime/config/free-tenant-limit-config.ts';
import { createPgSettingsRuntime } from '../../../src/runtime/sql/bounded-sql-runtime.ts';
import { PgTenantRegistryStore } from '../../../src/tenancy/tenants/pg-tenant-registry-store.ts';
import { TenantLookup } from '../../../src/tenancy/tenants/tenant-lookup.ts';
import { TenantRequests } from '../../../src/tenancy/tenants/tenant-requests.ts';
import { postgresSettingsSite } from '../../support/in-process/postgres-settings-site.ts';

// The tenant registry of the control plane on disposable PostgreSQL 17, with verified test TLS and the scoped
// runtime role thermus_logging. The administrative owner plays the provisioner where a case needs a changed row.
// A clock double moves the time of the lookup; the database and its SQL run for real.

type Site = Awaited<ReturnType<typeof postgresSettingsSite>>;

const liveTenant = { renderServiceId: 'srv-d0tenantaaaaaaaaaaaa', internalUrl: 'http://thermus-tenant-org-a:8080' };

function registryOn(t: TestContext, site: Site, environment: Readonly<Record<string, string>> = {}) {
  const runtime = createPgSettingsRuntime(site.connection);
  t.after(() => runtime.close());
  const store = new PgTenantRegistryStore(runtime);
  const clock = { now: 0 };
  return { runtime, clock, requests: new TenantRequests(store, loadFreeTenantLimit(environment)), lookup: new TenantLookup(store, () => clock.now) };
}

async function openRegistry(t: TestContext, environment: Readonly<Record<string, string>> = {}) {
  const site = await postgresSettingsSite(t);
  return { site, ...registryOn(t, site, environment) };
}

async function tenantRows(site: Site): Promise<string[]> {
  const rows = await site.ownerQuery("SELECT organization_id || ' ' || state FROM thermus_admin.tenants ORDER BY organization_id");
  return rows === '' ? [] : rows.split('\n');
}

async function makeLive(site: Site, organizationId: string): Promise<void> {
  await site.ownerQuery(`UPDATE thermus_admin.tenants SET state = 'live', render_service_id = '${liveTenant.renderServiceId}',
    service_name = 'thermus-tenant-org_a', internal_url = '${liveTenant.internalUrl}', plan = 'free-plan', applied_plan = 'free-plan',
    image_digest = 'sha256:${'a'.repeat(64)}', updated_at = '2026-10-27T10:00:00Z' WHERE organization_id = '${organizationId}'`);
}

test('Given the migration, when it is applied, then the three tables exist with the columns of the data model and the seven tenant states', { timeout: 60_000 }, async (t) => {
  const site = await postgresSettingsSite(t);
  const columns = await site.ownerQuery(`SELECT table_name || ': ' || string_agg(column_name, ', ' ORDER BY ordinal_position)
    FROM information_schema.columns WHERE table_schema = 'thermus_admin' AND table_name IN ('tenants', 'subscriptions', 'billing_events')
    GROUP BY table_name ORDER BY table_name`);
  assert.deepEqual(columns.split('\n'), [
    'billing_events: stripe_event_id, type, received_at, applied_at',
    'subscriptions: organization_id, stripe_customer_id, stripe_subscription_id, status, current_period_end, cancel_at_period_end, terms_accepted_at, updated_at',
    'tenants: organization_id, render_service_id, service_name, internal_url, state, plan, applied_plan, image_digest, last_active_at, failure_reason, created_at, updated_at',
  ]);
  const keys = await site.ownerQuery(`SELECT constraints.table_name || ': ' || usage.column_name
    FROM information_schema.table_constraints constraints JOIN information_schema.key_column_usage usage USING (constraint_schema, constraint_name)
    WHERE constraints.table_schema = 'thermus_admin' AND constraints.constraint_type = 'PRIMARY KEY'
      AND constraints.table_name IN ('tenants', 'subscriptions', 'billing_events') ORDER BY 1`);
  assert.deepEqual(keys.split('\n'), ['billing_events: stripe_event_id', 'subscriptions: organization_id', 'tenants: organization_id']);
  await site.ownerQuery("INSERT INTO thermus_admin.tenants (organization_id, state) VALUES ('org_A', 'requested')");
  for (const state of ['creating', 'deploying', 'suspended', 'failed', 'deleted', 'requested']) {
    await site.ownerQuery(`UPDATE thermus_admin.tenants SET state = '${state}' WHERE organization_id = 'org_A'`);
  }
  await makeLive(site, 'org_A');
  await assert.rejects(site.ownerQuery("UPDATE thermus_admin.tenants SET state = 'paused' WHERE organization_id = 'org_A'"), /tenants_state_check/);
  assert.deepEqual(await tenantRows(site), ['org_A live']);
});

test('Given a tenants row for organization A, when the gateway asks for A, then it gets the state and the internal address of the row', { timeout: 60_000 }, async (t) => {
  const { site, requests, lookup } = await openRegistry(t);
  assert.deepEqual(await requests.request('org_A'), { status: 'requested' });
  await makeLive(site, 'org_A');
  assert.deepEqual(await lookup.find('org_A'), { status: 'found', state: 'live', internalUrl: liveTenant.internalUrl });
  assert.deepEqual(await lookup.find('org_B'), { status: 'absent' });
});

test('Given a changed row, when the refresh bound passes, then the lookup gives the new state, and a stale copy never outlives its bound', { timeout: 60_000 }, async (t) => {
  const { site, requests, lookup, clock } = await openRegistry(t);
  await requests.request('org_A');
  await makeLive(site, 'org_A');
  assert.deepEqual(await lookup.find('org_A'), { status: 'found', state: 'live', internalUrl: liveTenant.internalUrl });
  await site.ownerQuery("UPDATE thermus_admin.tenants SET state = 'suspended' WHERE organization_id = 'org_A'");
  clock.now = 9_999;
  assert.deepEqual(await lookup.find('org_A'), { status: 'found', state: 'live', internalUrl: liveTenant.internalUrl }, 'Inside the 10 s bound the copy answers');
  clock.now = 10_000;
  const suspended = { status: 'found', state: 'suspended', internalUrl: liveTenant.internalUrl };
  assert.deepEqual(await lookup.find('org_A'), suspended, 'At the bound the lookup reads the registry again');
  await promisify(execFile)('docker', ['stop', '--time', '0', site.container]);
  clock.now = 20_000;
  assert.deepEqual(await lookup.find('org_A'), suspended, 'A failed refresh keeps the copy that is younger than 60 s');
  clock.now = 69_999;
  assert.deepEqual(await lookup.find('org_A'), suspended);
  clock.now = 70_000;
  assert.deepEqual(await lookup.find('org_A'), { status: 'unavailable' }, 'The copy of 10 s is 60 s old: it is not served again');
  assert.deepEqual(await lookup.find('org_B'), { status: 'unavailable' });
});

test('Given organization A without a row, when two tenant requests for A arrive at the same time, then one row exists, in state requested', { timeout: 60_000 }, async (t) => {
  const { site, requests } = await openRegistry(t);
  const otherProcess = registryOn(t, site);
  const results = await Promise.all([requests.request('org_A'), otherProcess.requests.request('org_A')]);
  assert.deepEqual(results.map((result) => result.status).sort(), ['present', 'requested']);
  assert.deepEqual(await tenantRows(site), ['org_A requested']);
});

test('Given a row for A, when a tenant request for A arrives again, then the row does not change', { timeout: 60_000 }, async (t) => {
  const { site, requests } = await openRegistry(t);
  assert.deepEqual(await requests.request('org_A'), { status: 'requested' });
  await makeLive(site, 'org_A');
  const before = await site.ownerQuery('SELECT row_to_json(tenants) FROM thermus_admin.tenants');
  assert.deepEqual(await requests.request('org_A'), { status: 'present', state: 'live' });
  assert.equal(await site.ownerQuery('SELECT row_to_json(tenants) FROM thermus_admin.tenants'), before);
});

test('Given FREE_TENANT_LIMIT free tenants, when a request for a new organization arrives, then no row is inserted and the result says that the cap is full', { timeout: 60_000 }, async (t) => {
  const { site, requests } = await openRegistry(t, { FREE_TENANT_LIMIT: '2' });
  assert.deepEqual(await requests.request('org_A'), { status: 'requested' });
  assert.deepEqual(await requests.request('org_B'), { status: 'requested' });
  assert.deepEqual(await requests.request('org_C'), { status: 'full' });
  assert.deepEqual(await tenantRows(site), ['org_A requested', 'org_B requested']);
});

test('Given one free place under the cap, when requests for two new organizations arrive at the same time, then one row is inserted and the other request gets the full-cap result', { timeout: 60_000 }, async (t) => {
  const { site, requests } = await openRegistry(t, { FREE_TENANT_LIMIT: '3' });
  await requests.request('org_A');
  await requests.request('org_B');
  const otherProcess = registryOn(t, site, { FREE_TENANT_LIMIT: '3' });
  const results = await Promise.all([requests.request('org_C'), otherProcess.requests.request('org_D')]);
  assert.deepEqual(results.map((result) => result.status).sort(), ['full', 'requested']);
  assert.equal((await tenantRows(site)).length, 3);
});

test('Given the moved SQL runtime, when the logging settings store and the membership removal store run, then their results are as before', { timeout: 60_000 }, async (t) => {
  const site = await postgresSettingsSite(t);
  const runtime = createPgSettingsRuntime(site.connection);
  t.after(() => runtime.close());
  const store = new PgDestinationSettingsStore(runtime);
  const desired = { endpoint: 'https://collector.example/v1/logs', auth: 'none' as const, enabled: false, encryptedCredential: null };
  const saved = await store.save('org-a', null, desired);
  assert.equal(saved.status, 'saved');
  if (saved.status !== 'saved') throw new Error('Expected a saved revision');
  assert.deepEqual(await store.read('org-a'), { status: 'found', settings: saved.settings });
  assert.deepEqual(await store.save('org-a', saved.settings.revision, desired), { status: 'unchanged', settings: saved.settings });
  assert.deepEqual(await store.save('org-a', null, desired), { status: 'conflict' });
  const intent = { organizationId: 'org-a', operationId: randomUUID(), membershipId: 'membership-a', revision: 'revision-a', actor: { authority: 'workos', subject: 'user-a' }, startedAt: '2026-10-27T10:00:00.000Z' };
  assert.deepEqual(await store.admitRemoval(intent), { status: 'admitted' });
  assert.deepEqual(await store.admitRemoval({ ...intent, operationId: randomUUID() }), { status: 'busy' });
  assert.deepEqual(await store.completeRemoval('org-a', intent.operationId, 'applied'), { status: 'completed' });
  assert.deepEqual(await store.readRemoval('org-a'), { status: 'found', operation: { ...intent, outcome: 'applied' } });
  assert.deepEqual(await new TenantRequests(new PgTenantRegistryStore(runtime), 25).request('org-a'), { status: 'requested' }, 'The registry shares the one runtime and role');
});

test('Given the control plane role, when the registry store reads and writes the tenants table, then each store operation succeeds with only the grants of the migration', { timeout: 60_000 }, async (t) => {
  const { site, runtime, requests, lookup } = await openRegistry(t);
  const privileges = await site.ownerQuery(`SELECT tables.name || ': ' || string_agg(privileges.name, ', ' ORDER BY privileges.name)
    FROM unnest(ARRAY['tenants', 'subscriptions', 'billing_events']) tables(name),
      unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) privileges(name)
    WHERE has_table_privilege('thermus_logging', 'thermus_admin.' || tables.name, privileges.name) GROUP BY tables.name ORDER BY tables.name`);
  assert.deepEqual(privileges.split('\n'), ['billing_events: INSERT, SELECT, UPDATE', 'subscriptions: INSERT, SELECT, UPDATE', 'tenants: INSERT, SELECT, UPDATE']);
  const forced = await site.ownerQuery(`SELECT string_agg(relname, ', ' ORDER BY relname) FROM pg_class
    WHERE relnamespace = 'thermus_admin'::regnamespace AND relname IN ('tenants', 'subscriptions', 'billing_events') AND relrowsecurity AND relforcerowsecurity`);
  assert.equal(forced, 'billing_events, subscriptions, tenants');
  assert.deepEqual(await requests.request('org_A'), { status: 'requested' });
  assert.deepEqual(await requests.request('org_A'), { status: 'present', state: 'requested' });
  assert.deepEqual(await lookup.find('org_A'), { status: 'found', state: 'requested', internalUrl: null });
  assert.deepEqual(await runtime.run((session) => session.query('DELETE FROM thermus_admin.tenants')), { status: 'unavailable' }, 'The role has no DELETE grant');
  assert.deepEqual(await tenantRows(site), ['org_A requested']);
});
