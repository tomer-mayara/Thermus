import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FleetSummary, fleetSummaryStep } from '../../../src/tenancy/tenants/fleet-summary.ts';
import type { TenantState } from '../../../src/tenancy/tenants/tenant-registry-store.ts';
import { OperatorLogSpy } from '../../support/doubles/application/operator-log-spy.ts';
import { TenantFleetStoreFake } from '../../support/doubles/tenants/tenant-fleet-store-fake.ts';
import { OrganizationInventoryFake } from './fixtures/organization-inventory-fake.ts';
import { TenantPlatformFake } from './fixtures/tenant-platform-fake.ts';

// The fleet summary with the registry fake, a fake of the tenant platform, and a fake of the organization inventory:
// the count and the cost of each state and plan, the default-role memberships, the restarts outside a deploy, and the
// memory of the live tenants, for the 24 hours before the tick.

const signal = new AbortController().signal;
const at = Date.parse('2026-11-03T04:00:00Z');
const freePlan = '0.5c-512mb';

function summaryOf(rows: readonly [string, TenantState, string | null][]) {
  const store = new TenantFleetStoreFake();
  for (const [organizationId, state, plan] of rows) {
    const serviceId = state === 'requested' ? null : `srv-${organizationId.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    store.put({ organizationId, state, plan, serviceId, serviceName: `thermus-tenant-${organizationId.toLowerCase()}` });
  }
  const platform = new TenantPlatformFake();
  const inventory = new OrganizationInventoryFake();
  return { store, platform, inventory, summary: new FleetSummary({ store, platform, inventory, freePlan }) };
}

test('Given rows in each state and plan, when the summary is made, then it counts the rows that are not deleted, and the monthly cost of a running free tenant is 7 USD and of another plan 25 USD', async () => {
  const { summary } = summaryOf([
    ['org_A', 'live', freePlan], ['org_B', 'live', freePlan], ['org_C', 'live', '1c-2g'], ['org_D', 'suspended', freePlan],
    ['org_E', 'deploying', freePlan], ['org_F', 'creating', freePlan], ['org_G', 'requested', null], ['org_H', 'failed', freePlan], ['org_I', 'deleted', freePlan],
  ]);

  const record = await summary.record(at, signal);

  assert.equal(record?.at, '2026-11-03T04:00:00.000Z');
  assert.equal(record?.windowHours, 24);
  assert.equal(record?.tenants, 8);
  assert.equal(record?.monthlyUsd, 2 * 7 + 25 + 7 + 7);
  assert.deepEqual(record?.byState, [
    { state: 'requested', plan: null, count: 1, monthlyUsd: 0 },
    { state: 'creating', plan: freePlan, count: 1, monthlyUsd: 7 },
    { state: 'deploying', plan: freePlan, count: 1, monthlyUsd: 7 },
    { state: 'live', plan: freePlan, count: 2, monthlyUsd: 14 },
    { state: 'live', plan: '1c-2g', count: 1, monthlyUsd: 25 },
    { state: 'suspended', plan: freePlan, count: 1, monthlyUsd: 0 },
    { state: 'failed', plan: freePlan, count: 1, monthlyUsd: 0 },
  ]);
});

test('Given live tenants, when the summary is made, then one memory read names each live service and the restarts are read for each, both for the 24 hours before the tick', async () => {
  const { summary, platform } = summaryOf([['org_A', 'live', freePlan], ['org_B', 'live', freePlan], ['org_C', 'suspended', freePlan]]);
  platform.memoryReads.push({ status: 'found', services: new Map([['srv-orga', { peakBytes: 400_000_000, limitBytes: 536_870_912 }], ['srv-orgb', { peakBytes: 50_000_000 }]]) });
  platform.restartReads.push({ status: 'found', restarts: 2 }, { status: 'found', restarts: 0 });

  const record = await summary.record(at, signal);

  assert.deepEqual(platform.calls, ['memory srv-orga,srv-orgb', 'restarts srv-orga', 'restarts srv-orgb']);
  assert.ok(platform.windows.every((window) => window.startMs === at - 86_400_000 && window.endMs === at));
  assert.equal(record?.restarts, 2);
  assert.deepEqual(record?.restartList, [{ organizationId: 'org_A', serviceId: 'srv-orga', restarts: 2 }]);
  assert.equal(record?.highestMemoryShare, 0.745);
  assert.deepEqual(record?.memory, [
    { organizationId: 'org_A', serviceId: 'srv-orga', peakBytes: 400_000_000, limitBytes: 536_870_912, peakShare: 0.745 },
    { organizationId: 'org_B', serviceId: 'srv-orgb', peakBytes: 50_000_000, limitBytes: null, peakShare: null },
  ]);
  assert.deepEqual(record?.unavailable, []);
});

test('Given reads that fail, when the summary is made, then it gives what answered and names each read that did not', async () => {
  const { summary, platform, inventory } = summaryOf([['org_A', 'live', freePlan], ['org_B', 'live', freePlan]]);
  platform.memoryReads.push({ status: 'unavailable', reason: 'Render answered 503' });
  platform.restartReads.push({ status: 'unavailable', reason: 'Render answered 429' }, { status: 'found', restarts: 1 });
  inventory.membershipFailure = 'WorkOS answered 500: Internal Server Error';

  const record = await summary.record(at, signal);

  assert.equal(record?.highestMemoryShare, null);
  assert.deepEqual(record?.memory, []);
  assert.equal(record?.restarts, 1);
  assert.equal(record?.defaultRoleMemberships, null);
  assert.deepEqual(record?.unavailable, [
    'memory: Render answered 503',
    'restarts of srv-orga: Render answered 429',
    'default-role memberships: WorkOS answered 500: Internal Server Error',
  ]);
});

test('Given a live service that is gone, when the restarts are read, then the summary names it', async () => {
  const { summary, platform } = summaryOf([['org_A', 'live', freePlan]]);
  platform.restartReads.push({ status: 'gone' });
  assert.deepEqual((await summary.record(at, signal))?.unavailable, ['restarts of srv-orga: the tenant service no longer exists']);
});

test('Given no live tenant, when the summary is made, then no platform read goes', async () => {
  const { summary, platform } = summaryOf([['org_A', 'suspended', freePlan], ['org_B', 'requested', null]]);
  const record = await summary.record(at, signal);
  assert.deepEqual(platform.calls, []);
  assert.equal(record?.restarts, 0);
  assert.equal(record?.highestMemoryShare, null);
});

test('Given many default-role memberships, when the summary is made, then it counts each and lists the first 50', async () => {
  const { summary, inventory } = summaryOf([]);
  for (let index = 0; index < 60; index += 1) inventory.defaultRoles.push({ organizationId: 'org_A', membershipId: `om_${index}` });

  const record = await summary.record(at, signal);

  assert.equal(record?.defaultRoleMemberships, 60);
  assert.equal(record?.defaultRoleMembershipList.length, 50);
  assert.deepEqual(record?.defaultRoleMembershipList[0], { organizationId: 'org_A', membershipId: 'om_0' });
});

test('Given a registry that cannot be read, when the summary is made, then there is no record and no other read', async () => {
  const { summary, store, platform, inventory } = summaryOf([['org_A', 'live', freePlan]]);
  store.fleetUnavailable.add('read');
  assert.equal(await summary.record(at, signal), undefined);
  assert.deepEqual([platform.calls, inventory.calls], [[], []]);
});

test('Given the daily step, when it runs, then it writes the summary line each day, or one stop line without the registry', async () => {
  const { summary, store } = summaryOf([['org_A', 'suspended', freePlan]]);
  const log = new OperatorLogSpy();
  const step = fleetSummaryStep(summary, log);
  assert.equal(step.name, 'fleet summary');
  assert.ok([0, 1, 2, 3, 4, 5, 6].every((day) => step.runsAt(at + day * 86_400_000)));

  await step.run(at, signal);
  store.fleetUnavailable.add('read');
  await step.run(at, signal);

  assert.equal(log.lines.length, 2);
  assert.match(log.lines[0] ?? '', /^INFO Tenant fleet summary: \{"at":"2026-11-03T04:00:00\.000Z","windowHours":24,"tenants":1,"monthlyUsd":0,/);
  assert.equal(log.lines[1], `ERROR Tenant fleet summary stopped: ${JSON.stringify({ reason: 'The tenant registry cannot be read' })}`);
});
