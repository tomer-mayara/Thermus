import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { TestContext } from 'node:test';
import { promisify } from 'node:util';
import { openLoggingStorage } from '../../../src/app/logging-storage.ts';
import { startTenantProvisioning, withTenantProvisioning } from '../../../src/app/tenant-provisioning.ts';
import { loadTenantProvisioningSettings } from '../../../src/runtime/config/mcp-tenants-config.ts';
import { createPgSettingsRuntime } from '../../../src/runtime/sql/bounded-sql-runtime.ts';
import { PgTenantProvisioningStore } from '../../../src/tenancy/tenants/pg-tenant-provisioning-store.ts';
import { OperatorLogSpy } from '../../support/doubles/application/operator-log-spy.ts';
import { RenderFake } from '../../support/doubles/render/render-fake.ts';
import { VirtualClock } from '../../support/doubles/tenants/virtual-clock.ts';
import { controlPlaneAuthkitIssuer, controlPlaneEnvironment, controlPlanePublicBaseUrl, tenantImageDigest } from '../../support/fixtures/control-plane-tenants.ts';
import { postgresSettingsSite } from '../../support/in-process/postgres-settings-site.ts';

// The provisioner of the control plane with the real tenant registry store and the sql runtime on disposable
// PostgreSQL 17, with verified test TLS and the scoped runtime role thermus_logging. A fake of the Render API stands
// in for Render, and a virtual clock for the waits of the loop; the database and its SQL run for real.

type Site = Awaited<ReturnType<typeof postgresSettingsSite>>;

const settings = loadTenantProvisioningSettings(controlPlaneEnvironment);
const organizationA = 'org_01JRUNTIMEAAAAAAAAAAAAAAA';
const organizationB = 'org_01JRUNTIMEBBBBBBBBBBBBBBB';

// The name rule of 27 October 2026 (SO-06): the organization ID in lower case, each character outside a-z, 0-9, and
// hyphen as a hyphen.
function nameOf(organizationId: string): string {
  return `thermus-tenant-${organizationId.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
}

function renderFake(): RenderFake {
  return new RenderFake({ apiKey: settings.render.apiKey, ownerId: settings.render.ownerId });
}

// One control plane: a provisioner loop on its own pool. The test closes it at the end, before the pool. Each wait of
// the loop takes realDelayMs of real time, so an idle loop reads the registry a few times a second.
function provisionerOn(t: TestContext, site: Site, parts: { readonly render: RenderFake; readonly realDelayMs?: number }) {
  const runtime = createPgSettingsRuntime(site.connection);
  t.after(() => runtime.close());
  const log = new OperatorLogSpy();
  const provisioning = startTenantProvisioning({
    settings, publicBaseUrl: controlPlanePublicBaseUrl, authkitIssuer: controlPlaneAuthkitIssuer,
    store: new PgTenantProvisioningStore(runtime), logger: log, fetch: parts.render.fetch, clock: new VirtualClock(parts.realDelayMs ?? 10),
  });
  t.after(() => provisioning.close());
  return { log, provisioning };
}

async function rows(site: Site): Promise<string[]> {
  const text = await site.ownerQuery("SELECT organization_id || ' ' || state FROM thermus_admin.tenants ORDER BY organization_id");
  return text === '' ? [] : text.split('\n');
}

async function until(site: Site, expected: readonly string[]): Promise<void> {
  const deadline = performance.now() + 30_000;
  for (let current = await rows(site); JSON.stringify(current) !== JSON.stringify(expected); current = await rows(site)) {
    assert.ok(performance.now() < deadline, `The rows are [${current.join(', ')}], not [${expected.join(', ')}]`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

async function requestTenant(site: Site, organizationId: string): Promise<void> {
  await site.ownerQuery(`INSERT INTO thermus_admin.tenants (organization_id, state) VALUES ('${organizationId}', 'requested')`);
}

async function rowOf(site: Site, organizationId: string): Promise<Record<string, unknown>> {
  return JSON.parse(await site.ownerQuery(`SELECT row_to_json(tenants) FROM thermus_admin.tenants WHERE organization_id = '${organizationId}'`)) as Record<string, unknown>;
}

test('Given two requested rows, when the provisioner runs on the real registry, then it claims one row at a time, and each row goes live within the rules of the table', { timeout: 120_000 }, async (t) => {
  const site = await postgresSettingsSite(t);
  await requestTenant(site, organizationA);
  await requestTenant(site, organizationB);
  const render = renderFake();
  const rowsAtCreate: string[][] = [];
  render.beforeCreate = async () => { rowsAtCreate.push(await rows(site)); };

  const control = provisionerOn(t, site, { render });

  await until(site, [`${organizationA} live`, `${organizationB} live`]);
  await control.provisioning.close();

  assert.deepEqual(rowsAtCreate, [[`${organizationA} creating`, `${organizationB} requested`], [`${organizationA} live`, `${organizationB} creating`]]);
  const service = render.service(nameOf(organizationA));
  assert.ok(service !== undefined);
  const row = await rowOf(site, organizationA);
  assert.deepEqual(
    [row.render_service_id, row.service_name, row.internal_url, row.image_digest, row.plan, row.applied_plan, row.failure_reason],
    [service.id, 'thermus-tenant-org-01jruntimeaaaaaaaaaaaaaaa', `http://${service.slug}:8080`, tenantImageDigest, '0.5c-512mb', '0.5c-512mb', null],
  );
});

