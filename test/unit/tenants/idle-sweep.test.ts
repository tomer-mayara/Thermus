import assert from 'node:assert/strict';
import { test } from 'node:test';
import { IdleSweep } from '../../../src/tenancy/tenants/idle-sweep.ts';
import type { TenantState } from '../../../src/tenancy/tenants/tenant-registry-store.ts';
import { OperatorLogSpy } from '../../support/doubles/application/operator-log-spy.ts';
import { TenantFleetStoreFake } from '../../support/doubles/tenants/tenant-fleet-store-fake.ts';
import { TenantPlatformFake } from './fixtures/tenant-platform-fake.ts';

// The daily idle sweep (SO-10) with a fake of the tenant platform, the registry fake, a tick of the wall clock, and a
// spy of the operator log: it suspends each live free tenant whose last MCP call, or its creation when it never served
// one, is FREE_TENANT_IDLE_DAYS or more before the tick, and then marks its row suspended on the service that it read.

const signal = new AbortController().signal;
const freePlan = '0.5c-512mb';
// The tick of Tuesday 3 November 2026 at 04:00 UTC; 14 days before it is 20 October 2026 at 04:00 UTC.
const tick = Date.parse('2026-11-03T04:00:00Z');
const fourteenDaysBefore = '2026-10-20T04:00:00.000Z';
const lessThanFourteenDaysBefore = '2026-10-20T04:00:00.001Z';

interface RowFacts {
  readonly state?: TenantState;
  readonly plan?: string | null;
  readonly lastActiveAt?: string | null;
  readonly createdAt?: string;
}

