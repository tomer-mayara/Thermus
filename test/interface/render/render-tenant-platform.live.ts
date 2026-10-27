import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { PRODUCTION_SERVICE_ID, RenderTenantPlatform } from '../../../src/tenancy/providers/render/render-tenant-platform.ts';
import type { PlatformDeploy } from '../../../src/tenancy/tenants/tenant-platform.ts';
import { RenderReadDriver } from '../../support/drivers/render/render-read-driver.ts';
import { workOSSettings } from '../../support/fixtures/hosted-placeholder.ts';

// The live interface test of the Render adapter of the tenant platform (SO-06). In the workspace Thermus AI, with the
// registry credential ghcr-thermus-hosted-read and a hosted image by digest, it creates one disposable private
// service named thermus-spike-tenant-org_01live<UTC time>, watches its newest deploy until it is live, reads its
// internal address, and deletes it, also after a failure. Before any call it refuses the workspace My Workspace and
// the production service, and a preflight with reads only finds no other thermus-spike-* service.
// The published image has no tenant role yet (SO-03), so the service gets the placeholder environment of SO-01c
// (record, "Placeholder environment"), with which the image starts as a control plane. Run it with the key of the
// main checkout:
//   npm run build && node --env-file=<main checkout>/.env.local --test dist/test/interface/render/render-tenant-platform.live.js

const THERMUS_AI = 'tea-db8i6ceq1p3s73dev9og';
const MY_WORKSPACE = 'tea-d3mlbrvdiees73ca4rdg';
const NAME_PREFIX = 'thermus-spike-';
const POLL_MS = 5_000;
const DEPLOY_BUDGET_MS = 15 * 60_000;
const ADDRESS_READS = 12;
const CLEANUP_READS = 12;

const settings = {
  ownerId: process.env.RENDER_LIVE_OWNER_ID || THERMUS_AI,
  registryCredentialId: process.env.RENDER_LIVE_REGISTRY_CREDENTIAL_ID || 'rgc-dbg1h0142hec73da9ra0',
  image: process.env.RENDER_LIVE_IMAGE || 'ghcr.io/tomer-mayara/thermus-hosted@sha256:d6b8a8fd3174c02984267f6aef54a7ee4e4bc783776ae9b856685202972dbfbd',
};
const placeholderEnvironment = new Map<string, string>([['PUBLIC_BASE_URL', 'https://thermus.example/'], ...Object.entries(workOSSettings)]);

const clock = {
  now: (): number => performance.now(),
  sleep: (ms: number, signal: AbortSignal): Promise<void> => new Promise((resolve, reject) => {
    const timer = setTimeout(() => { signal.removeEventListener('abort', stop); resolve(); }, ms);
    const stop = (): void => { clearTimeout(timer); reject(signal.reason); };
    signal.addEventListener('abort', stop, { once: true });
  }),
};

function seconds(ms: number): string {
  return `${(ms / 1_000).toFixed(1)} s`;
}

function setupKey(): string {
  const key = process.env.RENDER_API_KEY ?? '';
  assert.ok(key.trim() !== '' && !/\s/.test(key), 'Setup: RENDER_API_KEY is not set. Run the test with node --env-file=<main checkout>/.env.local.');
  assert.notEqual(settings.ownerId, MY_WORKSPACE, `Setup: ${MY_WORKSPACE} is My Workspace, which the tests must not use.`);
  assert.match(settings.ownerId, /^tea-[a-z0-9]+$/, 'Setup: the workspace must be a Render workspace ID.');
  assert.match(settings.image, /^ghcr\.io\/[a-z0-9._/-]+@sha256:[0-9a-f]{64}$/, 'Setup: the image must be a GHCR image by digest.');
  return key;
}

async function preflight(t: TestContext, driver: RenderReadDriver): Promise<void> {
  const workspace = await driver.workspace();
  assert.equal(workspace.id, settings.ownerId);
  const credential = (await driver.registryCredentials()).find((item) => item.id === settings.registryCredentialId);
  assert.ok(credential !== undefined, `The workspace has no registry credential ${settings.registryCredentialId}.`);
  assert.equal(credential.registry, 'GITHUB');
  const earlier = (await driver.services()).filter((service) => service.name.startsWith(NAME_PREFIX));
  assert.deepEqual(earlier, [], 'No thermus-spike-* service of an earlier run exists: delete it in the Render Dashboard first.');
  t.diagnostic(`Preflight: workspace ${workspace.name} (${workspace.type}), credential ${credential.name} (${credential.id}), no ${NAME_PREFIX}* service.`);
}

