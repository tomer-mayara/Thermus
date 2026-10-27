import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { PRODUCTION_SERVICE_ID, RenderTenantPlatform } from '../../../src/tenancy/providers/render/render-tenant-platform.ts';
import { serviceNameOf } from '../../../src/tenancy/tenants/tenant-environment.ts';
import type { PlatformDeploy } from '../../../src/tenancy/tenants/tenant-platform.ts';
import { RenderReadDriver } from '../../support/drivers/render/render-read-driver.ts';
import { workOSSettings } from '../../support/fixtures/hosted-placeholder.ts';

// The live interface test of the Render adapter of the tenant platform (SO-06). In the workspace Thermus AI, with the
// registry credential ghcr-thermus-hosted-read and a hosted image by digest, it creates two disposable private
// services with the name rule of the provisioner, thermus-spike-tenant-org-01a<UTC time> and then
// thermus-spike-tenant-org-01b<UTC time>, whose names share their first 27 characters. Render shortens a long name
// into the hostname at a separator, so the two can share a shortened start. For each it waits until the newest deploy
// is live, reads the internal address through the adapter and the slug and serviceDetails.url from the API, and
// checks that the address is the slug on port 8080. The two addresses must differ. It deletes both, also after a
// failure. Before any call it refuses the workspace My Workspace and the production service, and a preflight with
// reads only finds no other thermus-spike-* service.
// The published image has no tenant role yet (SO-03), so each service gets the placeholder environment of SO-01c
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

interface LiveParts {
  readonly t: TestContext;
  readonly platform: RenderTenantPlatform;
  readonly driver: RenderReadDriver;
  readonly owned: Set<string>;
  readonly answers: readonly string[];
  readonly signal: AbortSignal;
}

interface LiveTenant {
  readonly serviceId: string;
  readonly address: string;
}

// The method, path, and status of each answer of the Render API, without a header or a body, so a refused create
// shows the status that Render gave.
function answerLog(): { readonly lines: string[]; readonly fetch: typeof fetch } {
  const lines: string[] = [];
  const logged: typeof fetch = async (input, init) => {
    const response = await fetch(input, init);
    lines.push(`${init?.method ?? 'GET'} ${new URL(String(input)).pathname} ${response.status}`);
    return response;
  };
  return { lines, fetch: logged };
}

// Creates one tenant, waits until its deploy is live, and reads its address through the adapter and its slug and
// serviceDetails.url from the API.
async function liveTenant(parts: LiveParts, name: string): Promise<LiveTenant> {
  const { t, platform, driver, owned, signal } = parts;
  const started = performance.now();
  const creation = await platform.createService({ name, plan: '0.5c-512mb', environment: placeholderEnvironment }, signal);
  t.diagnostic(`Create: ${name}: ${JSON.stringify(creation)}, answer ${parts.answers.at(-1) ?? 'none'}, after ${seconds(performance.now() - started)}.`);
  assert.equal(creation.status, 'created', `Render did not accept the create of ${name}`);
  const serviceId = creation.status === 'created' ? creation.service.id : '';
  assert.notEqual(serviceId, PRODUCTION_SERVICE_ID);
  owned.add(serviceId);
  const { deploy, statuses } = await liveDeploy(platform, serviceId, signal);
  t.diagnostic(`Deploy: ${deploy.id} live ${seconds(performance.now() - started)} after the create call (${statuses.join(' > ')}), image ${deploy.imageDigest ?? 'no digest'}.`);
  assert.equal(deploy.imageDigest, settings.image.slice(settings.image.indexOf('@') + 1));
  const address = await internalAddress(platform, serviceId, signal);
  const view = await driver.address(serviceId);
  t.diagnostic(`Address: ${serviceId} has the slug ${view.slug} and serviceDetails.url ${view.url}; the adapter reads ${address}.`);
  assert.equal(address, `http://${view.slug}:8080`, 'The address is the slug that Render returns, on port 8080');
  return { serviceId, address };
}

