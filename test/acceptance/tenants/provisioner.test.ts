import assert from 'node:assert/strict';
import { test } from 'node:test';
import { controlPlaneSecrets, tenantImage, tenantImageDigest, tenantProvisioningSettings } from '../../support/fixtures/control-plane-tenants.ts';
import { organizationA, organizationB, productionServiceId, ProvisioningHarness, serviceNameOf } from './fixtures/provisioning-harness.ts';

// SO-06 of the self on-boarding plan: the provisioner loop of the control plane takes one requested row of the tenant
// registry at a time and moves it through creating and deploying to live, through the Render adapter. The loop runs
// as app composes it from the control plane settings, against a fake of the Render API and a fake of the registry,
// with a virtual clock. The live interface test of the adapter runs the real Render API.

const freePlan = '0.5c-512mb';
const refusedTenantSettings = /^(?:WORKOS_API_KEY|WORKOS_CLIENT_SECRET|WORKOS_COOKIE_PASSWORD|GATEWAY_SIGNING_KEY|DATABASE_|LOGGING_DESTINATION_ENCRYPTION_KEY|RENDER_|STRIPE_)/;

function variablesOf(body: Record<string, unknown> | undefined): Map<string, string> {
  const envVars = Array.isArray(body?.envVars) ? body.envVars as { key: string; value: string }[] : [];
  return new Map(envVars.map(({ key, value }) => [key, value]));
}

function isLive(harness: ProvisioningHarness, organizationId: string): () => boolean {
  return () => harness.store.rows.get(organizationId)?.state === 'live';
}

function isFailed(harness: ProvisioningHarness, organizationId: string): () => boolean {
  return () => harness.store.rows.get(organizationId)?.state === 'failed';
}

test('Given a requested row, when the loop runs with a fake Render API, then the row reaches live with the service ID and the internal address http://<slug>:8080, and the create call has OPERATION_CAPACITY=5', async () => {
  const harness = new ProvisioningHarness();
  harness.store.request(organizationA);

  await harness.runUntil(isLive(harness, organizationA), 'a live row');

  const service = harness.render.service(serviceNameOf(organizationA));
  assert.ok(service !== undefined, 'Render has the service of the organization');
  assert.notEqual(service.slug, service.name, 'The fake gives a slug that differs from the name, so the address cannot come from the name');
  const row = harness.store.row(organizationA);
  assert.deepEqual(
    { serviceName: row.serviceName, serviceId: row.serviceId, internalUrl: row.internalUrl, imageDigest: row.imageDigest, plan: row.plan, appliedPlan: row.appliedPlan },
    { serviceName: service.name, serviceId: service.id, internalUrl: `http://${service.slug}:8080`, imageDigest: tenantImageDigest, plan: freePlan, appliedPlan: freePlan },
  );
  assert.deepEqual(harness.store.changes, [`${organizationA} creating`, `${organizationA} deploying`, `${organizationA} live`]);
  assert.equal(harness.createBodies().length, 1);
  assert.equal(variablesOf(harness.createBodies()[0]).get('OPERATION_CAPACITY'), '5');
  assert.deepEqual(harness.errorLines(), []);
});

test('Given the create call, when the fake API records it, then it holds each tenant variable of section 4.1 and the image digest, and no WorkOS API key, cookie password, database setting, Render setting, or Stripe setting', async () => {
  const harness = new ProvisioningHarness();
  harness.store.request(organizationA);

  await harness.runUntil(isLive(harness, organizationA), 'a live row');

  const [body] = harness.createBodies();
  const { ownerId, registryCredentialId } = harness.settings.render;
  assert.deepEqual({ ...body, envVars: undefined }, {
    type: 'private_service',
    name: serviceNameOf(organizationA),
    ownerId,
    image: { ownerId, imagePath: tenantImage, registryCredentialId },
    envVars: undefined,
    serviceDetails: { runtime: 'image', plan: freePlan, region: 'oregon', numInstances: 1 },
  });
  assert.ok(tenantImage.endsWith(`@${tenantImageDigest}`));
  assert.deepEqual([...variablesOf(body)], [
    ['THERMUS_ROLE', 'tenant'],
    ['TENANT_ORGANIZATION_ID', organizationA],
    ['PUBLIC_BASE_URL', 'https://thermus.example/'],
    ['WORKOS_AUTHKIT_ISSUER', 'https://thermus-test.authkit.app'],
    ['GATEWAY_PUBLIC_KEY', tenantProvisioningSettings.GATEWAY_PUBLIC_KEY],
    ['CONTROL_PLANE_INTERNAL_URL', 'http://thermus-control-plane:8080'],
    ['OPERATION_CAPACITY', '5'],
  ]);
  for (const key of variablesOf(body).keys()) assert.doesNotMatch(key, refusedTenantSettings);
  const sent = JSON.stringify(harness.render.requests.map((request) => request.body));
  for (const [name, secret] of Object.entries(controlPlaneSecrets)) assert.ok(!sent.includes(secret), `No request body holds ${name}`);
  assert.ok(harness.render.requests.every((request) => request.authorized), 'Each call carries the Render API key in its header only');
});

