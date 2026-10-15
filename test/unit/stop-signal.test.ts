import '../support/processes/deny-network.ts';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import { stopSignal } from '../../src/index.ts';

// An EventEmitter has the once() and off() calls of the process signals, and process gives the signal name to the listener.
function handledSignals(signals: EventEmitter): string[] {
  return ['SIGINT', 'SIGTERM'].filter((signal) => signals.listenerCount(signal) > 0);
}

test('Given a double for the process signals, when the stop-signal wait gets SIGTERM, then it gives SIGTERM and removes both listeners', async () => {
  const signals = new EventEmitter();

  const waiting = stopSignal(signals);
  const registered = handledSignals(signals);
  signals.emit('SIGTERM', 'SIGTERM');
  const received = await waiting.received;

  assert.deepEqual(registered, ['SIGINT', 'SIGTERM']);
  assert.equal(received, 'SIGTERM');
  assert.deepEqual(handledSignals(signals), []);
});

test('Given a stop-signal wait that is disposed before any signal, when a signal comes later, then both listeners are gone and the wait gives nothing', async () => {
  const signals = new EventEmitter();
  let late: NodeJS.Signals | undefined;

  const waiting = stopSignal(signals);
  void waiting.received.then((signal) => { late = signal; });
  waiting[Symbol.dispose]();
  signals.emit('SIGINT', 'SIGINT');
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.deepEqual(handledSignals(signals), []);
  assert.equal(late, undefined);
});