test('Given a stop while a deploy runs, when a new control plane starts, then its loop continues the deploying row without a second create', { timeout: 120_000 }, async (t) => {
  const site = await postgresSettingsSite(t);
  await requestTenant(site, organizationA);
  const render = renderFake();
  render.deployReads = 1_000;
  // A slow clock keeps the first loop inside its deploy budget of 15 minutes until the stop.
  const first = provisionerOn(t, site, { render, realDelayMs: 20 });
  await until(site, [`${organizationA} deploying`]);
  await first.provisioning.close();
  assert.deepEqual(await rows(site), [`${organizationA} deploying`], 'The stopped loop leaves the row as it was');

  const deploy = render.service(nameOf(organizationA))?.deploys[0];
  assert.ok(deploy !== undefined);
  deploy.readsLeft = 1;
  const second = provisionerOn(t, site, { render });

  await until(site, [`${organizationA} live`]);
  await second.provisioning.close();
  assert.equal(render.requestsOf('create service').length, 1);
});

test('Given a creating row of an earlier run whose service Render has, when the loop runs, then it finds the service by name and records it', { timeout: 120_000 }, async (t) => {
  const site = await postgresSettingsSite(t);
  const render = renderFake();
  const service = render.addService(nameOf(organizationA), { outcome: 'live', readsLeft: 1 });
  await site.ownerQuery(`INSERT INTO thermus_admin.tenants (organization_id, state, service_name, plan) VALUES ('${organizationA}', 'creating', '${nameOf(organizationA)}', '0.5c-512mb')`);
  const control = provisionerOn(t, site, { render });

  await until(site, [`${organizationA} live`]);
  await control.provisioning.close();

  assert.deepEqual(render.requestsOf('create service'), []);
  const row = await rowOf(site, organizationA);
  assert.deepEqual([row.render_service_id, row.internal_url], [service.id, `http://${service.slug}:8080`]);
});

test('Given a deploy that fails, when the loop polls it, then the row is failed with the reason and keeps its service ID', { timeout: 120_000 }, async (t) => {
  const site = await postgresSettingsSite(t);
  await requestTenant(site, organizationA);
  const render = renderFake();
  render.deployOutcome = 'update_failed';
  const { log, provisioning } = provisionerOn(t, site, { render });

  await until(site, [`${organizationA} failed`]);
  await provisioning.close();

  const row = await rowOf(site, organizationA);
  assert.equal(row.render_service_id, render.service(nameOf(organizationA))?.id);
  assert.match(String(row.failure_reason), /ended as update_failed/);
  assert.equal(log.lines.filter((line) => line.startsWith('ERROR Tenant provisioning failed')).length, 1);
});

