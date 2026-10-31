import assert from 'node:assert/strict';
import { test } from 'node:test';
import { finishImageDeploy, newestDeployBefore, startImageDeploy, waitForStartedDeploy, type StartedImageDeploy } from '../../../src/tenancy/tenants/fleet-deploy-wait.ts';
import type { DeployRead, DeployStart, PlatformDeploy } from '../../../src/tenancy/tenants/tenant-platform.ts';
import { VirtualClock } from '../../support/doubles/tenants/virtual-clock.ts';
import { TenantPlatformFake } from './fixtures/tenant-platform-fake.ts';

// The wait of the fleet writes for the deploy that they started, which the upgrade and the resume of the fleet script
// share (manager decision of 31 October 2026): the deploy that the answer of the platform names, or, after an answer
// without a deploy, the first deploy other than the newest one before the write, whose identity stays unconfirmed. An
// upgrade records its digest only when the live deploy names the requested digest.

const signal = new AbortController().signal;
const requested = `sha256:${'a'.repeat(64)}`;
const other = `sha256:${'b'.repeat(64)}`;
const image = `ghcr.io/tomer-mayara/thermus-hosted@${requested}`;
const named: StartedImageDeploy = { kind: 'named', serviceId: 'srv-a', id: 'dep-new', before: 'dep-old', digest: requested };

function deployOf(id: string, progress: PlatformDeploy['progress'], imageDigest?: string): PlatformDeploy {
  const status = { live: 'live', failed: 'update_failed', pending: 'update_in_progress' }[progress];
  return { id, progress, status, ...(imageDigest === undefined ? {} : { imageDigest }) };
}

function found(id: string, progress: PlatformDeploy['progress'], imageDigest?: string): DeployRead {
  return { status: 'found', deploy: deployOf(id, progress, imageDigest) };
}

function fleetWith(reads: readonly DeployRead[], starts: readonly DeployStart[] = []) {
  const platform = new TenantPlatformFake();
  platform.deploys.push(...reads);
  platform.deployStarts.push(...starts);
  const clock = new VirtualClock();
  return { platform, clock, parts: { platform, clock } };
}

test('Given a 201 answer with the deploy, when the upgrade waits, then it follows that deploy until it is live, and a live deploy with the requested digest is recordable with a confirmed identity', async () => {
  const { platform, clock, parts } = fleetWith(
    [found('dep-old', 'live', other), found('dep-old', 'live', other), found('dep-new', 'pending'), found('dep-new', 'live', requested)],
    [{ status: 'started', deploy: { id: 'dep-new', progress: 'pending', status: 'created', imageDigest: requested } }],
  );

  assert.deepEqual(await startImageDeploy(platform, { serviceId: 'srv-a', image }, signal), { status: 'started', started: named });
  assert.deepEqual(await finishImageDeploy(parts, named, signal), { status: 'recordable', deploy: deployOf('dep-new', 'live', requested), identity: 'confirmed', seconds: 10 });

  assert.deepEqual(platform.calls, ['deploy srv-a', `deploy-image srv-a ${image}`, 'deploy srv-a', 'deploy srv-a', 'deploy srv-a']);
  assert.deepEqual(clock.waits, [5_000, 5_000]);
});

test('Given a 202 answer without the deploy, when the upgrade waits, then it takes the first deploy other than the one before the write, and its identity is unconfirmed', async () => {
  const { platform, parts } = fleetWith([found('dep-old', 'live', other), found('dep-old', 'live', other), found('dep-queued', 'live', requested)], [{ status: 'started' }]);
  const unnamed: StartedImageDeploy = { kind: 'unnamed', serviceId: 'srv-a', before: 'dep-old', digest: requested };

  assert.deepEqual(await startImageDeploy(platform, { serviceId: 'srv-a', image }, signal), { status: 'started', started: unnamed });
  assert.deepEqual(await finishImageDeploy(parts, unnamed, signal), { status: 'recordable', deploy: deployOf('dep-queued', 'live', requested), identity: 'unconfirmed', seconds: 5 });
});

test('Given a newer deploy with another ID than the deploy of the 201 answer, when the upgrade waits, then that deploy superseded it, and the upgrade stops without a record', async () => {
  const { parts } = fleetWith([found('dep-new', 'pending'), found('dep-other', 'live', requested)]);

  assert.deepEqual(await finishImageDeploy(parts, named, signal), {
    status: 'stopped', reason: 'did not reach live: the newer deploy dep-other superseded the deploy dep-new of this write',
  });
});

test('Given a live deploy that names no digest, when the upgrade checks it, then the digest is unconfirmed, the registry keeps its digest, and the upgrade stops', async () => {
  const { parts } = fleetWith([found('dep-new', 'live')]);

  assert.deepEqual(await finishImageDeploy(parts, named, signal), {
    status: 'stopped', reason: 'dep-new live after 0 s, digest unconfirmed: the deploy names no digest; the registry keeps its digest',
  });
});

