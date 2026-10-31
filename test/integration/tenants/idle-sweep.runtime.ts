import assert from 'node:assert/strict';
import test from 'node:test';
import type { TestContext } from 'node:test';
import { tenantPlatformOf } from '../../../src/app/tenant-provisioning.ts';
import { loadTenantProvisioningSettings } from '../../../src/runtime/config/mcp-tenants-config.ts';
import { createPgSettingsRuntime } from '../../../src/runtime/sql/bounded-sql-runtime.ts';
import { IdleSweep } from '../../../src/tenancy/tenants/idle-sweep.ts';
import { PgTenantFleetStore } from '../../../src/tenancy/tenants/pg-tenant-fleet-store.ts';
import { PgTenantProvisioningStore } from '../../../src/tenancy/tenants/pg-tenant-provisioning-store.ts';
import { OperatorLogSpy } from '../../support/doubles/application/operator-log-spy.ts';
import { RenderFake } from '../../support/doubles/render/render-fake.ts';
import { VirtualClock } from '../../support/doubles/tenants/virtual-clock.ts';
import { controlPlaneEnvironment } from '../../support/fixtures/control-plane-tenants.ts';
import { postgresSettingsSite } from '../../support/in-process/postgres-settings-site.ts';

// The idle sweep of SO-10 with the idle query and the suspended mark of the real tenant registry store and the sql
// runtime on disposable PostgreSQL 17, with verified test TLS and the scoped runtime role thermus_logging. A fake of the
// Render API stands in for Render; the database and its SQL run for real.

type Site = Awaited<ReturnType<typeof postgresSettingsSite>>;

const settings = loadTenantProvisioningSettings(controlPlaneEnvironment);
const signal = new AbortController().signal;
// The tick of Tuesday 3 November 2026 at 04:00 UTC; with 14 days, the cutoff is 20 October 2026 at 04:00 UTC.
const tick = Date.parse('2026-11-03T04:00:00Z');

