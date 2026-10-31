import assert from 'node:assert/strict';
import { test } from 'node:test';
import { finishImageDeploy, imageDigestOf, startImageDeploy, type StartedImageDeploy } from '../../../src/tenancy/tenants/fleet-image-deploy.ts';
import type { DeployRead, DeployStart } from '../../../src/tenancy/tenants/tenant-platform.ts';
import { VirtualClock } from '../../support/doubles/tenants/virtual-clock.ts';
import { deployOf, found } from './fixtures/platform-deploys.ts';
import { TenantPlatformFake } from './fixtures/tenant-platform-fake.ts';

// One upgrade deploy of the fleet script with the platform fake (manager decision of 31 October 2026): its start after
// a 201 answer with the deploy or a 202 answer without it, the wait for that deploy, and the digest that it may record.
// The registry records the digest only when the live deploy names the requested digest.

const signal = new AbortController().signal;
const requested = `sha256:${'a'.repeat(64)}`;
const other = `sha256:${'b'.repeat(64)}`;
const image = `ghcr.io/tomer-mayara/thermus-hosted@${requested}`;
const named: StartedImageDeploy = { kind: 'named', serviceId: 'srv-a', id: 'dep-new', before: 'dep-old', digest: requested };

function upgradeWith(reads: readonly DeployRead[], starts: readonly DeployStart[] = []) {
  const platform = new TenantPlatformFake();
  platform.deploys.push(...reads);
  platform.deployStarts.push(...starts);
  return { platform, parts: { platform, clock: new VirtualClock() } };
}

test('Given a 201 answer with the deploy, when the upgrade waits, then it follows that deploy until it is live, and a live deploy with the requested digest is recordable with a confirmed identity', async () => {
  const { platform, parts } = upgradeWith(
    [found('dep-old', 'live', other), found('dep-old', 'live', other), found('dep-new', 'pending'), found('dep-new', 'live', requested)],
    [{ status: 'started', deploy: { id: 'dep-new', progress: 'pending', status: 'created', imageDigest: requested } }],
  );

  assert.deepEqual(await startImageDeploy(platform, { serviceId: 'srv-a', image }, signal), { status: 'started', started: named });
  assert.deepEqual(await finishImageDeploy(parts, named, signal), { status: 'recordable', deploy: deployOf('dep-new', 'live', requested), identity: 'confirmed', seconds: 10 });

  assert.deepEqual(platform.calls, ['deploy srv-a', `deploy-image srv-a ${image}`, 'deploy srv-a', 'deploy srv-a', 'deploy srv-a']);
});

test('Given a 202 answer without the deploy, when the upgrade waits, then it takes the first deploy other than the one before the write, and its identity is unconfirmed', async () => {
  const { platform, parts } = upgradeWith([found('dep-old', 'live', other), found('dep-old', 'live', other), found('dep-queued', 'live', requested)], [{ status: 'started' }]);
  const unnamed: StartedImageDeploy = { kind: 'unnamed', serviceId: 'srv-a', before: 'dep-old', digest: requested };

  assert.deepEqual(await startImageDeploy(platform, { serviceId: 'srv-a', image }, signal), { status: 'started', started: unnamed });
  assert.deepEqual(await finishImageDeploy(parts, unnamed, signal), { status: 'recordable', deploy: deployOf('dep-queued', 'live', requested), identity: 'unconfirmed', seconds: 5 });
});

test('Given a newer deploy with another ID than the deploy of the 201 answer, when the upgrade waits, then that deploy superseded it, and the upgrade stops without a record', async () => {
  const { parts } = upgradeWith([found('dep-new', 'pending'), found('dep-other', 'live', requested)]);

  assert.deepEqual(await finishImageDeploy(parts, named, signal), {
    status: 'stopped', reason: 'did not reach live: the newer deploy dep-other superseded the deploy dep-new of this write',
  });
});

test('Given a live deploy that names no digest, when the upgrade checks it, then the digest is unconfirmed, the registry keeps its digest, and the upgrade stops', async () => {
  const { parts } = upgradeWith([found('dep-new', 'live')]);

  assert.deepEqual(await finishImageDeploy(parts, named, signal), {
    status: 'stopped', reason: 'dep-new live after 0 s, digest unconfirmed: the deploy names no digest; the registry keeps its digest',
  });
});

test('Given a live deploy that names another digest, when the upgrade checks it, then the reason names the digest that it runs, the registry keeps its digest, and the upgrade stops', async () => {
  const { parts } = upgradeWith([found('dep-new', 'pending'), found('dep-new', 'live', other)]);

  assert.deepEqual(await finishImageDeploy(parts, named, signal), {
    status: 'stopped', reason: 'dep-new live after 5 s with sha256:bbbbbbbbbbbb…, not sha256:aaaaaaaaaaaa…; the registry keeps its digest',
  });
});

test('Given a deploy that does not reach live, when the upgrade waits, then it stops with the reason of the wait', async () => {
  const { parts } = upgradeWith([{ status: 'gone' }]);
  assert.deepEqual(await finishImageDeploy(parts, named, signal), { status: 'stopped', reason: 'did not reach live: the tenant service no longer exists' });
});

test('Given a read before the write that fails, when the upgrade starts, then nothing is deployed, and the reason says why', async () => {
  const { platform } = upgradeWith([{ status: 'gone' }]);
  assert.deepEqual(await startImageDeploy(platform, { serviceId: 'srv-a', image }, signal), { status: 'not-started', reason: 'the tenant service no longer exists' });
  assert.deepEqual(platform.calls, ['deploy srv-a']);
});

test('Given a deploy call that the platform does not take, when the upgrade starts, then the reason follows the answer', async () => {
  const cases: readonly [DeployStart, string][] = [
    [{ status: 'rate-limited', retryAfterMs: 6_500 }, 'the platform limits the deploys of the service for 7 s'],
    [{ status: 'gone' }, 'the tenant service no longer exists'],
    [{ status: 'refused', reason: 'Render answered 409: a deploy is in progress' }, 'Render answered 409: a deploy is in progress'],
    [{ status: 'unknown', reason: 'no answer: fetch failed' }, 'the deploy call got no clear answer (no answer: fetch failed); a deploy can run, so read the status first'],
  ];
  for (const [start, reason] of cases) {
    const { platform } = upgradeWith([{ status: 'none' }], [start]);
    assert.deepEqual(await startImageDeploy(platform, { serviceId: 'srv-a', image }, signal), { status: 'not-started', reason });
  }
});

test('Given an image reference by digest, when its digest is read, then it is the part after the @', () => {
  assert.equal(imageDigestOf(image), requested);
});
