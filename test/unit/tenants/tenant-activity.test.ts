import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { TenantActivity } from '../../../src/tenancy/tenants/tenant-activity.ts';
import type { GatewayWrite } from '../../../src/tenancy/tenants/tenant-gateway-store.ts';

function activityOf(answer: (organizationId: string) => Promise<GatewayWrite> = async () => ({ status: 'recorded' })) {
  let now = 1_000;
  const writes: string[] = [];
  const store = { recordActive: (organizationId: string) => { writes.push(organizationId); return answer(organizationId); } };
  return { activity: new TenantActivity(store, () => now), writes, advance: (ms: number) => { now += ms; } };
}

test('Given repeated uses of one tenant within a minute, when they are recorded, then last_active_at gets one write, and a use one minute after that write gets the next', () => {
  const { activity, writes, advance } = activityOf();

  activity.recordActive('org_A');
  advance(20_000);
  activity.recordActive('org_A');
  advance(39_999);
  activity.recordActive('org_A');
  const withinMinute = [...writes];
  advance(1);
  activity.recordActive('org_A');

  assert.deepEqual(withinMinute, ['org_A']);
  assert.deepEqual(writes, ['org_A', 'org_A']);
});

test('Given uses of two tenants, when they are recorded in the same minute, then each organization gets its own write', () => {
  const { activity, writes } = activityOf();

  for (const organizationId of ['org_A', 'org_B', 'org_A', 'org_B']) activity.recordActive(organizationId);

  assert.deepEqual(writes, ['org_A', 'org_B']);
});

test('Given a write that fails or rejects, when the use is recorded, then the caller sees no failure and the next write comes one minute later', async () => {
  const { activity, writes, advance } = activityOf(async (organizationId) => {
    if (organizationId === 'org_REJECTS') throw new Error('The pool is closed');
    return { status: 'unavailable' };
  });

  activity.recordActive('org_A');
  activity.recordActive('org_REJECTS');
  await setImmediate();
  activity.recordActive('org_A');
  advance(60_000);
  activity.recordActive('org_A');

  assert.deepEqual(writes, ['org_A', 'org_REJECTS', 'org_A']);
});

test('Given more recent organizations than the memory keeps without a cleanup, when an old entry is a minute old, then it is forgotten and a recent organization still waits for its minute', () => {
  const { activity, writes, advance } = activityOf();
  for (let index = 0; index < 1_024; index += 1) activity.recordActive(`org_OLD_${index}`);
  advance(60_000);
  activity.recordActive('org_RECENT');
  advance(1_000);
  writes.length = 0;

  activity.recordActive('org_RECENT');
  activity.recordActive('org_OLD_0');

  assert.deepEqual(writes, ['org_OLD_0']);
});
