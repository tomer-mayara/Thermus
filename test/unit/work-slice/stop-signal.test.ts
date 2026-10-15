import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import { workSliceStopSignal } from '../../support/work-slice/stop-signal.ts';

function handlerCounts(signals: EventEmitter): number[] {
  return ['SIGINT', 'SIGTERM'].map((signal) => signals.listenerCount(signal));
}

test('Given the slice stop wait, when a signal arrives during startup, then the first stop request is kept and both handlers stay until cleanup completes', async () => {
  const signals = new EventEmitter();
  const stopped = workSliceStopSignal(signals);

  signals.emit('SIGINT', 'SIGINT');

  assert.equal(await stopped.received, 'SIGINT');
  assert.deepEqual(handlerCounts(signals), [1, 1]);
  stopped[Symbol.dispose]();
  assert.deepEqual(handlerCounts(signals), [0, 0]);
});

test('Given a slice that is stopping after SIGINT, when forwarded SIGINT and SIGTERM arrive during cleanup, then the stop request stays SIGINT and both handlers still protect cleanup', async () => {
  const signals = new EventEmitter();
  using stopped = workSliceStopSignal(signals);

  signals.emit('SIGINT', 'SIGINT');
  signals.emit('SIGINT', 'SIGINT');
  signals.emit('SIGTERM', 'SIGTERM');

  assert.equal(await stopped.received, 'SIGINT');
  assert.deepEqual(handlerCounts(signals), [1, 1]);
});

test('Given startup that fails without a stop signal, when the stop wait is disposed twice, then it removes only its own handlers and leaves no pending stop result', async () => {
  const signals = new EventEmitter();
  const otherHandler = () => {};
  signals.on('SIGINT', otherHandler);
  const stopped = workSliceStopSignal(signals);
  let received: NodeJS.Signals | undefined;
  void stopped.received.then((signal) => { received = signal; });

  stopped[Symbol.dispose]();
  stopped[Symbol.dispose]();
  signals.emit('SIGINT', 'SIGINT');
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(received, undefined);
  assert.deepEqual(handlerCounts(signals), [1, 0]);
  assert.deepEqual(signals.listeners('SIGINT'), [otherHandler]);
});