async function liveDeploy(platform: RenderTenantPlatform, serviceId: string, signal: AbortSignal): Promise<{ readonly deploy: PlatformDeploy; readonly statuses: readonly string[] }> {
  const statuses: string[] = [];
  const started = performance.now();
  while (performance.now() - started < DEPLOY_BUDGET_MS) {
    const read = await platform.newestDeploy(serviceId, signal);
    const status = read.status === 'found' ? read.deploy.status : read.status;
    if (statuses.at(-1) !== status) statuses.push(status);
    if (read.status === 'found' && read.deploy.progress !== 'pending') {
      assert.equal(read.deploy.progress, 'live', `The deploy ${read.deploy.id} ended as ${read.deploy.status} (${statuses.join(' > ')})`);
      return { deploy: read.deploy, statuses };
    }
    await clock.sleep(POLL_MS, signal);
  }
  throw new Error(`The deploy of ${serviceId} was not live within 15 minutes (${statuses.join(' > ')})`);
}

async function internalAddress(platform: RenderTenantPlatform, serviceId: string, signal: AbortSignal): Promise<string> {
  for (let read = 1; read <= ADDRESS_READS; read += 1) {
    const address = await platform.internalAddress(serviceId, signal);
    if (address.status === 'found') return address.internalUrl;
    await clock.sleep(POLL_MS, signal);
  }
  throw new Error(`Render gave no internal address of ${serviceId} after ${ADDRESS_READS} reads`);
}

// Deletes each service with the exact name of the test, also after a lost create answer, and waits until the service
// list of the workspace holds no service of the test.
async function cleanup(test: { readonly platform: RenderTenantPlatform; readonly driver: RenderReadDriver; readonly name: string; readonly owned: Set<string> }): Promise<void> {
  const signal = AbortSignal.timeout(5 * 60_000);
  const search = await test.platform.findServices(test.name, signal);
  assert.equal(search.status, 'found', `The cleanup cannot list the services. Delete ${test.name} in the Render Dashboard.`);
  for (const service of search.status === 'found' ? search.services : []) {
    test.owned.add(service.id);
    const deleted = await test.platform.deleteService(service.id, signal);
    assert.equal(deleted.status, 'deleted', `The cleanup could not delete ${service.id}. Delete ${test.name} in the Render Dashboard.`);
  }
  for (let read = 1; read <= CLEANUP_READS; read += 1) {
    if (!(await test.driver.services()).some((service) => service.name === test.name)) return;
    await clock.sleep(POLL_MS, signal);
  }
  throw new Error(`${test.name} is still in the service list. Delete it in the Render Dashboard.`);
}

test('Given the Thermus AI workspace, the registry credential ghcr-thermus-hosted-read, and a hosted image digest, when the live interface test creates one disposable tenant, then its deploy reaches live, its internal address has the form http://<slug>:8080, and its delete leaves no service of the test', { timeout: 30 * 60_000 }, async (t) => {
  const key = setupKey();
  const name = `${NAME_PREFIX}tenant-org_01live${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}`;
  const driver = new RenderReadDriver(key, settings.ownerId);
  await preflight(t, driver);
  // The adapter may write only to the services of this test, and never to the production service.
  const owned = new Set<string>();
  const platform = new RenderTenantPlatform({ apiKey: key, ...settings, clock, ownsService: async (id) => owned.has(id) && id !== PRODUCTION_SERVICE_ID });
  t.after(() => cleanup({ platform, driver, name, owned }));
  const signal = AbortSignal.timeout(25 * 60_000);

  const started = performance.now();
  const creation = await platform.createService({ name, plan: '0.5c-512mb', environment: placeholderEnvironment }, signal);
  const createMs = performance.now() - started;
  assert.equal(creation.status, 'created', JSON.stringify(creation));
  const serviceId = creation.status === 'created' ? creation.service.id : '';
  assert.notEqual(serviceId, PRODUCTION_SERVICE_ID);
  owned.add(serviceId);
  t.diagnostic(`Create: ${name} (${serviceId}) answered 201 after ${seconds(createMs)}.`);

  const { deploy, statuses } = await liveDeploy(platform, serviceId, signal);
  t.diagnostic(`Deploy: ${deploy.id} live ${seconds(performance.now() - started)} after the create call (${statuses.join(' > ')}), image ${deploy.imageDigest ?? 'no digest'}.`);
  assert.equal(deploy.imageDigest, settings.image.slice(settings.image.indexOf('@') + 1));
  const address = await internalAddress(platform, serviceId, signal);
  t.diagnostic(`Internal address: ${address}.`);
  assert.match(address, /^http:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?:8080$/);

  const deleteStarted = performance.now();
  assert.deepEqual(await platform.deleteService(serviceId, signal), { status: 'deleted' });
  t.diagnostic(`Delete: ${serviceId} deleted after ${seconds(performance.now() - deleteStarted)}.`);
  assert.deepEqual(await platform.findServices(name, signal), { status: 'found', services: [] });
  assert.deepEqual((await driver.services()).filter((service) => service.name.startsWith(NAME_PREFIX)), [], 'No thermus-spike-* service is left');
});