test('Given a live deploy that names another digest, when the upgrade checks it, then the reason names the digest that it runs, the registry keeps its digest, and the upgrade stops', async () => {
  const { parts } = fleetWith([found('dep-new', 'pending'), found('dep-new', 'live', other)]);

  assert.deepEqual(await finishImageDeploy(parts, named, signal), {
    status: 'stopped', reason: 'dep-new live after 5 s with sha256:bbbbbbbbbbbb…, not sha256:aaaaaaaaaaaa…; the registry keeps its digest',
  });
});

test('Given a resume, whose answer names no deploy, when the wait reads the deploys, then the deploy from before the suspend does not count, and the first new deploy is live with an unconfirmed identity', async () => {
  const { parts } = fleetWith([found('dep-old', 'live', other), found('dep-resume', 'pending'), found('dep-resume', 'live', other)]);

  assert.deepEqual(await waitForStartedDeploy(parts, { kind: 'unnamed', serviceId: 'srv-a', before: 'dep-old' }, signal), {
    status: 'live', deploy: deployOf('dep-resume', 'live', other), identity: 'unconfirmed', seconds: 10,
  });
});

test('Given reads that fail or show no deploy, when the wait reads them, then it goes on until the deploy of the write ends', async () => {
  const { parts } = fleetWith([{ status: 'unavailable', reason: 'Render answered 503' }, { status: 'none' }, found('dep-new', 'live', requested)]);

  assert.deepEqual(await waitForStartedDeploy(parts, { kind: 'named', serviceId: 'srv-a', id: 'dep-new', before: undefined }, signal), {
    status: 'live', deploy: deployOf('dep-new', 'live', requested), identity: 'confirmed', seconds: 10,
  });
});

test('Given a deploy of the write that fails, or a service that is gone, when the wait reads it, then it stops with the reason', async () => {
  const failed = fleetWith([found('dep-new', 'failed')]);
  assert.deepEqual(await waitForStartedDeploy(failed.parts, named, signal), { status: 'failed', reason: 'the deploy dep-new ended as update_failed' });
  const gone = fleetWith([{ status: 'gone' }]);
  assert.deepEqual(await finishImageDeploy(gone.parts, named, signal), { status: 'stopped', reason: 'did not reach live: the tenant service no longer exists' });
});

test('Given a deploy of the write that never ends, when the wait reads it every 5 s, then it stops after 15 minutes with the last state that it saw', async () => {
  const { clock, parts } = fleetWith(Array.from({ length: 180 }, () => found('dep-new', 'pending')));

  assert.deepEqual(await waitForStartedDeploy(parts, named, signal), {
    status: 'failed', reason: 'no deploy of this write reached live within 15 minutes; last seen: dep-new update_in_progress',
  });
  assert.equal(clock.waits.length, 179);
  assert.ok(clock.waits.every((wait) => wait === 5_000));
});

test('Given a read before the write that fails, when the upgrade starts, then nothing is deployed, and the reason says why', async () => {
  for (const [read, reason] of [[{ status: 'gone' }, 'the tenant service no longer exists'], [{ status: 'unavailable', reason: 'Render answered 503' }, 'the deploy list is unavailable (Render answered 503)']] as const) {
    const { platform } = fleetWith([read]);
    assert.deepEqual(await startImageDeploy(platform, { serviceId: 'srv-a', image }, signal), { status: 'not-started', reason });
    assert.deepEqual(platform.calls, ['deploy srv-a']);
  }
});

test('Given a deploy call that the platform does not take, when the upgrade starts, then the reason follows the answer', async () => {
  const cases: readonly [DeployStart, string][] = [
    [{ status: 'rate-limited', retryAfterMs: 6_500 }, 'the platform limits the deploys of the service for 7 s'],
    [{ status: 'gone' }, 'the tenant service no longer exists'],
    [{ status: 'refused', reason: 'Render answered 409: a deploy is in progress' }, 'Render answered 409: a deploy is in progress'],
    [{ status: 'unknown', reason: 'no answer: fetch failed' }, 'the deploy call got no clear answer (no answer: fetch failed); a deploy can run, so read the status first'],
  ];
  for (const [start, reason] of cases) {
    const { platform } = fleetWith([{ status: 'none' }], [start]);
    assert.deepEqual(await startImageDeploy(platform, { serviceId: 'srv-a', image }, signal), { status: 'not-started', reason });
  }
});

test('Given a service without a deploy, when the newest deploy before a write is read, then it has no ID, and the next found deploy is new', async () => {
  const { platform } = fleetWith([{ status: 'none' }]);
  assert.deepEqual(await newestDeployBefore(platform, 'srv-a', signal), { status: 'read', id: undefined });
});
