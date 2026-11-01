import assert from 'node:assert/strict';
import test from 'node:test';
import type { TestContext } from 'node:test';
import { tenantPlatformOf } from '../../../src/app/tenant-provisioning.ts';
import { startTenantSweeps } from '../../../src/app/tenant-sweeps.ts';
import { loadTenantProvisioningSettings } from '../../../src/runtime/config/mcp-tenants-config.ts';
import { createPgSettingsRuntime } from '../../../src/runtime/sql/bounded-sql-runtime.ts';
import { PgTenantFleetStore } from '../../../src/tenancy/tenants/pg-tenant-fleet-store.ts';
import { PgTenantProvisioningStore } from '../../../src/tenancy/tenants/pg-tenant-provisioning-store.ts';
import { OperatorLogSpy } from '../../support/doubles/application/operator-log-spy.ts';
import { RenderFake, type FakeService, type RenderRequest, type RenderRoute } from '../../support/doubles/render/render-fake.ts';
import { VirtualClock } from '../../support/doubles/tenants/virtual-clock.ts';
import { workosClientFor } from '../../support/doubles/workos/workos-fake-api.ts';
import { WorkOSFake } from '../../support/doubles/workos/workos-fake.ts';
import { controlPlaneEnvironment, controlPlanePublicBaseUrl } from '../../support/fixtures/control-plane-tenants.ts';
import { postgresSettingsSite } from '../../support/in-process/postgres-settings-site.ts';
import { TickClock } from './fixtures/tick-clock.ts';

// The SO-12 release rehearsal of 31 October 2026 (release record, section 3.7, item 6): during each deploy of the
// control plane, Render keeps the old instance for about 120 s after the new deploy is live, so two instances run the
// tenant sweeps, and a daily tick inside that time comes in both. Each control plane of these cases has its own pool on
// one disposable PostgreSQL 17, as two instances have; both call one fake of the Render API and one WorkOS fake, and
// both reach the same tick at once.

type Site = Awaited<ReturnType<typeof postgresSettingsSite>>;

const settings = loadTenantProvisioningSettings(controlPlaneEnvironment);
const organizationA = 'org_01JTICKAAAAAAAAAAAAAAAAAAA';
const organizationB = 'org_01JTICKBBBBBBBBBBBBBBBBBBB';
// One minute before the default sweep hour of 04:00 UTC on Monday 2 and Tuesday 3 November 2026.
const mondayBeforeTheSweep = Date.parse('2026-11-02T03:59:00Z');
const tuesdayBeforeTheSweep = Date.parse('2026-11-03T03:59:00Z');
// 15 days before the tick of Tuesday, so the idle sweep of 14 days suspends the tenant; and a call one day before it.
const fifteenDaysBeforeTuesday = '2026-10-19T12:00:00.000Z';
const recentUse = '2026-11-02T12:00:00.000Z';
const WAIT_LIMIT_MS = 30_000;

