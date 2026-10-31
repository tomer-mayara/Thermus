import assert from 'node:assert/strict';
import { test } from 'node:test';
import { IN_FLIGHT_GRACE_MS, startTenantLoop, type TenantLoopSignals } from '../../../src/app/tenant-loop.ts';

function aborted(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) resolve();
    else signal.addEventListener('abort', () => resolve(), { once: true });
  });
}

test('Given a running tenant loop, when it closes, then its stop signal aborts at once, its in-flight signal stays open while the loop ends, and the close waits for the end', async () => {
  const seen: { stopped: boolean; inFlightAtEnd?: boolean } = { stopped: false };
  const lifetime = startTenantLoop(async ({ stop, inFlight }: TenantLoopSignals) => {
    await aborted(stop);
    seen.stopped = true;
    // The call in flight ends after the stop and still gets its answer.
    await new Promise((resolve) => setTimeout(resolve, 20));
    seen.inFlightAtEnd = inFlight.aborted;
  });

  await lifetime.close();

  assert.deepEqual(seen, { stopped: true, inFlightAtEnd: false });
});

test('Given a call in flight that does not end, when the grace of the stop ends, then the in-flight signal aborts with the shutdown reason, and the close ends', async () => {
  const reasons: unknown[] = [];
  const lifetime = startTenantLoop(async ({ stop, inFlight }) => {
    await aborted(inFlight);
    reasons.push(stop.reason, inFlight.reason);
  }, 25);
  const started = performance.now();

  await lifetime.close();

  assert.ok(performance.now() - started >= 20, 'The close waited for the grace');
  assert.equal(reasons.length, 2);
  assert.ok(reasons.every((reason) => reason instanceof DOMException && reason.name === 'AbortError' && reason.message === 'The control plane is shutting down'));
});

test('Given a closing tenant loop, when it closes again, then the second close waits for the same end, and the grace of production is 3 s', async () => {
  let ends = 0;
  const lifetime = startTenantLoop(async ({ stop }) => {
    await aborted(stop);
    ends += 1;
  });

  const first = lifetime.close();
  const second = lifetime.close();
  await Promise.all([first, second]);

  assert.equal(first, second);
  assert.equal(ends, 1);
  assert.equal(IN_FLIGHT_GRACE_MS, 3_000);
});
