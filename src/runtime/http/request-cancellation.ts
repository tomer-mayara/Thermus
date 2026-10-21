// Identity calls may have no cancellation API. Stop waiting, observe their eventual result, and never start the next
// request stage after cancellation. Tool operations keep their own cleanup ownership.
export function waitForRequest<T>(signal: AbortSignal, start: () => Promise<T>): Promise<T> {
  signal.throwIfAborted();
  return new Promise<T>((resolve, reject) => {
    const abort = (): void => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    const finish = (): void => signal.removeEventListener('abort', abort);
    try {
      void start().then(
        (value) => { finish(); resolve(value); },
        (error: unknown) => { finish(); reject(error); },
      );
    } catch (error) {
      finish();
      reject(error);
    }
  });
}
