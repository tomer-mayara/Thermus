import type { StopSignal } from '../../../src/index.ts';

interface SliceSignals {
  on(signal: NodeJS.Signals, listener: NodeJS.SignalsListener): unknown;
  off(signal: NodeJS.Signals, listener: NodeJS.SignalsListener): unknown;
}

// An outer launcher can forward a terminal signal again. Keep both handlers until the site closes and logging flushes.
export function workSliceStopSignal(signals: SliceSignals): StopSignal {
  const received = Promise.withResolvers<NodeJS.Signals>();
  const stop: NodeJS.SignalsListener = (signal) => { received.resolve(signal); };
  signals.on('SIGINT', stop);
  signals.on('SIGTERM', stop);
  return {
    received: received.promise,
    [Symbol.dispose]: () => {
      signals.off('SIGINT', stop);
      signals.off('SIGTERM', stop);
    },
  };
}
