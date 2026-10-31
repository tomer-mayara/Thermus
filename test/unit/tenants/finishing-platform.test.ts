import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FinishingPlatform, type LoopPlatform } from '../../../src/tenancy/tenants/finishing-platform.ts';
import { TenantPlatformFake } from './fixtures/tenant-platform-fake.ts';

const window = { startMs: 0, endMs: 1 };
const request = { name: 'thermus-tenant-org-a', plan: '0.5c-512mb', environment: new Map<string, string>() };

// Each platform call of the tenant loops with its call record in the fake.
const operations: readonly [string, (platform: LoopPlatform, signal: AbortSignal) => Promise<unknown>][] = [
  ['find thermus-tenant-org-a', (platform, signal) => platform.findServices('thermus-tenant-org-a', signal)],
  ['create thermus-tenant-org-a', (platform, signal) => platform.createService(request, signal)],
  ['deploy srv-a', (platform, signal) => platform.newestDeploy('srv-a', signal)],
  ['address srv-a', (platform, signal) => platform.internalAddress('srv-a', signal)],
  ['delete srv-a', (platform, signal) => platform.deleteService('srv-a', signal)],
  ['suspend srv-a', (platform, signal) => platform.suspendService('srv-a', signal)],
  ['memory srv-a', (platform, signal) => platform.memoryUse(['srv-a'], window, signal)],
  ['restarts srv-a', (platform, signal) => platform.restartCount('srv-a', window, signal)],
];

test('Given a loop that stopped, when it starts a platform call, then each of the eight calls of the loops refuses with the stop reason before the platform gets it', async () => {
  const inner = new TenantPlatformFake();
  const platform = new FinishingPlatform(inner, new AbortController().signal);
  const stop = new AbortController();
  const reason = new DOMException('The control plane is shutting down', 'AbortError');
  stop.abort(reason);

  for (const [, call] of operations) await assert.rejects(call(platform, stop.signal), (error) => error === reason);

  assert.deepEqual(inner.calls, []);
});

test('Given a call that started before the stop, when the stop comes during the call, then the platform gets the in-flight signal instead of the stop signal, and each operation gives the answer of the platform', async () => {
  const inner = new TenantPlatformFake();
  const signals: AbortSignal[] = [];
  let stop = new AbortController();
  inner.onCall = () => { stop.abort(); };
  const inFlight = new AbortController();
  const platform = new FinishingPlatform(recordingSignals(inner, signals), inFlight.signal);

  const answers: unknown[] = [];
  for (const [, call] of operations) {
    stop = new AbortController();
    answers.push(await call(platform, stop.signal));
  }

  assert.deepEqual(inner.calls, operations.map(([name]) => name));
  assert.equal(signals.length, operations.length);
  assert.ok(signals.every((signal) => signal === inFlight.signal), 'Each call runs with the in-flight signal');
  assert.equal((answers[1] as { readonly status: string }).status, 'created');
});

test('Given a call in flight, when the in-flight signal aborts at the end of the grace, then the call sees the abort', async () => {
  const seen: AbortSignal[] = [];
  const held = Promise.withResolvers<never>();
  const inner = { createService: (_request: unknown, signal: AbortSignal) => {
    seen.push(signal);
    signal.addEventListener('abort', () => held.reject(signal.reason), { once: true });
    return held.promise;
  } } as unknown as LoopPlatform;
  const inFlight = new AbortController();
  const platform = new FinishingPlatform(inner, inFlight.signal);

  const call = platform.createService(request, new AbortController().signal);
  inFlight.abort(new DOMException('The grace of the stop ended', 'AbortError'));

  await assert.rejects(call, /The grace of the stop ended/);
  assert.deepEqual(seen, [inFlight.signal]);
});

// The fake with each signal that its operations get.
function recordingSignals(inner: TenantPlatformFake, signals: AbortSignal[]): LoopPlatform {
  const record = <A extends unknown[], R>(operation: (...args: A) => Promise<R>) => (...args: A): Promise<R> => {
    signals.push(args.at(-1) as AbortSignal);
    return operation.apply(inner, args);
  };
  return {
    findServices: record(inner.findServices), createService: record(inner.createService), newestDeploy: record(inner.newestDeploy),
    internalAddress: record(inner.internalAddress), deleteService: record(inner.deleteService), suspendService: record(inner.suspendService),
    memoryUse: record(inner.memoryUse), restartCount: record(inner.restartCount),
  };
}
