import assert from 'node:assert/strict';
import { test } from 'node:test';
import { serviceNameOf } from '../../../src/tenancy/tenants/tenant-environment.ts';
import { TenantProvisioner } from '../../../src/tenancy/tenants/tenant-provisioner.ts';
import { OperatorLogSpy } from '../../support/doubles/application/operator-log-spy.ts';
import { TenantProvisioningStoreFake } from '../../support/doubles/tenants/tenant-provisioning-store-fake.ts';
import { VirtualClock } from '../../support/doubles/tenants/virtual-clock.ts';
import { TenantPlatformFake } from './fixtures/tenant-platform-fake.ts';

const organization = 'org_01JUNITAAAAAAAAAAAAAAAAAAA';
const otherOrganization = 'org_01JUNITBBBBBBBBBBBBBBBBBB';
const name = 'thermus-tenant-org-01junitaaaaaaaaaaaaaaaaaaa';
const tenant = {
  publicBaseUrl: 'https://thermus.example/',
  authkitIssuer: 'https://thermus-test.authkit.app',
  gatewayPublicKey: '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAplaceholderplaceholderplaceholderplace=\n-----END PUBLIC KEY-----\n',
  controlPlaneInternalUrl: 'http://thermus-control-plane:8080',
};
const live = { status: 'found', deploy: { id: 'dep-1', progress: 'live', status: 'live', imageDigest: `sha256:${'d'.repeat(64)}` } } as const;
const inProgress = { status: 'found', deploy: { id: 'dep-1', progress: 'pending', status: 'update_in_progress' } } as const;

function provisionerWith(options: { readonly namePrefix?: string } = {}) {
  const platform = new TenantPlatformFake();
  const store = new TenantProvisioningStoreFake();
  const clock = new VirtualClock();
  const log = new OperatorLogSpy();
  const provisioner = new TenantProvisioner({ platform, store, clock, log, tenant, namePrefix: options.namePrefix ?? 'thermus-tenant-', freePlan: '0.5c-512mb' });
  const runUntil = async (condition: () => boolean): Promise<void> => {
    const controller = new AbortController();
    const running = provisioner.run(controller.signal);
    const deadline = performance.now() + 5_000;
    while (!condition() && performance.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 1));
    controller.abort();
    await running;
    assert.ok(condition(), `The condition did not hold. Calls: ${platform.calls.join(', ')}. Log: ${log.lines.join(' | ')}`);
  };
  const stateOf = (organizationId: string) => () => store.rows.get(organizationId)?.state;
  const errors = (): string[] => log.lines.filter((line) => line.startsWith('ERROR '));
  return { platform, store, clock, log, provisioner, runUntil, stateOf, errors };
}

test('Given a requested row, when the loop runs, then it names the service, creates it once with the free plan, records each state, and logs one record line for each', async () => {
  const { platform, store, log, runUntil, stateOf } = provisionerWith();
  store.request(organization);

  await runUntil(() => stateOf(organization)() === 'live');

  assert.deepEqual(platform.calls, [`find ${name}`, `create ${name}`, 'deploy srv-new1', 'address srv-new1']);
  assert.equal(platform.requests[0]?.plan, '0.5c-512mb');
  const row = store.row(organization);
  assert.deepEqual([row.serviceName, row.serviceId, row.internalUrl, row.imageDigest, row.plan, row.appliedPlan], [name, 'srv-new1', 'http://slug-of-srv-new1:8080', `sha256:${'d'.repeat(64)}`, '0.5c-512mb', '0.5c-512mb']);
  assert.deepEqual(log.lines.map((line) => JSON.parse(line.replace(/^INFO Tenant provisioning record: /, '')) as unknown), [
    { organizationId: organization, state: 'creating', serviceName: name },
    { organizationId: organization, state: 'deploying', serviceName: name, serviceId: 'srv-new1' },
    { organizationId: organization, state: 'live', serviceName: name, serviceId: 'srv-new1', internalUrl: 'http://slug-of-srv-new1:8080', imageDigest: `sha256:${'d'.repeat(64)}` },
  ]);
});