test('Given production storage settings with the switch on, when a tenant is requested, then the loop provisions it, and the storage close stops the loop before the SQL runtime', { timeout: 120_000 }, async (t) => {
  const site = await postgresSettingsSite(t);
  const directory = await mkdtemp(join(tmpdir(), 'thermus-provisioner-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const certificate = join(directory, 'database-ca.pem');
  await writeFile(certificate, site.connection.ca);
  const environment = { DATABASE_URL: site.connection.connectionString, DATABASE_CA_CERT_PATH: certificate, LOGGING_DESTINATION_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64') };
  const log = new OperatorLogSpy();
  const render = renderFake();
  const storage = withTenantProvisioning(await openLoggingStorage(environment, log, 25), {
    settings, publicBaseUrl: controlPlanePublicBaseUrl, authkitIssuer: controlPlaneAuthkitIssuer, logger: log, fetch: render.fetch, clock: new VirtualClock(10),
  });
  t.after(() => storage.close());

  assert.deepEqual(await storage.tenants?.requests.request(organizationA), { status: 'requested' });
  await until(site, [`${organizationA} live`]);
  assert.deepEqual(await storage.tenants?.lookup.find(organizationA), { status: 'found', state: 'live', internalUrl: `http://${render.service(nameOf(organizationA))?.slug}:8080` });

  await storage.close();
  const requests = render.requests.length;
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(render.requests.length, requests, 'The closed loop sends no more calls');
  assert.deepEqual(await storage.tenants?.requests.request(organizationB), { status: 'unavailable' }, 'The SQL runtime is closed');
  assert.ok(log.lines.some((line) => line.startsWith('INFO The tenant provisioner runs: Render workspace tea-placeholderworkspace')));
  assert.ok(log.lines.every((line) => !line.includes(settings.render.apiKey)), 'No line holds the Render API key');
  assert.deepEqual(log.lines.filter((line) => line.startsWith('ERROR')), []);
});

test('Given a database that stops while a claim waits, when the claim fails, then the control plane process keeps running and the claim is unavailable', { timeout: 120_000 }, async (t) => {
  const site = await postgresSettingsSite(t);
  await requestTenant(site, organizationA);
  const runtime = createPgSettingsRuntime({ ...site.connection, bounds: { operationMs: 10_000, statementMs: 8_000 } });
  const holder = createPgSettingsRuntime({ ...site.connection, bounds: { operationMs: 5_000, statementMs: 4_000 } });
  t.after(() => Promise.all([runtime.close(), holder.close()]));
  const locked = Promise.withResolvers<void>();
  const holding = holder.run(async (session) => {
    await session.query('BEGIN');
    await session.query('LOCK TABLE thermus_admin.tenants IN ACCESS EXCLUSIVE MODE');
    locked.resolve();
    await new Promise(() => {});
  });
  await locked.promise;
  const claim = new PgTenantProvisioningStore(runtime).claimNext({ serviceNameOf: nameOf, plan: '0.5c-512mb' });
  const deadline = performance.now() + 10_000;
  const waiting = "SELECT count(*) FROM pg_stat_activity WHERE application_name = 'thermus-settings' AND wait_event_type = 'Lock'";
  while (await site.ownerQuery(waiting) !== '1') {
    assert.ok(performance.now() < deadline, 'The claim waits for the table lock');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  // The database ends each connection without a goodbye: both the waiting claim and the holder of the lock lose theirs.
  await promisify(execFile)('docker', ['stop', '--time', '0', site.container]);

  assert.deepEqual(await claim, { status: 'unavailable' });
  assert.equal((await holding).status, 'unavailable');
  await new Promise((resolve) => setTimeout(resolve, 200));
});
