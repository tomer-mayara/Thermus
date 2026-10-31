import assert from 'node:assert/strict';
import test from 'node:test';
import type { TestContext } from 'node:test';
import { startTenantProvisioning } from '../../../src/app/tenant-provisioning.ts';
import { loadTenantProvisioningSettings } from '../../../src/runtime/config/mcp-tenants-config.ts';
import { createPgSettingsRuntime } from '../../../src/runtime/sql/bounded-sql-runtime.ts';
import { PgTenantProvisioningStore } from '../../../src/tenancy/tenants/pg-tenant-provisioning-store.ts';
import type { ClaimRequest, ClaimResult } from '../../../src/tenancy/tenants/tenant-provisioning-store.ts';
import { OperatorLogSpy } from '../../support/doubles/application/operator-log-spy.ts';
import { RenderFake, type RenderRequest } from '../../support/doubles/render/render-fake.ts';
import { VirtualClock } from '../../support/doubles/tenants/virtual-clock.ts';
import { controlPlaneAuthkitIssuer, controlPlaneEnvironment, controlPlanePublicBaseUrl } from '../../support/fixtures/control-plane-tenants.ts';
import { postgresSettingsSite } from '../../support/in-process/postgres-settings-site.ts';

// The SO-12 release rehearsal of 31 October 2026 (release record, section 3.7, item 6): during each deploy of the
// control plane, Render keeps the old instance for about 120 s after the new deploy is live, so two provisioner loops
// run on one registry. In R9 the old loop claimed a row 0.4 s after the new loop recorded its service, 81.7 s before
// the old instance got SIGTERM. Each control plane of these cases has its own pool on one disposable PostgreSQL 17, as
// two instances have, and both call one fake of the Render API.

type Site = Awaited<ReturnType<typeof postgresSettingsSite>>;

const settings = loadTenantProvisioningSettings(controlPlaneEnvironment);
const organizationA = 'org_01JINSTANCEAAAAAAAAAAAAA';
const organizationB = 'org_01JINSTANCEBBBBBBBBBBBBB';
// The bound of each wait of a case. It is shorter than the claim lease of 60 s, so a row that waits for its lease to
// end fails the case.
const WAIT_LIMIT_MS = 30_000;

