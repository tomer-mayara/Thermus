// A fake (Meszaros) of the clock of the tenant provisioner and the Render adapter. A sleep moves the time on at
// once and records its length; then it yields to the other work of the test: one turn of the event loop, or
// realDelayMs of real time for work with real input and output, such as a database. A stop signal ends a sleep, as it
// ends a real sleep.
export class VirtualClock {
  readonly waits: number[] = [];
  readonly #realDelayMs: number;
  #now = 0;

  constructor(realDelayMs = 0) {
    this.#realDelayMs = realDelayMs;
  }

  readonly now = (): number => this.#now;

  readonly sleep = async (ms: number, signal: AbortSignal): Promise<void> => {
    signal.throwIfAborted();
    this.waits.push(ms);
    this.#now += ms;
    await new Promise((resolve) => (this.#realDelayMs === 0 ? setImmediate(resolve) : setTimeout(resolve, this.#realDelayMs)));
    signal.throwIfAborted();
  };
}
