// stopSignal() of src/index.ts uses once. This wait uses on, because an outer launcher such as pnpm exec can forward
// the terminal signal again. Both handlers stay until the site closes and the logging flushes.
import type { StopSignal } from '../../../src/index.ts';

interface SliceSignals {
  on(signal: NodeJS.Signals, listener: NodeJS.SignalsListener): unknown;
  off(signal: NodeJS.Signals, listener: NodeJS.SignalsListener): unknown;
}

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