test('Given TENANT_NAME_PREFIX, when the loop names a service, then the name is the prefix and the organization ID in lower case with the underscore as a hyphen', async () => {
  const { platform, store, runUntil, stateOf } = provisionerWith({ namePrefix: 'thermus-spike-tenant-' });
  store.request(organization);

  await runUntil(() => stateOf(organization)() === 'live');

  assert.equal(platform.requests[0]?.name, 'thermus-spike-tenant-org-01junitaaaaaaaaaaaaaaaaaaa');
  assert.equal(store.row(organization).serviceName, 'thermus-spike-tenant-org-01junitaaaaaaaaaaaaaaaaaaa');
});

test('Given organization IDs with characters outside a-z, 0-9, and hyphen, when their service names are made, then each such character becomes a hyphen after the change to lower case', () => {
  assert.deepEqual(
    ['org_01HXAB', 'Org.01_x+Y', 'org-01-ab', 'org_ÄB'].map((organizationId) => serviceNameOf('thermus-tenant-', organizationId)),
    ['thermus-tenant-org-01hxab', 'thermus-tenant-org-01-x-y', 'thermus-tenant-org-01-ab', 'thermus-tenant-org--b'],
  );
});

test('Given a new free tenant, when the loop creates it, then its variables are exactly the tenant settings of section 4.1 with OPERATION_CAPACITY 5', async () => {
  const { platform, store, runUntil, stateOf } = provisionerWith();
  store.request(organization);

  await runUntil(() => stateOf(organization)() === 'live');

  assert.deepEqual([...(platform.requests[0]?.environment ?? [])], [
    ['THERMUS_ROLE', 'tenant'],
    ['TENANT_ORGANIZATION_ID', organization],
    ['PUBLIC_BASE_URL', tenant.publicBaseUrl],
    ['WORKOS_AUTHKIT_ISSUER', tenant.authkitIssuer],
    ['GATEWAY_PUBLIC_KEY', tenant.gatewayPublicKey],
    ['CONTROL_PLANE_INTERNAL_URL', tenant.controlPlaneInternalUrl],
    ['OPERATION_CAPACITY', '5'],
  ]);
});

test('Given one service with the name of the row, when the loop searches, then it takes that service and sends no create', async () => {
  const { platform, store, runUntil, stateOf } = provisionerWith();
  platform.services.push({ id: 'srv-earlier', name });
  store.request(organization);

  await runUntil(() => stateOf(organization)() === 'live');

  assert.deepEqual(platform.calls, [`find ${name}`, 'deploy srv-earlier', 'address srv-earlier']);
  assert.equal(store.row(organization).serviceId, 'srv-earlier');
});

test('Given two services with the name of the row, when the loop searches, then the row fails at once with one operator report and no create', async () => {
  const { platform, store, runUntil, stateOf, errors } = provisionerWith();
  platform.services.push({ id: 'srv-one', name }, { id: 'srv-two', name });
  store.request(organization);

  await runUntil(() => stateOf(organization)() === 'failed');

  assert.deepEqual(platform.calls, [`find ${name}`]);
  assert.equal(store.row(organization).failureReason, `2 services of the platform have the name ${name}`);
  assert.deepEqual(errors(), [`ERROR Tenant provisioning failed: ${JSON.stringify({ organizationId: organization, serviceName: name, reason: `2 services of the platform have the name ${name}` })}`]);
});

test('Given a create that the platform refuses, when the loop creates, then the row fails at once with the reason and one report', async () => {
  const { platform, store, runUntil, stateOf, errors } = provisionerWith();
  platform.creations.push({ status: 'refused', reason: 'Render answered 402: payment information required' });
  store.request(organization);

  await runUntil(() => stateOf(organization)() === 'failed');

  assert.deepEqual(platform.calls, [`find ${name}`, `create ${name}`]);
  assert.equal(store.row(organization).failureReason, 'The platform refused the create: Render answered 402: payment information required');
  assert.equal(errors().length, 1);
});

