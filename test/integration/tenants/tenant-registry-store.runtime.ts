import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { TestContext } from 'node:test';
import { Pool } from 'pg';
import { openLoggingStorage } from '../../../src/app/logging-storage.ts';
import { BoundedSqlRuntime, createPgSettingsRuntime } from '../../../src/runtime/sql/bounded-sql-runtime.ts';
import type { SqlBounds } from '../../../src/runtime/sql/bounded-sql-runtime.ts';
import { PgTenantRegistryStore } from '../../../src/tenancy/tenants/pg-tenant-registry-store.ts';
import { TenantLookup } from '../../../src/tenancy/tenants/tenant-lookup.ts';
import { TenantRequests } from '../../../src/tenancy/tenants/tenant-requests.ts';
import { postgresSettingsSite } from '../../support/in-process/postgres-settings-site.ts';

type Site = Awaited<ReturnType<typeof postgresSettingsSite>>;

// The requests of the lock cases wait for a lock that the case holds; these bounds keep them waiting.
const lockWait: Partial<SqlBounds> = { operationMs: 10_000, statementMs: 8_000 };

function storeOn(t: TestContext, site: Site, bounds: Partial<SqlBounds> = {}): PgTenantRegistryStore {
  const runtime = createPgSettingsRuntime({ ...site.connection, bounds });
  t.after(() => runtime.close());
  return new PgTenantRegistryStore(runtime);
}

async function tenantRows(site: Site): Promise<string[]> {
  const rows = await site.ownerQuery("SELECT organization_id || ' ' || state FROM thermus_admin.tenants ORDER BY organization_id");
  return rows === '' ? [] : rows.split('\n');
}

