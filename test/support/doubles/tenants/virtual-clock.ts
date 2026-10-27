// A fake (Meszaros) of the clock of the tenant provisioner and the Render adapter. A sleep moves the time on at
// once and records its length; then it yields one turn of the event loop, so that the other work of the test runs.
// A stop signal ends a sleep, as it ends a real sleep.
export class VirtualClock {
  readonly waits: number[] = [];
  #now = 0;

  readonly now = (): number => this.#now;

  readonly sleep = async (ms: number, signal: AbortSignal): Promise<void> => {
    signal.throwIfAborted();
    this.waits.push(ms);
    this.#now += ms;
    await new Promise((resolve) => setImmediate(resolve));
    signal.throwIfAborted();
  };
}