// The name rule of 27 October 2026 (SO-06): the organization ID in lower case, each character outside a-z, 0-9, and
// hyphen as a hyphen.
function nameOf(organizationId: string): string {
  return `thermus-tenant-${organizationId.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
}

// A spy (Meszaros) on the real provisioning store: it counts the claims that a loop starts and keeps the result of each.
class ClaimCountingStore extends PgTenantProvisioningStore {
  started = 0;
  readonly results: ClaimResult['status'][] = [];

  override async claimNext(request: ClaimRequest): Promise<ClaimResult> {
    this.started += 1;
    const result = await super.claimNext(request);
    this.results.push(result.status);
    return result;
  }
}

interface ControlPlane {
  readonly store: ClaimCountingStore;
  readonly log: OperatorLogSpy;
  /** The Render calls of this control plane, in order. */
  readonly sent: RenderRequest[];
  /** The stop of the loop, as the close of the hosted storage gives it after SIGTERM. */
  stop(): Promise<void>;
}

// One control plane instance: its own pool and provisioner loop on the shared registry. Each wait of the loop takes
// 10 ms of real time, so an idle loop claims a few times in each 100 ms. The fetch of the instance keeps each Render
// request that it sends; the fake records the request before its first wait.
function controlPlane(t: TestContext, site: Site, render: RenderFake): ControlPlane {
  const runtime = createPgSettingsRuntime(site.connection);
  t.after(() => runtime.close());
  const store = new ClaimCountingStore(runtime);
  const log = new OperatorLogSpy();
  const sent: RenderRequest[] = [];
  const fetch: typeof globalThis.fetch = (input, init) => {
    const before = render.requests.length;
    const answer = render.fetch(input, init);
    sent.push(...render.requests.slice(before));
    return answer;
  };
  const provisioning = startTenantProvisioning({
    settings, publicBaseUrl: controlPlanePublicBaseUrl, authkitIssuer: controlPlaneAuthkitIssuer,
    store, logger: log, fetch, clock: new VirtualClock(10),
  });
  t.after(() => provisioning.close());
  return { store, log, sent, stop: () => provisioning.close() };
}

async function until(condition: () => boolean | Promise<boolean>, what: string): Promise<void> {
  const deadline = performance.now() + WAIT_LIMIT_MS;
  while (!(await condition())) {
    assert.ok(performance.now() < deadline, `No ${what} within ${WAIT_LIMIT_MS} ms`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

async function rows(site: Site): Promise<string[]> {
  const text = await site.ownerQuery("SELECT organization_id || ' ' || state FROM thermus_admin.tenants ORDER BY organization_id");
  return text === '' ? [] : text.split('\n');
}

async function untilRows(site: Site, expected: readonly string[]): Promise<void> {
  await until(async () => JSON.stringify(await rows(site)) === JSON.stringify(expected), `rows [${expected.join(', ')}]`);
}

async function requestTenant(site: Site, organizationId: string): Promise<void> {
  await site.ownerQuery(`INSERT INTO thermus_admin.tenants (organization_id, state) VALUES ('${organizationId}', 'requested')`);
}

async function rowOf(site: Site, organizationId: string): Promise<Record<string, unknown>> {
  return JSON.parse(await site.ownerQuery(`SELECT row_to_json(tenants) FROM thermus_admin.tenants WHERE organization_id = '${organizationId}'`)) as Record<string, unknown>;
}

function renderFake(): RenderFake {
  return new RenderFake({ apiKey: settings.render.apiKey, ownerId: settings.render.ownerId });
}

function creates(sent: readonly RenderRequest[]): number {
  return sent.filter((request) => request.route === 'create service').length;
}

// The control plane whose loop sent the create, and the other one.
function byCreate(planes: readonly [ControlPlane, ControlPlane]): { readonly holder: ControlPlane; readonly other: ControlPlane } {
  const [one, two] = planes;
  return creates(one.sent) > 0 ? { holder: one, other: two } : { holder: two, other: one };
}

test('Given two control planes on one tenant registry and one requested row, when both loops run while the create call of the claim waits for Render, then the other loop never takes the row, and Render gets one create call and has one service with the name of the row', { timeout: 120_000 }, async (t) => {
  const site = await postgresSettingsSite(t);
  const render = renderFake();
  const create = render.hold('create service');
  const planes = [controlPlane(t, site, render), controlPlane(t, site, render)] as const;

  await requestTenant(site, organizationA);
  await until(() => render.requestsOf('create service').length > 0, 'create call');
  const { holder, other } = byCreate(planes);
  const claimsAtCreate = other.store.results.length;
  await until(() => other.store.results.length >= claimsAtCreate + 10 || render.requestsOf('create service').length > 1, 'ten claims of the other loop');
  create.release();
  await untilRows(site, [`${organizationA} live`]);

  assert.equal(render.requestsOf('create service').length, 1, 'One create call');
  assert.deepEqual(other.store.results.slice(claimsAtCreate, claimsAtCreate + 10), Array.from({ length: 10 }, () => 'idle'), 'Each claim of the other loop while the create waited found no row');
  assert.deepEqual(other.sent, [], 'The other loop sent no Render call');
  assert.equal(creates(holder.sent), 1);
  const services = render.services().filter((service) => service.name === nameOf(organizationA));
  assert.equal(services.length, 1, 'One service with the name of the row');
  assert.equal((await rowOf(site, organizationA)).render_service_id, services[0]?.id);
  assert.deepEqual(other.log.lines.filter((line) => line.includes(organizationA)), [], 'The other loop has no line about the row');
});

test('Given two control planes and a create call in flight, when the control plane of the create gets the stop signal, then it starts no claim and no Render call after the signal, its create ends and records the service, and the other control plane takes the row at once and makes it live without a second create', { timeout: 120_000 }, async (t) => {
  const site = await postgresSettingsSite(t);
  const render = renderFake();
  const create = render.hold('create service');
  const planes = [controlPlane(t, site, render), controlPlane(t, site, render)] as const;
  await requestTenant(site, organizationA);
  await until(() => render.requestsOf('create service').length > 0, 'create call');
  const { holder, other } = byCreate(planes);
  const claimsAtStop = holder.store.started;
  const sentAtStop = holder.sent.length;

  const stopped = holder.stop();
  create.release();
  await stopped;
  const atEnd = performance.now();
  const recorded = await rowOf(site, organizationA);
  await untilRows(site, [`${organizationA} live`]);
  const handover = performance.now() - atEnd;

  assert.equal(holder.store.started, claimsAtStop, 'No claim after the stop signal');
  assert.equal(holder.sent.length, sentAtStop, 'No Render call after the stop signal');
  const service = render.service(nameOf(organizationA));
  assert.ok(service !== undefined);
  assert.equal(recorded.render_service_id, service.id, 'The create in flight ended and its service is recorded');
  assert.ok(['deploying', 'live'].includes(String(recorded.state)), `The row is ${String(recorded.state)} after the stop`);
  assert.equal(render.requestsOf('create service').length, 1, 'One create call');
  assert.equal(render.services().filter(({ name }) => name === nameOf(organizationA)).length, 1);
  assert.equal(creates(other.sent), 0, 'The other control plane created nothing');
  assert.ok(other.sent.some((request) => request.route === 'list deploys'), 'The other control plane watched the deploy');
  assert.ok(handover < 15_000, `The other control plane took ${handover.toFixed(0)} ms, as for the end of a lease of 60 s`);
  assert.ok(holder.log.lines.some((line) => line.startsWith('INFO Tenant provisioning record:') && line.includes('"state":"deploying"') && line.includes(service.id)));
  assert.deepEqual([...holder.log.lines, ...other.log.lines].filter((line) => line.startsWith('ERROR')), []);
});

test('Given two idle control planes, when one gets the stop signal, then it starts no claim after the signal, and a row requested after the signal goes live through the other one', { timeout: 120_000 }, async (t) => {
  const site = await postgresSettingsSite(t);
  const render = renderFake();
  const [stopping, running] = [controlPlane(t, site, render), controlPlane(t, site, render)];
  await until(() => stopping.store.results.length > 0 && running.store.results.length > 0, 'claim of each loop');

  await stopping.stop();
  const claimsAtStop = stopping.store.started;
  await requestTenant(site, organizationB);
  await untilRows(site, [`${organizationB} live`]);

  assert.equal(stopping.store.started, claimsAtStop, 'No claim after the stop signal');
  assert.deepEqual(stopping.sent, []);
  assert.equal(creates(running.sent), 1);
});

test('Given a creating row that a stopped control plane still holds, when its claim lease ends, then the other control plane takes the row, finds the service by name, and makes it live without a create', { timeout: 120_000 }, async (t) => {
  const site = await postgresSettingsSite(t);
  const render = renderFake();
  const service = render.addService(nameOf(organizationA), { outcome: 'live', readsLeft: 1 });
  await site.ownerQuery(`INSERT INTO thermus_admin.tenants (organization_id, state, service_name, plan, claimed_by, claimed_until)
    VALUES ('${organizationA}', 'creating', '${nameOf(organizationA)}', '0.5c-512mb', 'a-stopped-instance', now() + interval '2 seconds')`);
  const plane = controlPlane(t, site, render);

  await until(() => plane.store.results.length >= 5, 'five claims');
  const whileHeld = await rows(site);
  const sentWhileHeld = [...plane.sent];
  await untilRows(site, [`${organizationA} live`]);

  assert.deepEqual(whileHeld, [`${organizationA} creating`], 'The loop leaves the row while the lease of the stopped instance lasts');
  assert.deepEqual(sentWhileHeld, []);
  assert.equal(creates(plane.sent), 0, 'No create: the search finds the service of the stopped instance');
  const row = await rowOf(site, organizationA);
  assert.deepEqual([row.render_service_id, row.claimed_by, row.claimed_until], [service.id, null, null], 'The live row keeps no claim');
});
