import assert from 'node:assert/strict';
import test from 'node:test';
import type { TestContext } from 'node:test';
import { WorkOSOrganizationInventory } from '../../../src/accounts/providers/workos/workos-organization-inventory.ts';
import { tenantPlatformOf } from '../../../src/app/tenant-provisioning.ts';
import { loadTenantProvisioningSettings } from '../../../src/runtime/config/mcp-tenants-config.ts';
import { createPgSettingsRuntime } from '../../../src/runtime/sql/bounded-sql-runtime.ts';
import { OrganizationSweep } from '../../../src/tenancy/tenants/organization-sweep.ts';
import { PgTenantFleetStore } from '../../../src/tenancy/tenants/pg-tenant-fleet-store.ts';
import { PgTenantProvisioningStore } from '../../../src/tenancy/tenants/pg-tenant-provisioning-store.ts';
import { reviveTenant } from '../../../src/tenancy/tenants/tenant-requests.ts';
import { OperatorLogSpy } from '../../support/doubles/application/operator-log-spy.ts';
import { RenderFake } from '../../support/doubles/render/render-fake.ts';
import { VirtualClock } from '../../support/doubles/tenants/virtual-clock.ts';
import { workosClientFor } from '../../support/doubles/workos/workos-fake-api.ts';
import { WorkOSFake } from '../../support/doubles/workos/workos-fake.ts';
import { controlPlaneEnvironment, controlPlanePublicBaseUrl } from '../../support/fixtures/control-plane-tenants.ts';
import { postgresSettingsSite } from '../../support/in-process/postgres-settings-site.ts';

// The organization sweep and the fleet statements with the real tenant registry store and the sql runtime on
// disposable PostgreSQL 17, with verified test TLS and the scoped runtime role thermus_logging. The WorkOS fake stands in
// for WorkOS at the pinned SDK, and a fake of the Render API for Render; the database and its SQL run for real.

type Site = Awaited<ReturnType<typeof postgresSettingsSite>>;

const settings = loadTenantProvisioningSettings(controlPlaneEnvironment);
const monday = Date.parse('2026-11-02T04:00:00Z');
const signal = new AbortController().signal;
const digest = `sha256:${'5a'.repeat(32)}`;

function nameOf(organizationId: string): string {
  return `thermus-tenant-${organizationId.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
}

function storesOn(t: TestContext, site: Site) {
  const runtime = createPgSettingsRuntime(site.connection);
  t.after(() => runtime.close());
  return { fleet: new PgTenantFleetStore(runtime), provisioning: new PgTenantProvisioningStore(runtime) };
}

// A row with a service of the Render fake, as the provisioner leaves it.
async function rowWithService(site: Site, render: RenderFake, organizationId: string, state: string): Promise<string> {
  const service = render.addService(nameOf(organizationId));
  await site.ownerQuery(`INSERT INTO thermus_admin.tenants (organization_id, state, render_service_id, service_name, internal_url, plan, applied_plan, image_digest)
    VALUES ('${organizationId}', '${state}', '${service.id}', '${service.name}', 'http://${service.slug}:8080', '0.5c-512mb', '0.5c-512mb', '${digest}')`);
  return service.id;
}

async function rowsOf(site: Site): Promise<string[]> {
  const text = await site.ownerQuery("SELECT organization_id || ' ' || state || ' ' || coalesce(internal_url, 'no-route') FROM thermus_admin.tenants ORDER BY organization_id");
  return text === '' ? [] : text.split('\n');
}

test('Given rows on the real registry and organizations that WorkOS no longer has, when the sweep runs, then their services are deleted and their rows are deleted, and the other rows stay', { timeout: 120_000 }, async (t) => {
  const site = await postgresSettingsSite(t);
  const render = new RenderFake({ apiKey: settings.render.apiKey, ownerId: settings.render.ownerId });
  const kept = await rowWithService(site, render, 'org_01JSWEEPKEEP', 'live');
  const absentLive = await rowWithService(site, render, 'org_01JSWEEPLIVE', 'live');
  const absentSuspended = await rowWithService(site, render, 'org_01JSWEEPPAUSED', 'suspended');
  await site.ownerQuery(`INSERT INTO thermus_admin.tenants (organization_id, state, service_name) VALUES ('org_01JSWEEPNEW', 'creating', '${nameOf('org_01JSWEEPNEW')}')`);
  await site.ownerQuery("INSERT INTO thermus_admin.tenants (organization_id, state, updated_at) VALUES ('org_01JSWEEPGONE', 'deleted', '2026-10-01T00:00:00Z')");
  const workos = await WorkOSFake.start(t, controlPlanePublicBaseUrl, ['org_01JSWEEPKEEP']);
  const { fleet, provisioning } = storesOn(t, site);
  const log = new OperatorLogSpy();
  const platform = tenantPlatformOf({ settings, store: provisioning, fetch: render.fetch, clock: new VirtualClock() });
  const sweep = new OrganizationSweep({ store: fleet, inventory: new WorkOSOrganizationInventory(workosClientFor(workos.fake)), platform, log });

  await sweep.run(monday, signal);

  assert.deepEqual(await rowsOf(site), [
    'org_01JSWEEPGONE deleted no-route',
    `org_01JSWEEPKEEP live http://${render.services().find((service) => service.id === kept)?.slug}:8080`,
    'org_01JSWEEPLIVE deleted no-route',
    'org_01JSWEEPNEW creating no-route',
    'org_01JSWEEPPAUSED deleted no-route',
  ]);
  assert.deepEqual(render.services().map((service) => service.id), [kept]);
  assert.deepEqual(render.requestsOf('delete service').map((request) => request.path).toSorted(), [`/services/${absentLive}`, `/services/${absentSuspended}`].toSorted());
  assert.equal(await site.ownerQuery("SELECT render_service_id FROM thermus_admin.tenants WHERE organization_id = 'org_01JSWEEPLIVE'"), absentLive, 'The deleted row keeps the ID of its service for the record');
  assert.equal(await site.ownerQuery("SELECT updated_at = '2026-10-01T00:00:00Z' FROM thermus_admin.tenants WHERE organization_id = 'org_01JSWEEPGONE'"), 't', 'A deleted row is not deleted again');
  assert.equal(log.lines.filter((line) => line.startsWith('INFO Tenant removal record: ')).length, 2);
  assert.equal(log.lines.at(-1), `INFO Organization sweep: ${JSON.stringify({ rows: 4, organizations: 1, deleted: 2, foundOnRead: 0, unreadable: 0, inFlight: 1, moved: 0, failed: 0 })}`);
});