test('Given a create without a clear answer, when the loop tries again after 30 s, then it searches by name first and takes the service that Render made', async () => {
  const { platform, store, clock, log, runUntil, stateOf } = provisionerWith();
  platform.creations.push({ status: 'unknown', reason: 'no answer: fetch failed' });
  platform.onCall = (call) => { if (call === `create ${name}`) platform.services.push({ id: 'srv-made', name }); };
  store.request(organization);

  await runUntil(() => stateOf(organization)() === 'live');

  assert.deepEqual(platform.calls, [`find ${name}`, `create ${name}`, `find ${name}`, 'deploy srv-made', 'address srv-made']);
  assert.equal(clock.waits[0], 30_000);
  assert.equal(store.row(organization).serviceId, 'srv-made');
  assert.match(log.lines.find((line) => line.includes('retry')) ?? '', /"attempt":2,"waitSeconds":30,"reason":"the create got no clear answer \(no answer: fetch failed\)"/);
});

test('Given a rate-limited create, when the loop waits for the Retry-After time, then the next attempt searches and creates one service', async () => {
  const { platform, store, clock, log, runUntil, stateOf } = provisionerWith();
  platform.creations.push({ status: 'rate-limited', retryAfterMs: 120_000 });
  store.request(organization);

  await runUntil(() => stateOf(organization)() === 'live');

  assert.deepEqual(platform.calls.slice(0, 4), [`find ${name}`, `create ${name}`, `find ${name}`, `create ${name}`]);
  assert.equal(clock.waits[0], 120_000);
  assert.equal(platform.services.length, 1);
  assert.match(log.lines.find((line) => line.includes('retry')) ?? '', /"reason":"The platform limits the creates for 120 s"/);
});

test('Given a rate limit above one hour, when the loop waits, then it waits one hour', async () => {
  const { platform, store, clock, runUntil, stateOf } = provisionerWith();
  platform.creations.push({ status: 'rate-limited', retryAfterMs: 7_200_000 });
  store.request(organization);

  await runUntil(() => stateOf(organization)() === 'live');

  assert.equal(clock.waits[0], 3_600_000);
});

test('Given creates without a clear answer three times, when no service appears, then the row fails after the third attempt', async () => {
  const { platform, store, clock, runUntil, stateOf, errors } = provisionerWith();
  for (let attempt = 0; attempt < 3; attempt += 1) platform.creations.push({ status: 'unknown', reason: 'Render answered 503' });
  store.request(organization);

  await runUntil(() => stateOf(organization)() === 'failed');

  assert.deepEqual(platform.calls, [`find ${name}`, `create ${name}`, `find ${name}`, `create ${name}`, `find ${name}`, `create ${name}`]);
  assert.deepEqual(clock.waits.slice(0, 2), [30_000, 30_000]);
  assert.equal(store.row(organization).failureReason, 'No tenant service after 3 attempts. The last attempt: the create got no clear answer (Render answered 503)');
  assert.equal(errors().length, 1);
});

test('Given a service list that stays unavailable, when the loop searches three times, then the row fails and no create is sent', async () => {
  const { platform, store, runUntil, stateOf } = provisionerWith();
  for (let attempt = 0; attempt < 3; attempt += 1) platform.searches.push({ status: 'unavailable', reason: 'Render answered 500' });
  store.request(organization);

  await runUntil(() => stateOf(organization)() === 'failed');

  assert.deepEqual(platform.calls, [`find ${name}`, `find ${name}`, `find ${name}`]);
  assert.match(store.row(organization).failureReason ?? '', /the service list is unavailable \(Render answered 500\)/);
});

test('Given a deploy that ends as update_failed, when the loop polls it, then the row fails with the deploy and its status', async () => {
  const { platform, store, runUntil, stateOf, errors } = provisionerWith();
  platform.deploys.push(inProgress, { status: 'found', deploy: { id: 'dep-1', progress: 'failed', status: 'update_failed' } });
  store.request(organization);

  await runUntil(() => stateOf(organization)() === 'failed');

  assert.equal(store.row(organization).failureReason, 'The deploy dep-1 of srv-new1 ended as update_failed');
  assert.equal(store.row(organization).serviceId, 'srv-new1');
  assert.equal(errors().length, 1);
});

test('Given a deploy that never ends, when the loop polls it every 5 s, then the row fails after 15 minutes', async () => {
  const { platform, store, clock, runUntil, stateOf } = provisionerWith();
  for (let read = 0; read < 200; read += 1) platform.deploys.push(inProgress);
  store.request(organization);

  await runUntil(() => stateOf(organization)() === 'failed');

  const reads = platform.calls.filter((call) => call.startsWith('deploy ')).length;
  assert.equal(reads, 180, 'One read every 5 s during 15 minutes');
  assert.ok(clock.waits.every((wait) => wait === 5_000 || wait === 30_000));
  assert.equal(store.row(organization).failureReason, 'The deploy of srv-new1 did not reach live within 15 minutes. Last seen: dep-1 update_in_progress');
});