function nameOf(organizationId: string): string {
  return `thermus-tenant-${organizationId.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
}

interface RowFacts {
  readonly state: string;
  readonly plan: string;
  readonly lastActiveAt: string | null;
  readonly createdAt: string;
}

// The real registry of the site, whose rows get their services from the Render fake.
function registryOf(site: Site, render: RenderFake) {
  return {
    // A row with its service, state, plan, last use, and creation time; it gives the service ID.
    add: async (organizationId: string, row: RowFacts): Promise<string> => {
      const service = render.addService(nameOf(organizationId));
      const lastActiveAt = row.lastActiveAt === null ? 'NULL' : `'${row.lastActiveAt}'`;
      await site.ownerQuery(`INSERT INTO thermus_admin.tenants (organization_id, state, render_service_id, service_name, internal_url, plan, applied_plan, last_active_at, created_at)
        VALUES ('${organizationId}', '${row.state}', '${service.id}', '${service.name}', 'http://${service.slug}:8080', '${row.plan}', '${row.plan}', ${lastActiveAt}, '${row.createdAt}')`);
      return service.id;
    },
  };
}

function sweepOn(t: TestContext, site: Site, render: RenderFake) {
  const runtime = createPgSettingsRuntime(site.connection);
  t.after(() => runtime.close());
  const fleet = new PgTenantFleetStore(runtime);
  const platform = tenantPlatformOf({ settings, store: new PgTenantProvisioningStore(runtime), fetch: render.fetch, clock: new VirtualClock() });
  const log = new OperatorLogSpy();
  return { fleet, log, sweep: new IdleSweep({ store: fleet, platform, freePlan: settings.freePlan, idleDays: 14, log }) };
}

test('Given rows on the real registry, when the idle sweep runs, then the idle query gives only the live free rows whose last use, or creation without a use, is 14 days or more before the tick, and those rows become suspended', { timeout: 120_000 }, async (t) => {
  const site = await postgresSettingsSite(t);
  const render = new RenderFake({ apiKey: settings.render.apiKey, ownerId: settings.render.ownerId });
  const free = settings.freePlan;
  const registry = registryOf(site, render);
  const idle = await registry.add('org_01JIDLEOLD', { state: 'live', plan: free, lastActiveAt: '2026-10-19T12:00:00Z', createdAt: '2026-09-01T00:00:00Z' });
  const edge = await registry.add('org_01JIDLEEDGE', { state: 'live', plan: free, lastActiveAt: '2026-10-20T04:00:00Z', createdAt: '2026-09-01T00:00:00Z' });
  const never = await registry.add('org_01JIDLENEVER', { state: 'live', plan: free, lastActiveAt: null, createdAt: '2026-10-01T00:00:00Z' });
  await registry.add('org_01JIDLEACTIVE', { state: 'live', plan: free, lastActiveAt: '2026-10-20T04:00:01Z', createdAt: '2026-09-01T00:00:00Z' });
  await registry.add('org_01JIDLEYOUNG', { state: 'live', plan: free, lastActiveAt: null, createdAt: '2026-10-25T00:00:00Z' });
  await registry.add('org_01JIDLETEAM', { state: 'live', plan: '1c-2g', lastActiveAt: '2026-10-01T00:00:00Z', createdAt: '2026-09-01T00:00:00Z' });
  await registry.add('org_01JIDLEPAUSED', { state: 'suspended', plan: free, lastActiveAt: '2026-10-01T00:00:00Z', createdAt: '2026-09-01T00:00:00Z' });
  await site.ownerQuery("INSERT INTO thermus_admin.tenants (organization_id, state, plan, created_at) VALUES ('org_01JIDLENEW', 'requested', '0.5c-512mb', '2026-09-01T00:00:00Z')");
  const { fleet, log, sweep } = sweepOn(t, site, render);

  const read = await fleet.readIdle(free, new Date(tick - 14 * 86_400_000).toISOString());
  await sweep.run(tick, signal);

  assert.equal(read.status, 'complete');
  assert.deepEqual(read.status === 'complete' ? read.rows.map((row) => [row.organizationId, row.lastActiveAt]) : [], [
    ['org_01JIDLEEDGE', '2026-10-20T04:00:00.000Z'], ['org_01JIDLENEVER', null], ['org_01JIDLEOLD', '2026-10-19T12:00:00.000Z'],
  ]);
  assert.deepEqual(render.requestsOf('suspend service').map((request) => request.path), [edge, never, idle].map((id) => `/services/${id}/suspend`));
  const states = await site.ownerQuery("SELECT organization_id || ' ' || state FROM thermus_admin.tenants ORDER BY organization_id");
  assert.deepEqual(states.split('\n'), [
    'org_01JIDLEACTIVE live', 'org_01JIDLEEDGE suspended', 'org_01JIDLENEVER suspended', 'org_01JIDLENEW requested',
    'org_01JIDLEOLD suspended', 'org_01JIDLEPAUSED suspended', 'org_01JIDLETEAM live', 'org_01JIDLEYOUNG live',
  ]);
  assert.equal(log.lines.at(-1), `INFO Idle sweep: ${JSON.stringify({ idle: 3, suspended: 3, moved: 0, failed: 0 })}`);
});

test('Given an idle row on the real registry that another writer moves after the idle query, when the sweep marks it, then the row stays as that writer left it', { timeout: 120_000 }, async (t) => {
  const site = await postgresSettingsSite(t);
  const render = new RenderFake({ apiKey: settings.render.apiKey, ownerId: settings.render.ownerId });
  const serviceId = await registryOf(site, render).add('org_01JIDLEMOVED', { state: 'live', plan: settings.freePlan, lastActiveAt: null, createdAt: '2026-10-01T00:00:00Z' });
  const { fleet } = sweepOn(t, site, render);

  const read = await fleet.readIdle(settings.freePlan, '2026-10-20T04:00:00.000Z');
  await site.ownerQuery("UPDATE thermus_admin.tenants SET state = 'deleted', internal_url = NULL WHERE organization_id = 'org_01JIDLEMOVED'");

  assert.equal(read.status === 'complete' ? read.rows.length : -1, 1);
  assert.deepEqual(await fleet.markSuspended('org_01JIDLEMOVED', serviceId), { status: 'moved' });
  assert.equal(await site.ownerQuery("SELECT state FROM thermus_admin.tenants WHERE organization_id = 'org_01JIDLEMOVED'"), 'deleted');
});
