import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newestDeployBefore, waitForStartedDeploy, type StartedDeploy } from '../../../src/tenancy/tenants/fleet-deploy-wait.ts';
import type { DeployRead } from '../../../src/tenancy/tenants/tenant-platform.ts';
import { VirtualClock } from '../../support/doubles/tenants/virtual-clock.ts';
import { deployOf, found } from './fixtures/platform-deploys.ts';
import { TenantPlatformFake } from './fixtures/tenant-platform-fake.ts';

// The wait of the fleet writes for the deploy that they started, which the upgrade and the resume of the fleet script
// share (manager decision of 31 October 2026): the deploy that the answer of the platform names, or, after an answer
// without a deploy, the first deploy other than the newest one before the write, whose identity stays unconfirmed.

const signal = new AbortController().signal;
const digest = `sha256:${'a'.repeat(64)}`;
const named: StartedDeploy = { kind: 'named', serviceId: 'srv-a', id: 'dep-new', before: 'dep-old' };

function waitWith(reads: readonly DeployRead[]) {
  const platform = new TenantPlatformFake();
  platform.deploys.push(...reads);
  const clock = new VirtualClock();
  return { platform, clock, parts: { platform, clock } };
}

test('Given a named deploy, when the wait reads the deploys, then the deploy from before the write is pending, and the named deploy is live with a confirmed identity', async () => {
  const { platform, clock, parts } = waitWith([found('dep-old', 'live', digest), found('dep-new', 'pending'), found('dep-new', 'live', digest)]);

  assert.deepEqual(await waitForStartedDeploy(parts, named, signal), { status: 'live', deploy: deployOf('dep-new', 'live', digest), identity: 'confirmed', seconds: 10 });

  assert.deepEqual(platform.calls, ['deploy srv-a', 'deploy srv-a', 'deploy srv-a']);
  assert.deepEqual(clock.waits, [5_000, 5_000]);
});

test('Given a newer deploy with another ID than the named deploy, when the wait reads it, then that deploy superseded the deploy of the write, and the wait stops', async () => {
  const { parts } = waitWith([found('dep-new', 'pending'), found('dep-other', 'live', digest)]);

  assert.deepEqual(await waitForStartedDeploy(parts, named, signal), { status: 'failed', reason: 'the newer deploy dep-other superseded the deploy dep-new of this write' });
});

test('Given a resume, whose answer names no deploy, when the wait reads the deploys, then the deploy from before the suspend does not count, and the first new deploy is live with an unconfirmed identity', async () => {
  const { parts } = waitWith([found('dep-old', 'live', digest), found('dep-resume', 'pending'), found('dep-resume', 'live', digest)]);

  assert.deepEqual(await waitForStartedDeploy(parts, { kind: 'unnamed', serviceId: 'srv-a', before: 'dep-old' }, signal), {
    status: 'live', deploy: deployOf('dep-resume', 'live', digest), identity: 'unconfirmed', seconds: 10,
  });
});

test('Given reads that fail or show no deploy, when the wait reads them, then it goes on until the deploy of the write ends', async () => {
  const { parts } = waitWith([{ status: 'unavailable', reason: 'Render answered 503' }, { status: 'none' }, found('dep-new', 'live', digest)]);

  assert.deepEqual(await waitForStartedDeploy(parts, { kind: 'named', serviceId: 'srv-a', id: 'dep-new', before: undefined }, signal), {
    status: 'live', deploy: deployOf('dep-new', 'live', digest), identity: 'confirmed', seconds: 10,
  });
});

test('Given a deploy of the write that fails, or a service that is gone, when the wait reads it, then it stops with the reason', async () => {
  const failed = waitWith([found('dep-new', 'failed')]);
  assert.deepEqual(await waitForStartedDeploy(failed.parts, named, signal), { status: 'failed', reason: 'the deploy dep-new ended as update_failed' });
  const gone = waitWith([{ status: 'gone' }]);
  assert.deepEqual(await waitForStartedDeploy(gone.parts, named, signal), { status: 'failed', reason: 'the tenant service no longer exists' });
});

test('Given a deploy of the write that never ends, when the wait reads it every 5 s, then it stops after 15 minutes with the last state that it saw', async () => {
  const { clock, parts } = waitWith(Array.from({ length: 180 }, () => found('dep-new', 'pending')));

  assert.deepEqual(await waitForStartedDeploy(parts, named, signal), {
    status: 'failed', reason: 'no deploy of this write reached live within 15 minutes; last seen: dep-new update_in_progress',
  });
  assert.equal(clock.waits.length, 179);
  assert.ok(clock.waits.every((wait) => wait === 5_000));
});

test('Given the newest deploy before a write, when it is read, then a found deploy gives its ID, no deploy gives none, and a failed read gives the reason', async () => {
  const cases: readonly [DeployRead, unknown][] = [
    [found('dep-old', 'live', digest), { status: 'read', id: 'dep-old' }],
    [{ status: 'none' }, { status: 'read', id: undefined }],
    [{ status: 'gone' }, { status: 'failed', reason: 'the tenant service no longer exists' }],
    [{ status: 'unavailable', reason: 'Render answered 503' }, { status: 'failed', reason: 'the deploy list is unavailable (Render answered 503)' }],
  ];
  for (const [read, before] of cases) {
    const { platform } = waitWith([read]);
    assert.deepEqual(await newestDeployBefore(platform, 'srv-a', signal), before);
  }
});
