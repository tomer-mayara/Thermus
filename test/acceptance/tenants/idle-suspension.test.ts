import assert from 'node:assert/strict';
import { test } from 'node:test';
import { organizationA, organizationB, serviceNameOf, SweepHarness, tuesdayBeforeTheSweep, wednesdayBeforeTheSweep } from './fixtures/sweep-harness.ts';

// SO-10 of the self on-boarding plan: the daily idle sweep of the control plane suspends a free tenant that served no
// MCP call for FREE_TENANT_IDLE_DAYS (14 by default, decision D-6) through the Render API, and its row becomes
// suspended (plan section 4.2). A tenant that never served a call counts from its creation, and a team tenant is never
// suspended. The sweep runs as app composes the tenant sweeps from the control plane settings, against the fake of the
// Render API and a fake of the tenant registry, with a wall clock that gives one daily tick at the sweep hour.

// The tick of Tuesday 3 November 2026 is at 04:00 UTC, so its period of 14 days starts on 20 October 2026, 04:00 UTC.
const fifteenDaysBeforeTuesday = '2026-10-19T12:00:00.000Z';
const fourDaysBeforeTuesday = '2026-10-30T10:00:00.000Z';
const teamPlan = '1c-2g';
const limitedSuspend = { status: 429, headers: { 'Retry-After': '40', 'Ratelimit-Limit': '10', 'Ratelimit-Remaining': '0', 'Ratelimit-Reset': '40' }, body: { message: 'Too Many Requests' } };

test('Given a free tenant with no MCP call for 14 days, when the sweep runs, then Render suspends its service, and its row becomes suspended', async (t) => {
  const harness = await SweepHarness.start(t, [organizationA]);
  const service = harness.liveTenant(organizationA, { lastActiveAt: fifteenDaysBeforeTuesday });

  await harness.runOneTick(tuesdayBeforeTheSweep);

  assert.deepEqual(harness.render.requestsOf('suspend service').map((request) => request.path), [`/services/${service.id}/suspend`]);
  assert.equal(harness.render.service(serviceNameOf(organizationA))?.suspended, true);
  assert.equal(harness.store.stateOf(organizationA), 'suspended');
  assert.deepEqual(harness.linesWith(organizationA), [
    `INFO Tenant suspension record: ${JSON.stringify({ organizationId: organizationA, state: 'suspended', from: 'live', serviceId: service.id, serviceName: service.name, idleSince: fifteenDaysBeforeTuesday, cause: 'idle' })}`,
  ]);
  assert.deepEqual(harness.linesWith('Idle sweep:'), [`INFO Idle sweep: ${JSON.stringify({ idle: 1, suspended: 1, moved: 0, failed: 0 })}`]);
  assert.deepEqual(harness.errorLines(), []);
});

test('Given a free tenant that never served a call, when 14 days pass from its creation and the sweep runs, then Render suspends it', async (t) => {
  const harness = await SweepHarness.start(t, [organizationA]);
  // Created on 20 October 2026 at 05:00 UTC: 13 days and 23 hours before the tick of Tuesday, 14 days and 23 hours before that of Wednesday.
  harness.liveTenant(organizationA, { lastActiveAt: null, createdAt: '2026-10-20T05:00:00.000Z' });

  await harness.runOneTick(tuesdayBeforeTheSweep);
  const afterThirteenDays = { state: harness.store.stateOf(organizationA), suspends: harness.render.requestsOf('suspend service').length };
  await harness.runOneTick(wednesdayBeforeTheSweep);

  assert.deepEqual(afterThirteenDays, { state: 'live', suspends: 0 });
  assert.equal(harness.render.requestsOf('suspend service').length, 1);
  assert.equal(harness.render.service(serviceNameOf(organizationA))?.suspended, true);
  assert.equal(harness.store.stateOf(organizationA), 'suspended');
});

