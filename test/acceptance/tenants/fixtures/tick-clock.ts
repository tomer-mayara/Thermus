// A fake (Meszaros) of the wall clock of the tenant sweeps. The time starts at startMs. Each of the first `ticks` sleeps
// moves the time on at once, so the sweeps reach their next tick; the sleep after them waits until the stop signal
// ends it, and blocked tells the test that the ticks are over. So a test runs an exact number of ticks.
export class TickClock {
  blocked = false;
  #now: number;
  #ticksLeft: number;

  constructor(startMs: number, ticks: number) {
    this.#now = startMs;
    this.#ticksLeft = ticks;
  }

  readonly now = (): number => this.#now;

  readonly sleep = async (ms: number, signal: AbortSignal): Promise<void> => {
    signal.throwIfAborted();
    if (this.#ticksLeft === 0) {
      this.blocked = true;
      await new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
    }
    this.#ticksLeft -= 1;
    this.#now += ms;
    await new Promise((resolve) => setImmediate(resolve));
    signal.throwIfAborted();
  };
}