function sweepOf(rows: Readonly<Record<string, RowFacts>>, idleDays = 14) {
  const store = new TenantFleetStoreFake();
  for (const [organizationId, facts] of Object.entries(rows)) {
    const serviceId = `srv-${organizationId.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    store.put({
      organizationId, state: facts.state ?? 'live', serviceId, serviceName: `thermus-tenant-${organizationId.toLowerCase()}`, internalUrl: 'http://thermus-tenant-x:8080',
      plan: facts.plan === undefined ? freePlan : facts.plan, lastActiveAt: facts.lastActiveAt ?? null, ...(facts.createdAt === undefined ? {} : { createdAt: facts.createdAt }),
    });
  }
  const platform = new TenantPlatformFake();
  const log = new OperatorLogSpy();
  return { store, platform, log, sweep: new IdleSweep({ store, platform, freePlan, idleDays, log }) };
}

function tally(counts: Partial<Record<'idle' | 'suspended' | 'moved' | 'failed', number>>): string {
  return `INFO Idle sweep: ${JSON.stringify({ idle: 0, suspended: 0, moved: 0, failed: 0, ...counts })}`;
}

test('Given the tick of any day, when the sweeps ask, then the idle sweep runs, because it runs each day', () => {
  const { sweep } = sweepOf({});
  for (let day = 0; day < 7; day += 1) assert.equal(sweep.runsAt(tick + day * 86_400_000), true);
  assert.equal(sweep.name, 'idle sweep');
});

test('Given free tenants whose last call is 14 days before the tick or less than that, when the sweep runs, then only the one of 14 days is suspended, first on the platform and then in the registry', async () => {
  const { store, platform, log, sweep } = sweepOf({ org_A: { lastActiveAt: fourteenDaysBefore }, org_B: { lastActiveAt: lessThanFourteenDaysBefore } });
  const statesAtSuspend: unknown[] = [];
  platform.onCall = () => statesAtSuspend.push(store.stateOf('org_A'));

  await sweep.run(tick, signal);

  assert.deepEqual(platform.calls, ['suspend srv-orga']);
  assert.deepEqual(statesAtSuspend, ['live']);
  assert.deepEqual([store.stateOf('org_A'), store.stateOf('org_B')], ['suspended', 'live']);
  assert.deepEqual(log.lines, [
    `INFO Tenant suspension record: ${JSON.stringify({ organizationId: 'org_A', state: 'suspended', from: 'live', serviceId: 'srv-orga', serviceName: 'thermus-tenant-org_a', idleSince: fourteenDaysBefore, cause: 'idle' })}`,
    tally({ idle: 1, suspended: 1 }),
  ]);
});

test('Given free tenants that never served a call, when the sweep runs, then their creation counts: one created 14 days before the tick is suspended, and a newer one stays', async () => {
  const { store, platform, log, sweep } = sweepOf({ org_A: { createdAt: fourteenDaysBefore }, org_B: { createdAt: lessThanFourteenDaysBefore } });

  await sweep.run(tick, signal);

  assert.deepEqual(platform.calls, ['suspend srv-orga']);
  assert.deepEqual([store.stateOf('org_A'), store.stateOf('org_B')], ['suspended', 'live']);
  assert.match(log.lines[0] ?? '', new RegExp(`"idleSince":"${fourteenDaysBefore}"`));
});

test('Given an idle tenant of another plan than the free plan, or without a plan, when the sweep runs, then it stays live, because team tenants are never suspended', async () => {
  const { store, platform, log, sweep } = sweepOf({ org_TEAM: { plan: '1c-2g', lastActiveAt: fourteenDaysBefore }, org_NOPLAN: { plan: null } });

  await sweep.run(tick, signal);

  assert.deepEqual(platform.calls, []);
  assert.deepEqual([store.stateOf('org_TEAM'), store.stateOf('org_NOPLAN')], ['live', 'live']);
  assert.deepEqual(log.lines, [tally({})]);
});

test('Given idle free rows that are suspended, deploying, failed, or deleted, when the sweep runs, then none is suspended again', async () => {
  const { store, platform, sweep } = sweepOf({
    org_SUSPENDED: { state: 'suspended' }, org_DEPLOYING: { state: 'deploying' }, org_FAILED: { state: 'failed' }, org_DELETED: { state: 'deleted' },
  });

  await sweep.run(tick, signal);

  assert.deepEqual(platform.calls, []);
  assert.deepEqual(store.changes, []);
});

test('Given FREE_TENANT_IDLE_DAYS of 7, when the sweep runs, then a free tenant without a call for 7 days is suspended', async () => {
  const { store, platform, sweep } = sweepOf({ org_A: { lastActiveAt: '2026-10-27T04:00:00.000Z' }, org_B: { lastActiveAt: '2026-10-27T04:00:00.001Z' } }, 7);

  await sweep.run(tick, signal);

  assert.deepEqual(platform.calls, ['suspend srv-orga']);
  assert.deepEqual([store.stateOf('org_A'), store.stateOf('org_B')], ['suspended', 'live']);
});

for (const [label, change, reason] of [
  ['limits the calls', { status: 'rate-limited', retryAfterMs: 40_000 }, 'the platform limits the calls of the service for 40 s'],
  ['refuses', { status: 'refused', reason: 'Render answered 400: invalid service' }, 'Render answered 400: invalid service'],
  ['gives no clear answer', { status: 'unknown', reason: 'no answer: fetch failed' }, 'no answer: fetch failed'],
  ['no longer has the service', { status: 'gone' }, 'the tenant service no longer exists'],
] as const) {
  test(`Given a platform that ${label}, when the sweep suspends an idle tenant, then its row stays live and the operator gets one line with the reason, and the next tenant is still suspended`, async () => {
    const { store, platform, log, sweep } = sweepOf({ org_A: { lastActiveAt: fourteenDaysBefore }, org_B: { lastActiveAt: fourteenDaysBefore } });
    platform.changes.push(change);

    await sweep.run(tick, signal);

    assert.deepEqual(platform.calls, ['suspend srv-orga', 'suspend srv-orgb']);
    assert.deepEqual([store.stateOf('org_A'), store.stateOf('org_B')], ['live', 'suspended']);
    assert.deepEqual(log.lines.filter((line) => line.startsWith('ERROR ')), [
      `ERROR Tenant suspension failed: ${JSON.stringify({ organizationId: 'org_A', serviceId: 'srv-orga', reason: `The platform did not take the suspend: ${reason}` })}`,
    ]);
    assert.equal(log.lines.at(-1), tally({ idle: 2, suspended: 1, failed: 1 }));
  });
}

test('Given a row that another writer moves after the read, when the sweep marks it, then the row stays as the writer left it, and the line says so', async () => {
  const { store, platform, log, sweep } = sweepOf({ org_A: { lastActiveAt: fourteenDaysBefore } });
  store.beforeChange = (operation, organizationId) => { if (operation === 'suspended') store.row(organizationId).state = 'deleted'; };

  await sweep.run(tick, signal);

  assert.deepEqual(platform.calls, ['suspend srv-orga']);
  assert.equal(store.stateOf('org_A'), 'deleted');
  assert.deepEqual(log.lines, [
    'INFO The idle sweep leaves organization org_A: its row changed during the suspension.',
    tally({ idle: 1, moved: 1 }),
  ]);
});

test('Given a registry that does not take the suspended mark, when the platform took the suspend, then the operator gets one line that says so, and the next sweep suspends again', async () => {
  const { store, platform, log, sweep } = sweepOf({ org_A: { lastActiveAt: fourteenDaysBefore } });
  store.fleetUnavailable.add('suspended');

  await sweep.run(tick, signal);
  store.fleetUnavailable.delete('suspended');
  await sweep.run(tick + 86_400_000, signal);

  assert.deepEqual(platform.calls, ['suspend srv-orga', 'suspend srv-orga']);
  assert.equal(store.stateOf('org_A'), 'suspended');
  assert.deepEqual(log.lines.filter((line) => line.startsWith('ERROR ')), [
    `ERROR Tenant suspension failed: ${JSON.stringify({ organizationId: 'org_A', serviceId: 'srv-orga', reason: 'The platform suspended the tenant service srv-orga, but the tenant registry did not take the suspended state. The next sweep suspends it again.' })}`,
  ]);
});

test('Given a registry that cannot be read, when the sweep runs, then it suspends nothing and reports one stop', async () => {
  const { store, platform, log, sweep } = sweepOf({ org_A: { lastActiveAt: fourteenDaysBefore } });
  store.fleetUnavailable.add('idle');

  await sweep.run(tick, signal);

  assert.deepEqual(platform.calls, []);
  assert.deepEqual(log.lines, [`ERROR Idle sweep stopped: ${JSON.stringify({ reason: 'The tenant registry cannot be read' })}`]);
});

test('Given a stop of the control plane during the sweep, when the stop signal aborts, then the sweep suspends no further tenant and writes no count line', async () => {
  const { store, platform, log, sweep } = sweepOf({ org_A: { lastActiveAt: fourteenDaysBefore }, org_B: { lastActiveAt: fourteenDaysBefore } });
  const controller = new AbortController();
  platform.onCall = () => controller.abort();

  await assert.rejects(sweep.run(tick, controller.signal));

  assert.deepEqual(platform.calls, ['suspend srv-orga']);
  assert.deepEqual([store.stateOf('org_A'), store.stateOf('org_B')], ['live', 'live']);
  assert.deepEqual(log.lines, []);
});