interface CleanupParts {
  readonly platform: RenderTenantPlatform;
  readonly driver: RenderReadDriver;
  readonly names: readonly string[];
  readonly owned: Set<string>;
}

// Deletes each service with an exact name of the test, also after a lost create answer, and waits until the service
// list of the workspace holds no service of the test. A failure for one name does not stop the delete of the other.
async function cleanup(test: CleanupParts): Promise<void> {
  const signal = AbortSignal.timeout(5 * 60_000);
  const problems: string[] = [];
  for (const name of test.names) problems.push(...await deleteByName(test, name, signal));
  const left = await servicesLeft(test, signal);
  if (problems.length > 0 || left.length > 0) {
    throw new Error(`${problems.join(' ')} Left: ${left.join(', ') || 'none'}. Delete ${test.names.join(' and ')} in the Render Dashboard.`);
  }
}

async function deleteByName(test: CleanupParts, name: string, signal: AbortSignal): Promise<string[]> {
  const search = await test.platform.findServices(name, signal);
  if (search.status !== 'found') return [`The cleanup cannot list the services of ${name}: ${search.reason}.`];
  const problems: string[] = [];
  for (const service of search.services) {
    test.owned.add(service.id);
    const deleted = await test.platform.deleteService(service.id, signal);
    if (deleted.status !== 'deleted') problems.push(`The cleanup could not delete ${service.id}: ${deleted.reason}.`);
  }
  return problems;
}

async function servicesLeft(test: CleanupParts, signal: AbortSignal): Promise<readonly string[]> {
  let left: readonly string[] = [];
  for (let read = 1; read <= CLEANUP_READS; read += 1) {
    left = (await test.driver.services()).filter((service) => test.names.includes(service.name)).map((service) => service.name);
    if (left.length === 0) return left;
    await clock.sleep(POLL_MS, signal);
  }
  return left;
}

test('Given the Thermus AI workspace, the registry credential ghcr-thermus-hosted-read, and a hosted image digest, when the live interface test creates two disposable tenants whose names share their first 27 characters, one after the other, then Render accepts both, each internal address is the slug that Render returns on port 8080, the two addresses differ, and the deletes leave no service of the test', { timeout: 45 * 60_000 }, async (t) => {
  const key = setupKey();
  const time = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const firstName = serviceNameOf(`${NAME_PREFIX}tenant-`, `org_01a${time}`);
  const secondName = serviceNameOf(`${NAME_PREFIX}tenant-`, `org_01b${time}`);
  const driver = new RenderReadDriver(key, settings.ownerId);
  await preflight(t, driver);
  // The adapter may write only to the services of this test, and never to the production service.
  const owned = new Set<string>();
  const answers = answerLog();
  const platform = new RenderTenantPlatform({ apiKey: key, ...settings, clock, fetch: answers.fetch, ownsService: async (id) => owned.has(id) && id !== PRODUCTION_SERVICE_ID });
  t.after(() => cleanup({ platform, driver, names: [firstName, secondName], owned }));
  const parts = { t, platform, driver, owned, answers: answers.lines, signal: AbortSignal.timeout(40 * 60_000) };

  const first = await liveTenant(parts, firstName);
  const second = await liveTenant(parts, secondName);
  assert.notEqual(second.address, first.address, 'Two services with the same shortened start get two addresses');

  for (const tenant of [first, second]) {
    const deleteStarted = performance.now();
    assert.deepEqual(await platform.deleteService(tenant.serviceId, parts.signal), { status: 'deleted' });
    t.diagnostic(`Delete: ${tenant.serviceId} deleted after ${seconds(performance.now() - deleteStarted)}.`);
  }
  for (const name of [firstName, secondName]) assert.deepEqual(await platform.findServices(name, parts.signal), { status: 'found', services: [] });
  assert.deepEqual((await driver.services()).filter((service) => service.name.startsWith(NAME_PREFIX)), [], 'No thermus-spike-* service is left');
});