test('Given a deleted row on the real registry, when it is revived, then a full cap keeps it deleted, and a free place makes it a new requested row without its old service', { timeout: 120_000 }, async (t) => {
  const site = await postgresSettingsSite(t);
  const render = new RenderFake({ apiKey: settings.render.apiKey, ownerId: settings.render.ownerId });
  await rowWithService(site, render, 'org_01JREVIVELIVE', 'live');
  await rowWithService(site, render, 'org_01JREVIVEOLD', 'live');
  await site.ownerQuery("UPDATE thermus_admin.tenants SET state = 'deleted', internal_url = NULL, created_at = '2026-10-01T00:00:00Z', last_active_at = '2026-10-02T00:00:00Z' WHERE organization_id = 'org_01JREVIVEOLD'");
  const { fleet } = storesOn(t, site);

  assert.deepEqual(await reviveTenant(fleet, 'org_01JREVIVEOLD', 1), { status: 'full' });
  assert.equal(await site.ownerQuery("SELECT state FROM thermus_admin.tenants WHERE organization_id = 'org_01JREVIVEOLD'"), 'deleted');

  assert.deepEqual(await reviveTenant(fleet, 'org_01JREVIVEOLD', 2), { status: 'revived' });
  assert.equal(
    await site.ownerQuery("SELECT concat_ws(' ', state, coalesce(render_service_id, '-'), coalesce(service_name, '-'), coalesce(plan, '-'), coalesce(image_digest, '-'), coalesce(last_active_at::text, '-'), created_at > '2026-10-02T00:00:00Z') FROM thermus_admin.tenants WHERE organization_id = 'org_01JREVIVEOLD'"),
    'requested - - - - - t',
  );
  assert.deepEqual(await reviveTenant(fleet, 'org_01JREVIVELIVE', 25), { status: 'present', state: 'live' });
});

test('Given live and suspended rows on the real registry, when the fleet statements run, then each changes a row only from the state that it names', { timeout: 120_000 }, async (t) => {
  const site = await postgresSettingsSite(t);
  const render = new RenderFake({ apiKey: settings.render.apiKey, ownerId: settings.render.ownerId });
  const serviceId = await rowWithService(site, render, 'org_01JSTATES', 'live');
  const { fleet } = storesOn(t, site);
  const newer = `sha256:${'6b'.repeat(32)}`;

  assert.deepEqual(await fleet.recordDigest('org_01JSTATES', 'srv-other', newer), { status: 'moved' }, 'Another service of the row records nothing');
  assert.deepEqual(await fleet.recordDigest('org_01JSTATES', serviceId, newer), { status: 'recorded' });
  assert.deepEqual(await fleet.markSuspended('org_01JSTATES'), { status: 'recorded' });
  assert.deepEqual(await fleet.markSuspended('org_01JSTATES'), { status: 'moved' });
  assert.deepEqual(await fleet.recordDigest('org_01JSTATES', serviceId, digest), { status: 'moved' }, 'A suspended row keeps its digest');
  assert.deepEqual(await fleet.markResumed('org_01JSTATES'), { status: 'recorded' });
  assert.deepEqual(await fleet.markDeleted('org_01JSTATES', 'live'), { status: 'moved' }, 'The delete starts from the state that the caller read');
  assert.deepEqual(await fleet.markDeleted('org_01JSTATES', 'deploying'), { status: 'recorded' });

  const read = await fleet.readFleet();
  assert.equal(read.status, 'complete');
  const [row] = read.status === 'complete' ? read.rows : [];
  assert.deepEqual({ state: row?.state, serviceId: row?.serviceId, internalUrl: row?.internalUrl, imageDigest: row?.imageDigest }, { state: 'deleted', serviceId, internalUrl: null, imageDigest: newer });
  assert.match(row?.updatedAt ?? '', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});