test('Given a free tenant with a call inside the period, when the sweep runs, then it stays live', async (t) => {
  const harness = await SweepHarness.start(t, [organizationA]);
  harness.liveTenant(organizationA, { lastActiveAt: fourDaysBeforeTuesday });

  await harness.runOneTick(tuesdayBeforeTheSweep);

  assert.deepEqual(harness.render.requestsOf('suspend service'), []);
  assert.equal(harness.render.service(serviceNameOf(organizationA))?.suspended, false);
  assert.equal(harness.store.stateOf(organizationA), 'live');
  assert.deepEqual(harness.linesWith('Idle sweep:'), [`INFO Idle sweep: ${JSON.stringify({ idle: 0, suspended: 0, moved: 0, failed: 0 })}`]);
});

test('Given a team tenant that is idle for the period, when the sweep runs, then it stays live', async (t) => {
  const harness = await SweepHarness.start(t, [organizationA, organizationB]);
  harness.liveTenant(organizationA, { plan: teamPlan, lastActiveAt: fifteenDaysBeforeTuesday });
  harness.liveTenant(organizationB, { plan: teamPlan, lastActiveAt: null });

  await harness.runOneTick(tuesdayBeforeTheSweep);

  assert.deepEqual(harness.render.requestsOf('suspend service'), []);
  assert.deepEqual([harness.store.stateOf(organizationA), harness.store.stateOf(organizationB)], ['live', 'live']);
});

test('Given a suspend that Render limits with 429, when the sweep runs, then the row stays live and the operator gets one line, and the sweep of the next day suspends the tenant', async (t) => {
  const harness = await SweepHarness.start(t, [organizationA]);
  const service = harness.liveTenant(organizationA, { lastActiveAt: fifteenDaysBeforeTuesday });
  harness.render.failNext('suspend service', limitedSuspend);

  await harness.runOneTick(tuesdayBeforeTheSweep);
  const afterLimit = { state: harness.store.stateOf(organizationA), errors: harness.errorLines() };
  await harness.runOneTick(wednesdayBeforeTheSweep);

  assert.equal(afterLimit.state, 'live');
  assert.deepEqual(afterLimit.errors, [
    `ERROR Tenant suspension failed: ${JSON.stringify({ organizationId: organizationA, serviceId: service.id, reason: 'The platform did not take the suspend: the platform limits the calls of the service for 40 s' })}`,
  ]);
  assert.equal(harness.render.requestsOf('suspend service').length, 2);
  assert.equal(harness.store.stateOf(organizationA), 'suspended');
});

// The SO-12 release rehearsal of 31 October 2026: the old instance of a deploy gets SIGTERM about 120 s after the new
// one is live. Its stop starts no new Render call, and the call in flight ends, so its mark reaches the registry.
test('Given two idle free tenants and the suspend of the first in flight, when the control plane stops, then the suspend ends and its row is suspended, and the second tenant gets no suspend call', async (t) => {
  const harness = await SweepHarness.start(t, [organizationA, organizationB]);
  harness.liveTenant(organizationA, { lastActiveAt: fifteenDaysBeforeTuesday });
  harness.liveTenant(organizationB, { lastActiveAt: fifteenDaysBeforeTuesday });
  const suspend = harness.render.hold('suspend service');
  const tick = harness.startOneTick(tuesdayBeforeTheSweep);
  await harness.until(() => harness.render.requestsOf('suspend service').length > 0, 'the first suspend call');

  const stopped = tick.close();
  suspend.release();
  await stopped;

  const [first] = harness.render.requestsOf('suspend service');
  const target = [organizationA, organizationB].find((organizationId) => first?.path === `/services/${harness.render.service(serviceNameOf(organizationId))?.id}/suspend`);
  assert.ok(target !== undefined);
  const other = target === organizationA ? organizationB : organizationA;
  assert.equal(harness.render.requestsOf('suspend service').length, 1, 'No suspend call after the stop');
  assert.equal(harness.render.service(serviceNameOf(target))?.suspended, true, 'The suspend in flight ended at Render');
  assert.deepEqual([harness.store.stateOf(target), harness.store.stateOf(other)], ['suspended', 'live'], 'Its row is suspended, and the other row stays live');
  assert.equal(harness.linesWith('Tenant suspension record:').length, 1);
  assert.deepEqual(harness.errorLines(), []);
});