test('Given a Render 429 with Retry-After, when the loop runs, then it waits for Retry-After and creates no second service', async () => {
  const harness = new ProvisioningHarness();
  harness.render.failNext('create service', { status: 429, headers: { 'Retry-After': '30', 'Ratelimit-Limit': '20', 'Ratelimit-Remaining': '0', 'Ratelimit-Reset': '30' }, body: { message: 'Rate limit exceeded' } });
  harness.store.request(organizationA);

  await harness.runUntil(isLive(harness, organizationA), 'a live row after the limit');

  const creates = harness.render.requestsOf('create service');
  assert.equal(creates.length, 2, 'The refused create and one create after the wait');
  const [refused, accepted] = creates;
  assert.ok(refused !== undefined && accepted !== undefined);
  assert.ok(accepted.at - refused.at >= 30_000, `The second create came ${accepted.at - refused.at} ms after the 429, not 30 s or more`);
  assert.equal(harness.render.services().length, 1);
  assert.equal(harness.store.row(organizationA).serviceId, harness.render.services()[0]?.id);
  assert.deepEqual(harness.errorLines(), []);
});

test('Given a restart after creating, when the loop runs again, then it finds the service by name and continues', async () => {
  const harness = new ProvisioningHarness();
  const name = serviceNameOf(organizationA);
  const service = harness.render.addService(name, { outcome: 'live', readsLeft: 1 });
  harness.store.put({ organizationId: organizationA, state: 'creating', serviceName: name, plan: freePlan });

  await harness.runUntil(isLive(harness, organizationA), 'a live row after the restart');

  assert.deepEqual(harness.createBodies(), [], 'No create: the service of the earlier run exists');
  const row = harness.store.row(organizationA);
  assert.deepEqual({ serviceId: row.serviceId, internalUrl: row.internalUrl }, { serviceId: service.id, internalUrl: `http://${service.slug}:8080` });
  assert.deepEqual(harness.store.changes, [`${organizationA} deploying`, `${organizationA} live`]);
});

test('Given a create call that got no answer while Render made the service, when the loop runs again, then it finds the service by name and creates no second service', async () => {
  const harness = new ProvisioningHarness();
  harness.render.failNext('create service', 'lost');
  harness.store.request(organizationA);

  await harness.runUntil(isLive(harness, organizationA), 'a live row after the lost answer');

  assert.equal(harness.render.requestsOf('create service').length, 1);
  assert.equal(harness.render.services().length, 1);
  assert.equal(harness.store.row(organizationA).serviceId, harness.render.services()[0]?.id);
  assert.ok(harness.render.requestsOf('list services').length >= 2, 'The loop searched by name again after the lost answer');
});

test('Given two services with the name of the row, when the loop searches, then the row becomes failed, and the operator gets one report', async () => {
  const harness = new ProvisioningHarness();
  const name = serviceNameOf(organizationA);
  harness.render.addService(name);
  harness.render.addService(name);
  harness.store.request(organizationA);

  await harness.runUntil(isFailed(harness, organizationA), 'a failed row');

  assert.deepEqual(harness.createBodies(), []);
  assert.match(harness.store.row(organizationA).failureReason ?? '', new RegExp(`2 Render services have the name ${name}`));
  const errors = harness.errorLines();
  assert.equal(errors.length, 1, errors.join('\n'));
  assert.match(errors[0] ?? '', new RegExp(`Tenant provisioning failed.*${organizationA}`));
});

test('Given a deploy that fails, when the loop polls it, then the row becomes failed with the reason, and the operator gets one report', async () => {
  const harness = new ProvisioningHarness();
  harness.render.deployOutcome = 'update_failed';
  harness.store.request(organizationA);

  await harness.runUntil(isFailed(harness, organizationA), 'a failed row');

  const row = harness.store.row(organizationA);
  assert.match(row.failureReason ?? '', /update_failed/);
  assert.equal(row.serviceId, harness.render.services()[0]?.id, 'The failed row keeps its service ID for the operator');
  const errors = harness.errorLines();
  assert.equal(errors.length, 1, errors.join('\n'));
  assert.match(errors[0] ?? '', /Tenant provisioning failed.*update_failed/);
});