// The name rule of 27 October 2026 (SO-06): the organization ID in lower case, each character outside a-z, 0-9, and
// hyphen as a hyphen.
function nameOf(organizationId: string): string {
  return `thermus-tenant-${organizationId.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
}

interface ControlPlane {
  readonly log: OperatorLogSpy;
  /** The Render calls of this control plane, in order. */
  readonly sent: RenderRequest[];
  /** True when the sweeps of this control plane are past the tick and wait for the next one. */
  ended(): boolean;
}

// One control plane instance: its own pool, Render adapter, and tenant sweeps on the shared registry, with a wall
// clock that gives one tick. The fetch of the instance keeps each Render request that it sends; the fake records the
// request before its first wait.
function controlPlane(t: TestContext, site: Site, render: RenderFake, workos: WorkOSFake, startMs: number): ControlPlane {
  const runtime = createPgSettingsRuntime(site.connection);
  const log = new OperatorLogSpy();
  const sent: RenderRequest[] = [];
  const fetch: typeof globalThis.fetch = (input, init) => {
    const before = render.requests.length;
    const answer = render.fetch(input, init);
    sent.push(...render.requests.slice(before));
    return answer;
  };
  const clock = new TickClock(startMs, 1);
  const platform = tenantPlatformOf({ settings, store: new PgTenantProvisioningStore(runtime), fetch, clock: new VirtualClock() });
  const sweeps = startTenantSweeps({
    settings, platform, fleet: new PgTenantFleetStore(runtime), workos: workosClientFor(workos.fake), logger: log, sweepClock: clock,
  });
  t.after(async () => {
    await sweeps.close();
    await runtime.close();
  });
  return { log, sent, ended: () => clock.blocked };
}

async function until(condition: () => boolean, what: string): Promise<void> {
  const deadline = performance.now() + WAIT_LIMIT_MS;
  while (!condition()) {
    assert.ok(performance.now() < deadline, `No ${what} within ${WAIT_LIMIT_MS} ms`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

// A live free tenant: its Render service and its registry row with the last use.
async function liveTenant(site: Site, render: RenderFake, organizationId: string, lastActiveAt: string): Promise<FakeService> {
  const service = render.addService(nameOf(organizationId));
  await site.ownerQuery(`INSERT INTO thermus_admin.tenants (organization_id, state, render_service_id, service_name, internal_url, plan, applied_plan, last_active_at)
    VALUES ('${organizationId}', 'live', '${service.id}', '${service.name}', 'http://${service.slug}:8080', '${settings.freePlan}', '${settings.freePlan}', '${lastActiveAt}')`);
  return service;
}

async function stateOf(site: Site, organizationId: string): Promise<string> {
  return site.ownerQuery(`SELECT state FROM thermus_admin.tenants WHERE organization_id = '${organizationId}'`);
}

// Each claimed tick as "<UTC time> <holder>".
async function claimedTicks(site: Site): Promise<string[]> {
  const text = await site.ownerQuery("SELECT to_char(tick_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') || ' ' || claimed_by FROM thermus_admin.tenant_sweep_ticks ORDER BY tick_at");
  return text === '' ? [] : text.split('\n');
}

// The tick claim holder that the start line of a control plane names.
function holderOf(plane: ControlPlane): string | undefined {
  return plane.log.lines.map((line) => /tick claim holder ([0-9a-f-]{36})\.$/.exec(line)?.[1]).find((holder) => holder !== undefined);
}

function renderFake(): RenderFake {
  return new RenderFake({ apiKey: settings.render.apiKey, ownerId: settings.render.ownerId });
}

// The control plane that sent the first call of the route, and the other one.
function byFirstCall(planes: readonly [ControlPlane, ControlPlane], route: RenderRoute): { readonly runner: ControlPlane; readonly other: ControlPlane } {
  const [one, two] = planes;
  return one.sent.some((request) => request.route === route) ? { runner: one, other: two } : { runner: two, other: one };
}

// Holds the Render calls of the route until the other control plane is past the tick or sends that call too, so a
// second run of the tick cannot end before the first one, and both runs reach Render.
async function runTheTickWhileHeld(render: RenderFake, planes: readonly [ControlPlane, ControlPlane], route: RenderRoute): Promise<{ readonly runner: ControlPlane; readonly other: ControlPlane }> {
  const held = render.hold(route);
  await until(() => render.requestsOf(route).length > 0, `${route} call`);
  const { runner, other } = byFirstCall(planes, route);
  await until(() => other.ended() || render.requestsOf(route).length > 1, 'the end of the tick in the other control plane');
  held.release();
  await until(() => runner.ended(), 'the end of the tick');
  return { runner, other };
}

function linesOf(planes: readonly ControlPlane[], prefix: string): string[] {
  return planes.flatMap((plane) => plane.log.lines.filter((line) => line.startsWith(prefix)));
}

function leaveLine(tick: string): string {
  return `INFO The tenant sweeps leave the tick of ${tick}: another instance of the control plane claimed it first.`;
}

test('Given two control planes on one tenant registry and one idle free tenant, when the daily tick comes in both, then one control plane runs the tick: Render gets one suspend call, the log has one idle sweep line and one fleet summary line, and the other control plane leaves the tick with one line', { timeout: 120_000 }, async (t) => {
  const site = await postgresSettingsSite(t);
  const render = renderFake();
  const workos = await WorkOSFake.start(t, controlPlanePublicBaseUrl, [organizationA, organizationB]);
  const idle = await liveTenant(site, render, organizationA, fifteenDaysBeforeTuesday);
  await liveTenant(site, render, organizationB, recentUse);
  const planes = [controlPlane(t, site, render, workos, tuesdayBeforeTheSweep), controlPlane(t, site, render, workos, tuesdayBeforeTheSweep)] as const;

  const { runner, other } = await runTheTickWhileHeld(render, planes, 'suspend service');

  assert.deepEqual(render.requestsOf('suspend service').map((request) => request.path), [`/services/${idle.id}/suspend`], 'One suspend call');
  assert.deepEqual([await stateOf(site, organizationA), await stateOf(site, organizationB)], ['suspended', 'live']);
  assert.equal(linesOf(planes, 'INFO Idle sweep:').length, 1, 'One idle sweep line');
  assert.equal(linesOf(planes, 'INFO Tenant fleet summary:').length, 1, 'One fleet summary line');
  assert.deepEqual(other.sent, [], 'The other control plane sent no Render call');
  assert.deepEqual(other.log.lines.filter((line) => !line.startsWith('INFO The tenant sweeps run each day at')), [leaveLine('2026-11-03T04:00:00.000Z')]);
  assert.deepEqual(await claimedTicks(site), [`2026-11-03 04:00 ${holderOf(runner)}`], 'One claim of the tick, by the control plane that ran it');
  assert.deepEqual(linesOf(planes, 'ERROR'), []);
});

test('Given two control planes on one tenant registry and a tenant whose organization WorkOS no longer has, when the Monday tick comes in both, then one control plane runs the tick: Render gets one delete call, and the log has one organization sweep line and one fleet summary line', { timeout: 120_000 }, async (t) => {
  const site = await postgresSettingsSite(t);
  const render = renderFake();
  const workos = await WorkOSFake.start(t, controlPlanePublicBaseUrl, [organizationA, organizationB]);
  await liveTenant(site, render, organizationA, recentUse);
  const removed = await liveTenant(site, render, organizationB, recentUse);
  workos.removedOrganizationIds.add(organizationB);
  const planes = [controlPlane(t, site, render, workos, mondayBeforeTheSweep), controlPlane(t, site, render, workos, mondayBeforeTheSweep)] as const;

  const { runner, other } = await runTheTickWhileHeld(render, planes, 'delete service');

  assert.deepEqual(render.requestsOf('delete service').map((request) => request.path), [`/services/${removed.id}`], 'One delete call');
  assert.deepEqual([await stateOf(site, organizationA), await stateOf(site, organizationB)], ['live', 'deleted']);
  assert.equal(linesOf(planes, 'INFO Organization sweep:').length, 1, 'One organization sweep line');
  assert.equal(linesOf(planes, 'INFO Tenant fleet summary:').length, 1, 'One fleet summary line');
  assert.deepEqual(other.sent, [], 'The other control plane sent no Render call');
  assert.deepEqual(other.log.lines.filter((line) => !line.startsWith('INFO The tenant sweeps run each day at')), [leaveLine('2026-11-02T04:00:00.000Z')]);
  assert.deepEqual(await claimedTicks(site), [`2026-11-02 04:00 ${holderOf(runner)}`]);
  assert.deepEqual(linesOf(planes, 'ERROR'), []);
});

test('Given a control plane whose tenant registry has no table of the ticks, as before its migration, when the daily tick comes, then the sweeps run no step and send no Render call, and the operator gets one stop line', { timeout: 120_000 }, async (t) => {
  const site = await postgresSettingsSite(t);
  const render = renderFake();
  const workos = await WorkOSFake.start(t, controlPlanePublicBaseUrl, [organizationA]);
  await liveTenant(site, render, organizationA, fifteenDaysBeforeTuesday);
  await site.ownerQuery('DROP TABLE thermus_admin.tenant_sweep_ticks');
  const plane = controlPlane(t, site, render, workos, tuesdayBeforeTheSweep);

  await until(() => plane.ended(), 'the end of the tick');

  assert.deepEqual(plane.sent, [], 'No Render call');
  assert.equal(await stateOf(site, organizationA), 'live');
  assert.deepEqual(plane.log.lines.filter((line) => !line.startsWith('INFO The tenant sweeps run each day at')), [
    `ERROR Tenant sweep tick stopped: ${JSON.stringify({ tick: '2026-11-03T04:00:00.000Z', reason: 'The tenant registry did not answer the claim of the tick' })}`,
  ]);
});
