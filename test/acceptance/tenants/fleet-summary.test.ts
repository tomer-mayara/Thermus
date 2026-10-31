import assert from 'node:assert/strict';
import { test } from 'node:test';
import { organizationA, organizationB, serviceNameOf, SweepHarness, tuesdayBeforeTheSweep } from './fixtures/sweep-harness.ts';

// SO-09 of the self on-boarding plan: the daily tick of the tenant sweeps writes one fleet summary line to the system
// log of the control plane, so that the Axiom monitors of SO-11 can read it: the count and the cost of each state and
// plan (plan section 8), the memberships with only the default role, which WorkOS bills as seats (plan section 7), the
// restarts outside a deploy, and the memory values of the live tenants. The sweeps run as app composes them, against
// the WorkOS fake, the fake of the Render API, and a fake of the tenant registry, on a Tuesday: no organization sweep.

const at = '2026-11-03T04:00:00.000Z';
const mib = 1_048_576;

function summaryOf(harness: SweepHarness): Record<string, unknown> {
  const lines = harness.linesWith('Tenant fleet summary: ');
  assert.equal(lines.length, 1, `One summary line: ${harness.log.lines.join(' | ')}`);
  const [line] = lines;
  assert.ok(line?.startsWith('INFO Tenant fleet summary: {'));
  return JSON.parse(line.slice('INFO Tenant fleet summary: '.length)) as Record<string, unknown>;
}

test('Given a fleet in several states and plans, when the daily summary runs, then the line gives the count and the monthly cost of each state and plan, and the totals', async (t) => {
  const harness = await SweepHarness.start(t, [organizationA, organizationB]);
  harness.liveTenant(organizationA);
  harness.liveTenant(organizationB);
  harness.store.put({ organizationId: 'org_01JTEAM', state: 'live', serviceName: 'thermus-tenant-org-01jteam', plan: '1c-2g', appliedPlan: '1c-2g' });
  harness.store.put({ organizationId: 'org_01JPAUSED', state: 'suspended', serviceName: 'thermus-tenant-org-01jpaused', plan: '0.5c-512mb' });
  harness.store.put({ organizationId: 'org_01JNEW', state: 'requested' });
  harness.store.put({ organizationId: 'org_01JBROKEN', state: 'failed', plan: '0.5c-512mb', failureReason: 'The deploy ended as update_failed' });
  harness.store.put({ organizationId: 'org_01JGONE', state: 'deleted', plan: '0.5c-512mb' });

  await harness.runOneTick(tuesdayBeforeTheSweep);

  const summary = summaryOf(harness);
  assert.equal(summary.at, at);
  assert.equal(summary.windowHours, 24);
  assert.equal(summary.tenants, 6, 'Every row except the deleted one');
  assert.equal(summary.monthlyUsd, 39, 'Two live free tenants at 7 USD and one team tenant at 25 USD; the others cost nothing');
  assert.deepEqual(summary.byState, [
    { state: 'requested', plan: null, count: 1, monthlyUsd: 0 },
    { state: 'live', plan: '0.5c-512mb', count: 2, monthlyUsd: 14 },
    { state: 'live', plan: '1c-2g', count: 1, monthlyUsd: 25 },
    { state: 'suspended', plan: '0.5c-512mb', count: 1, monthlyUsd: 0 },
    { state: 'failed', plan: '0.5c-512mb', count: 1, monthlyUsd: 0 },
  ]);
});