// Another session holds a lock on the tenants table, so that requests from other pools wait at the same moment.
async function holdRegistry(t: TestContext, site: Site, mode: 'ACCESS EXCLUSIVE' | 'SHARE ROW EXCLUSIVE') {
  const holder = createPgSettingsRuntime({ ...site.connection, bounds: { operationMs: 30_000, statementMs: 30_000 } });
  const probe = createPgSettingsRuntime(site.connection);
  const locked = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const holding = holder.run(async (session) => {
    await session.query('BEGIN');
    await session.query(`LOCK TABLE thermus_admin.tenants IN ${mode} MODE`);
    locked.resolve();
    await release.promise;
    await session.query('ROLLBACK');
  });
  t.after(async () => { release.resolve(); await holding; await Promise.all([holder.close(), probe.close()]); });
  await locked.promise;
  const waiting = async () => {
    const result = await probe.run((session) => session.query("SELECT count(*)::integer AS waiting FROM pg_locks WHERE relation = 'thermus_admin.tenants'::regclass AND NOT granted"));
    return result.status === 'complete' ? Number(result.value[0]?.waiting) : -1;
  };
  return {
    untilWaiting: async (expected: number) => {
      const deadline = performance.now() + 5_000;
      while (await waiting() !== expected) {
        assert.ok(performance.now() < deadline, `Expected ${expected} requests to wait for the registry lock`);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    },
    release: async () => { release.resolve(); await holding; },
  };
}

test('Given the migration and the scoped role, when the store requests and reads tenants through the real SQL runtime, then each operation succeeds', { timeout: 60_000 }, async (t) => {
  const site = await postgresSettingsSite(t);
  const store = storeOn(t, site);
  const requests = new TenantRequests(store, 25);
  assert.deepEqual(await requests.request('org_A'), { status: 'requested' });
  assert.deepEqual(await requests.request('org_A'), { status: 'present', state: 'requested' });
  await site.ownerQuery("UPDATE thermus_admin.tenants SET state = 'live', render_service_id = 'srv-d0tenantaaaaaaaaaaaa', internal_url = 'http://thermus-tenant-org-a:8080' WHERE organization_id = 'org_A'");
  assert.deepEqual(await store.readRoutes(), { status: 'complete', routes: new Map([['org_A', { state: 'live', internalUrl: 'http://thermus-tenant-org-a:8080' }]]) });
  assert.deepEqual(await new TenantLookup(store, () => 0).find('org_A'), { status: 'found', state: 'live', internalUrl: 'http://thermus-tenant-org-a:8080' });
  assert.equal(await site.ownerQuery("SELECT created_at = updated_at AND created_at > now() - interval '1 minute' FROM thermus_admin.tenants"), 't');
});

test('Given requests for one organization from two pools that wait on the same lock, when the lock frees, then one row is inserted and the other request finds it', { timeout: 60_000 }, async (t) => {
  const site = await postgresSettingsSite(t);
  const first = new TenantRequests(storeOn(t, site, lockWait), 25);
  const second = new TenantRequests(storeOn(t, site, lockWait), 25);
  const lock = await holdRegistry(t, site, 'ACCESS EXCLUSIVE');
  const results = Promise.all([first.request('org_A'), second.request('org_A')]);
  await lock.untilWaiting(2);
  await lock.release();
  assert.deepEqual((await results).map((result) => result.status).sort(), ['present', 'requested']);
  assert.deepEqual(await tenantRows(site), ['org_A requested']);
});

test('Given one free place and requests for two new organizations that wait together, when the lock frees, then one row is inserted and the other request gets the full cap', { timeout: 60_000 }, async (t) => {
  const site = await postgresSettingsSite(t);
  const first = new TenantRequests(storeOn(t, site, lockWait), 3);
  const second = new TenantRequests(storeOn(t, site, lockWait), 3);
  assert.deepEqual(await first.request('org_A'), { status: 'requested' });
  assert.deepEqual(await second.request('org_B'), { status: 'requested' });
  const lock = await holdRegistry(t, site, 'ACCESS EXCLUSIVE');
  const results = Promise.all([first.request('org_C'), second.request('org_D')]);
  await lock.untilWaiting(2);
  await lock.release();
  assert.deepEqual((await results).map((result) => result.status).sort(), ['full', 'requested']);
  assert.equal((await tenantRows(site)).length, 3);
});

test('Given a tenant request that holds the registry lock, when the gateway reads the registry, then the read does not wait for it', { timeout: 60_000 }, async (t) => {
  const site = await postgresSettingsSite(t);
  const store = storeOn(t, site);
  assert.deepEqual(await new TenantRequests(store, 25).request('org_A'), { status: 'requested' });
  const lock = await holdRegistry(t, site, 'SHARE ROW EXCLUSIVE');
  const started = performance.now();
  assert.deepEqual(await new TenantLookup(store, () => 0).find('org_A'), { status: 'found', state: 'requested', internalUrl: null });
  assert.ok(performance.now() - started < 1_000);
  await lock.release();
});

test('Given failed and deleted tenants, when new organizations request tenants, then those rows free their places, and FREE_TENANT_LIMIT 0 refuses every new organization', { timeout: 60_000 }, async (t) => {
  const site = await postgresSettingsSite(t);
  const store = storeOn(t, site);
  const requests = new TenantRequests(store, 2);
  assert.deepEqual(await requests.request('org_A'), { status: 'requested' });
  assert.deepEqual(await requests.request('org_B'), { status: 'requested' });
  assert.deepEqual(await requests.request('org_C'), { status: 'full' });
  await site.ownerQuery("UPDATE thermus_admin.tenants SET state = 'failed', failure_reason = 'Deploy failed' WHERE organization_id = 'org_A'");
  assert.deepEqual(await requests.request('org_C'), { status: 'requested' });
  await site.ownerQuery("UPDATE thermus_admin.tenants SET state = 'deleted' WHERE organization_id = 'org_B'");
  assert.deepEqual(await requests.request('org_D'), { status: 'requested' });
  assert.deepEqual(await requests.request('org_E'), { status: 'full' });
  const closed = new TenantRequests(store, 0);
  assert.deepEqual(await closed.request('org_F'), { status: 'full' });
  assert.deepEqual(await closed.request('org_C'), { status: 'present', state: 'requested' });
  assert.deepEqual(await tenantRows(site), ['org_A failed', 'org_B deleted', 'org_C requested', 'org_D requested']);
});

test('Given a request whose commit reply is lost, when the organization requests again through a new pool, then the committed row is found and nothing is inserted twice', { timeout: 60_000 }, async (t) => {
  const site = await postgresSettingsSite(t);
  const pool = new Pool({ connectionString: site.connection.connectionString, ssl: { rejectUnauthorized: true, ca: site.connection.ca }, max: 1 });
  const runtime = new BoundedSqlRuntime({ connect: async () => {
    const client = await pool.connect();
    return { query: async (text, values) => {
      const result = await client.query(text, values);
      if (text === 'COMMIT') throw new Error('Connection lost after commit');
      return result;
    }, release: (destroy) => client.release(destroy) };
  }, end: () => pool.end(), on: (_event, listener) => pool.on('error', listener) });
  t.after(() => runtime.close());
  assert.deepEqual(await new TenantRequests(new PgTenantRegistryStore(runtime), 25).request('org_A'), { status: 'unavailable' });
  assert.equal(pool.totalCount, 0, 'The failed commit destroys its client');
  assert.deepEqual(await new TenantRequests(storeOn(t, site), 25).request('org_A'), { status: 'present', state: 'requested' });
  assert.deepEqual(await tenantRows(site), ['org_A requested']);
});

// SO-05: the writes of the MCP gateway, with the scoped runtime role and the row rules of the migration.
test('Given a suspended row, when two pools mark it resuming at the same time, then one write moves it to deploying with its service ID, the other finds it moved, and a restore after a failed resume makes it suspended again', { timeout: 60_000 }, async (t) => {
  const site = await postgresSettingsSite(t);
  const [first, second] = [storeOn(t, site), storeOn(t, site)];
  assert.deepEqual(await new TenantRequests(first, 25).request('org_A'), { status: 'requested' });
  await site.ownerQuery("UPDATE thermus_admin.tenants SET state = 'suspended', render_service_id = 'srv-d0tenantaaaaaaaaaaaa', updated_at = now() - interval '1 day' WHERE organization_id = 'org_A'");

  const marks = await Promise.all([first.markResuming('org_A'), second.markResuming('org_A')]);
  const deployingSince = await site.ownerQuery("SELECT state || ' ' || (updated_at > now() - interval '1 minute') FROM thermus_admin.tenants WHERE organization_id = 'org_A'");
  const restored = await first.restoreSuspended('org_A');
  const restoredAgain = await second.restoreSuspended('org_A');

  assert.deepEqual(marks.map((mark) => mark.status).sort(), ['moved', 'resuming']);
  assert.deepEqual(marks.find((mark) => mark.status === 'resuming'), { status: 'resuming', serviceId: 'srv-d0tenantaaaaaaaaaaaa' });
  assert.equal(deployingSince, 'deploying true');
  assert.deepEqual([restored, restoredAgain], [{ status: 'recorded' }, { status: 'moved' }]);
  assert.deepEqual(await tenantRows(site), ['org_A suspended']);
});

test('Given a suspended row without a service ID, or a row in another state, when the gateway marks it resuming, then nothing changes', { timeout: 60_000 }, async (t) => {
  const site = await postgresSettingsSite(t);
  const store = storeOn(t, site);
  const requests = new TenantRequests(store, 25);
  for (const organizationId of ['org_A', 'org_B']) assert.deepEqual(await requests.request(organizationId), { status: 'requested' });
  await site.ownerQuery("UPDATE thermus_admin.tenants SET state = 'suspended' WHERE organization_id = 'org_A'");

  assert.deepEqual(await store.markResuming('org_A'), { status: 'moved' });
  assert.deepEqual(await store.markResuming('org_B'), { status: 'moved' });
  assert.deepEqual(await store.restoreSuspended('org_B'), { status: 'moved' });
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

test('Given production storage configuration, when the tenant registry requests and finds a tenant and storage closes, then it shares the SQL runtime and its closure', { timeout: 60_000 }, async (t) => {
  const site = await postgresSettingsSite(t);
  const directory = await mkdtemp(join(tmpdir(), 'thermus-tenants-loader-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const certificate = join(directory, 'database-ca.pem');
  await writeFile(certificate, site.connection.ca);
  const errors: unknown[] = [];
  const environment = { DATABASE_URL: site.connection.connectionString, DATABASE_CA_CERT_PATH: certificate, LOGGING_DESTINATION_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64') };
  const storage = await openLoggingStorage(environment, { info: () => {}, error: (message) => { errors.push(message); } }, 1);
  assert.ok(storage?.tenants);
  t.after(() => storage.close());
  assert.deepEqual(await storage.tenants.requests.request('org_A'), { status: 'requested' });
  assert.deepEqual(await storage.tenants.requests.request('org_B'), { status: 'full' }, 'The composition applies the supplied FREE_TENANT_LIMIT');
  assert.deepEqual(await storage.tenants.lookup.find('org_A'), { status: 'found', state: 'requested', internalUrl: null });
  assert.deepEqual(await storage.tenants.gateway.recordActive('org_A'), { status: 'recorded' }, 'The writes of the gateway use the same store');
  assert.equal(await site.settingsConnections(), 1, 'The registry and the settings store share one pool');
  assert.equal((await storage.store.save('org_A', null, { endpoint: 'https://collector.example/v1/logs', auth: 'none', enabled: false, encryptedCredential: null })).status, 'saved');
  await storage.close();
  assert.deepEqual(await storage.tenants.requests.request('org_C'), { status: 'unavailable' });
  assert.deepEqual(await storage.store.read('org_A'), { status: 'unavailable' });
  assert.deepEqual(errors, []);
});