test('Given a live deploy without an internal address, an unavailable read, and no deploy yet, when the loop polls, then it goes on until the address is there', async () => {
  const { platform, store, runUntil, stateOf } = provisionerWith();
  platform.deploys.push({ status: 'none' }, { status: 'unavailable', reason: 'Render answered 502' }, live, live);
  platform.addresses.push({ status: 'pending' });
  store.request(organization);

  await runUntil(() => stateOf(organization)() === 'live');

  assert.deepEqual(platform.calls.slice(2), ['deploy srv-new1', 'deploy srv-new1', 'deploy srv-new1', 'address srv-new1', 'deploy srv-new1', 'address srv-new1']);
});

test('Given a deploying row whose service is gone, when the loop polls, then the row fails', async () => {
  const { platform, store, runUntil, stateOf } = provisionerWith();
  platform.deploys.push({ status: 'gone' });
  store.put({ organizationId: organization, state: 'deploying', serviceName: name, serviceId: 'srv-gone' });

  await runUntil(() => stateOf(organization)() === 'failed');

  assert.equal(store.row(organization).failureReason, 'The tenant service srv-gone no longer exists');
});

test('Given a deploying row after a resume, when the loop claims it, then it watches the newest deploy and sets live without a create', async () => {
  const { platform, store, log, runUntil, stateOf } = provisionerWith();
  platform.deploys.push(inProgress, live);
  store.put({ organizationId: organization, state: 'deploying', serviceName: name, serviceId: 'srv-resumed', internalUrl: 'http://slug-of-srv-resumed:8080' });

  await runUntil(() => stateOf(organization)() === 'live');

  assert.deepEqual(platform.calls, ['deploy srv-resumed', 'deploy srv-resumed', 'address srv-resumed']);
  assert.match(log.lines[0] ?? '', /"state":"deploying".*"resumed":true/);
});

test('Given a deploying row whose service another writer replaces while the loop watches, when the old deploy is live, then the loop leaves the row with the new service', async () => {
  const { platform, store, log, runUntil } = provisionerWith();
  platform.onCall = (call) => {
    if (call === 'address srv-resumed') store.put({ organizationId: organization, state: 'deploying', serviceName: name, serviceId: 'srv-other' });
  };
  store.put({ organizationId: organization, state: 'deploying', serviceName: name, serviceId: 'srv-resumed', internalUrl: 'http://slug-of-srv-resumed:8080' });

  await runUntil(() => log.lines.some((line) => line.includes('leaves')));

  const row = store.row(organization);
  assert.equal(row.serviceId, 'srv-other');
  assert.notEqual(row.internalUrl, 'http://slug-of-srv-resumed:8080', 'The live record of the old service never reaches the new row');
  assert.ok(log.lines.every((line) => !line.includes('"serviceId":"srv-resumed","internalUrl"')), 'No live record line names the old service');
});

test('Given a deploying row without a service ID, when the loop claims it, then the row fails without a platform call', async () => {
  const { platform, store, runUntil, stateOf } = provisionerWith();
  store.put({ organizationId: organization, state: 'deploying', serviceName: name });

  await runUntil(() => stateOf(organization)() === 'failed');

  assert.deepEqual(platform.calls, []);
  assert.equal(store.row(organization).failureReason, 'The deploying row has no tenant service ID');
});

test('Given no row to work on, when the loop runs, then it reads the registry every 5 s and calls no platform operation', async () => {
  const { platform, clock, runUntil } = provisionerWith();

  await runUntil(() => clock.now() >= 20_000);

  assert.deepEqual(platform.calls, []);
  assert.ok(clock.waits.every((wait) => wait === 5_000));
});

test('Given an unavailable registry, when the loop claims, then it logs one error and waits 60 s', async () => {
  const { store, clock, runUntil, errors } = provisionerWith();
  store.unavailable.add('claim');

  await runUntil(() => clock.waits.length >= 1);

  assert.equal(clock.waits[0], 60_000);
  assert.deepEqual(errors().slice(0, 1), ['ERROR Tenant provisioning cannot read the tenant registry. It tries again in 60 s.']);
});