test('Given a membership with only the default role, when the daily summary runs, then the line gives it, because WorkOS bills it as a seat without product access', async (t) => {
  const harness = await SweepHarness.start(t, [organizationA, organizationB]);
  harness.liveTenant(organizationA);
  harness.workos.users = [
    { id: 'user_01ADMIN', email: 'admin@example.com', firstName: 'Ada' },
    { id: 'user_01MEMBER', email: 'member@example.com', firstName: 'Max' },
  ];
  harness.workos.memberships = [
    { userId: 'user_01ADMIN', organizationId: organizationA, roles: ['admin'] },
    { userId: 'user_01MEMBER', organizationId: organizationA, roles: [] },
    { userId: 'user_01MEMBER', organizationId: organizationB, roles: ['user'] },
    { userId: 'user_01ADMIN', organizationId: organizationB, roles: [], status: 'inactive' },
  ];

  await harness.runOneTick(tuesdayBeforeTheSweep);

  const summary = summaryOf(harness);
  assert.equal(summary.defaultRoleMemberships, 1, 'The inactive membership bills no seat');
  assert.deepEqual(summary.defaultRoleMembershipList, [{ organizationId: organizationA, membershipId: harness.workos.membershipId({ id: 'user_01MEMBER', email: 'member@example.com', firstName: 'Max' }, organizationA) }]);
  assert.doesNotMatch(JSON.stringify(summary), /example\.com|user_01/, 'The line names no person');
});

test('Given live tenants with memory points and a restart outside a deploy, when the daily summary runs, then the line gives the restarts and the memory peak and limit of each live tenant', async (t) => {
  const harness = await SweepHarness.start(t, [organizationA, organizationB]);
  const busy = harness.liveTenant(organizationA);
  const quiet = harness.liveTenant(organizationB);
  busy.memoryLimitBytes = 512 * mib;
  busy.memory.push({ at: '2026-11-02T10:00:00Z', bytes: 120 * mib }, { at: '2026-11-02T22:00:00Z', bytes: 410 * mib }, { at: '2026-11-01T22:00:00Z', bytes: 500 * mib });
  quiet.memoryLimitBytes = 512 * mib;
  quiet.memory.push({ at: '2026-11-03T03:00:00Z', bytes: 64 * mib });
  busy.events.push(
    { type: 'server_failed', at: '2026-11-02T22:01:00Z' },
    { type: 'deploy_started', at: '2026-11-02T12:00:00Z' },
    { type: 'deploy_ended', at: '2026-11-02T12:01:00Z' },
    { type: 'server_failed', at: '2026-11-01T12:00:00Z' },
  );

  await harness.runOneTick(tuesdayBeforeTheSweep);

  const summary = summaryOf(harness);
  assert.equal(summary.restarts, 1, 'One restart in the 24 hours; the deploy and the older failure do not count');
  assert.deepEqual(summary.restartList, [{ organizationId: organizationA, serviceId: busy.id, restarts: 1 }]);
  assert.equal(summary.highestMemoryShare, 0.801, 'The memory point of the day before the window does not count');
  assert.deepEqual(summary.memory, [
    { organizationId: organizationA, serviceId: busy.id, peakBytes: 410 * mib, limitBytes: 512 * mib, peakShare: 0.801 },
    { organizationId: organizationB, serviceId: quiet.id, peakBytes: 64 * mib, limitBytes: 512 * mib, peakShare: 0.125 },
  ]);
  assert.deepEqual(summary.unavailable, []);
  const memoryReads = harness.render.requestsOf('memory metrics');
  assert.equal(memoryReads.length, 1, 'One memory read for all live tenants');
  assert.deepEqual(memoryReads[0]?.query.getAll('resource').toSorted(), [busy.id, quiet.id].toSorted());
});

test('Given a platform read that fails, when the daily summary runs, then the line still comes, with the counts, and names the part that is unavailable', async (t) => {
  const harness = await SweepHarness.start(t, [organizationA]);
  harness.liveTenant(organizationA);
  for (let attempt = 0; attempt < 3; attempt += 1) harness.render.failNext('memory metrics', { status: 503, body: { message: 'Service Unavailable' } });

  await harness.runOneTick(tuesdayBeforeTheSweep);

  const summary = summaryOf(harness);
  assert.equal(summary.tenants, 1);
  assert.equal(summary.highestMemoryShare, null);
  assert.deepEqual(summary.memory, []);
  assert.deepEqual(summary.unavailable, ['memory: Render answered 503: Service Unavailable']);
  assert.equal(harness.render.service(serviceNameOf(organizationA))?.id, harness.store.row(organizationA).serviceId);
});