test('Given two requested rows, when the loop runs, then it claims one row at a time', async () => {
  const harness = new ProvisioningHarness();
  harness.store.request(organizationA);
  harness.store.request(organizationB);

  await harness.runUntil(() => isLive(harness, organizationA)() && isLive(harness, organizationB)(), 'two live rows');

  assert.deepEqual(harness.store.changes, [
    `${organizationA} creating`, `${organizationA} deploying`, `${organizationA} live`,
    `${organizationB} creating`, `${organizationB} deploying`, `${organizationB} live`,
  ]);
  assert.deepEqual(harness.createBodies().map((body) => body.name), [serviceNameOf(organizationA), serviceNameOf(organizationB)]);
});

test('Given a read that fails with a 5xx answer or a network failure, when the loop runs, then it repeats the read within its bound and never sends a create two times', async () => {
  const harness = new ProvisioningHarness();
  harness.render.failNext('list services', { status: 503, body: { message: 'Service Unavailable' } });
  harness.render.failNext('list services', 'network');
  harness.render.failNext('list deploys', { status: 502, body: { message: 'Bad Gateway' } });
  harness.render.failNext('list deploys', 'network');
  harness.store.request(organizationA);

  await harness.runUntil(isLive(harness, organizationA), 'a live row after the failed reads');

  assert.equal(harness.render.requestsOf('list services').length, 3, 'Two failed reads and one answer, within the 3 attempts');
  assert.equal(harness.render.requestsOf('create service').length, 1);
  assert.equal(harness.render.services().length, 1);
});

test('Given a deploying row after a resume, when the loop runs, then it sets live when the newest deploy is live', async () => {
  const harness = new ProvisioningHarness();
  const name = serviceNameOf(organizationA);
  const service = harness.render.addService(name);
  const resume = harness.render.addDeploy(service.id, { trigger: 'service_resumed', outcome: 'live', readsLeft: 2 });
  harness.store.put({ organizationId: organizationA, state: 'deploying', serviceName: name, serviceId: service.id, internalUrl: `http://${service.slug}:8080`, plan: freePlan, appliedPlan: freePlan });

  await harness.runUntil(isLive(harness, organizationA), 'a live row after the resume');

  assert.equal(resume.status, 'live');
  assert.ok(harness.render.requestsOf('list deploys').length >= 3, 'The loop polled the newest deploy until it was live');
  assert.deepEqual(harness.createBodies(), []);
  assert.deepEqual(harness.store.changes, [`${organizationA} live`]);
});

test('Given rows that are live, suspended, failed, or deleted, when the loop runs, then it changes none of them and sends no Render call', async () => {
  const harness = new ProvisioningHarness();
  harness.store.put({ organizationId: 'org_live', state: 'live', serviceName: 'thermus-tenant-org_live', serviceId: 'srv-livetenant', internalUrl: 'http://thermus-tenant-org-live:8080' });
  harness.store.put({ organizationId: 'org_suspended', state: 'suspended', serviceName: 'thermus-tenant-org_suspended', serviceId: 'srv-suspendedtenant' });
  harness.store.put({ organizationId: 'org_failed', state: 'failed', serviceName: 'thermus-tenant-org_failed', failureReason: 'an earlier failure' });
  harness.store.put({ organizationId: 'org_deleted', state: 'deleted', serviceName: 'thermus-tenant-org_deleted' });
  const before = JSON.stringify([...harness.store.rows.values()]);

  await harness.runFor(60_000);

  assert.deepEqual(harness.render.requests, []);
  assert.deepEqual(harness.store.changes, []);
  assert.equal(JSON.stringify([...harness.store.rows.values()]), before);
});

test('Given a write for a service ID that the registry does not own, or for the production service, when the adapter gets it, then it refuses the write before any call', async () => {
  const harness = new ProvisioningHarness();
  const owned = harness.render.addService('thermus-tenant-owned');
  harness.store.put({ organizationId: organizationA, state: 'live', serviceName: 'thermus-tenant-owned', serviceId: owned.id });
  harness.store.put({ organizationId: organizationB, state: 'live', serviceName: 'thermus-production', serviceId: productionServiceId });
  const platform = harness.platform();
  const signal = new AbortController().signal;

  assert.equal((await platform.deleteService('srv-notownedbytheregistry', signal)).status, 'refused');
  assert.equal((await platform.deleteService(productionServiceId, signal)).status, 'refused', 'Also when a row names the production service');
  assert.deepEqual(harness.render.requestsOf('delete service'), []);

  assert.deepEqual(await platform.deleteService(owned.id, signal), { status: 'deleted' });
  assert.equal(harness.render.requestsOf('delete service').length, 1);
  assert.equal(harness.render.service('thermus-tenant-owned'), undefined);
});