test('Given a row that changes elsewhere before the service is recorded, when the loop records it, then the loop leaves the row', async () => {
  const { platform, store, log, runUntil } = provisionerWith();
  platform.onCall = (call) => { if (call.startsWith('create ')) store.row(organization).state = 'deleted'; };
  store.request(organization);

  await runUntil(() => log.lines.some((line) => line.includes('leaves')));

  assert.equal(store.row(organization).state, 'deleted');
  assert.deepEqual(platform.calls, [`find ${name}`, `create ${name}`]);
  assert.match(log.lines.at(-1) ?? '', /^INFO Tenant provisioning leaves organization org_01JUNITAAAAAAAAAAAAAAAAAAA: its row changed during the work\.$/);
});

test('Given a failed write of the service, when the loop tries again after 60 s, then it resumes the creating row and finds the service by name', async () => {
  const { platform, store, clock, runUntil, stateOf, errors } = provisionerWith();
  store.unavailable.add('service');
  platform.onCall = (call) => { if (call.startsWith('create ')) setImmediate(() => store.unavailable.delete('service')); };
  store.request(organization);

  await runUntil(() => stateOf(organization)() === 'live');

  assert.deepEqual(platform.calls, [`find ${name}`, `create ${name}`, `find ${name}`, 'deploy srv-new1', 'address srv-new1']);
  assert.ok(clock.waits.includes(60_000));
  assert.deepEqual(errors(), [`ERROR Tenant provisioning could not write the row of organization ${organization}. It tries again in 60 s.`]);
});

test('Given a failure that the registry cannot record, when the loop tries again, then it reports the failure once it is recorded', async () => {
  const { platform, store, runUntil, stateOf, errors } = provisionerWith();
  platform.services.push({ id: 'srv-one', name }, { id: 'srv-two', name });
  store.unavailable.add('failed');
  platform.onCall = () => { if (platform.calls.length === 2) store.unavailable.delete('failed'); };
  store.request(organization);

  await runUntil(() => stateOf(organization)() === 'failed');

  assert.deepEqual(errors(), [
    `ERROR Tenant provisioning could not write the row of organization ${organization}. It tries again in 60 s.`,
    `ERROR Tenant provisioning failed: ${JSON.stringify({ organizationId: organization, serviceName: name, reason: `2 services of the platform have the name ${name}` })}`,
  ]);
});

test('Given two requested rows, when the loop runs, then it finishes one row before it claims the next', async () => {
  const { store, runUntil, stateOf } = provisionerWith();
  store.request(organization);
  store.request(otherOrganization);

  await runUntil(() => stateOf(organization)() === 'live' && stateOf(otherOrganization)() === 'live');

  assert.deepEqual(store.changes, [
    `${organization} creating`, `${organization} deploying`, `${organization} live`,
    `${otherOrganization} creating`, `${otherOrganization} deploying`, `${otherOrganization} live`,
  ]);
});

test('Given a stop during a platform call, when the loop stops, then it records nothing more and the row waits for the next start', async () => {
  const { platform, store, provisioner } = provisionerWith();
  const controller = new AbortController();
  platform.onCall = (call) => { if (call.startsWith('create ')) controller.abort(); };
  store.request(organization);

  await provisioner.run(controller.signal);

  assert.deepEqual(platform.calls, [`find ${name}`, `create ${name}`]);
  assert.equal(store.row(organization).state, 'creating');
});

test('Given an unexpected failure of a collaborator, when the loop meets it, then it logs one error, waits 60 s, and goes on', async () => {
  const { platform, store, clock, runUntil, stateOf, errors } = provisionerWith();
  let thrown = false;
  platform.onCall = () => { if (!thrown) { thrown = true; throw new Error('private platform failure'); } };
  store.request(organization);

  await runUntil(() => stateOf(organization)() === 'live');

  assert.deepEqual(errors(), ['ERROR Tenant provisioning failed unexpectedly: private platform failure. It tries again in 60 s.']);
  assert.equal(clock.waits[0], 60_000);
});
