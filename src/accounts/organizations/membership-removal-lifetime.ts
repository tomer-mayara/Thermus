import type { RemovalResult } from './removal-operation-store.ts';

const TOTAL_BUDGET_MS = 30_000;

// The server owns this lifetime. The signal stops later read steps; it does not cancel an HTTP request already sent.
export class RemovalLifetime {
  private readonly deadline = performance.now() + TOTAL_BUDGET_MS;
  private readonly completion = Promise.withResolvers<RemovalResult>();
  private readonly reads = new AbortController();
  private readonly timer = setTimeout(() => this.stop(), TOTAL_BUDGET_MS);
  private stopped = false;
  private admissionStarted = false;

  run(work: () => Promise<RemovalResult>): Promise<RemovalResult> {
    void Promise.resolve().then(work).then(result => this.finish(result), () => this.stop());
    return this.completion.promise;
  }

  // Admission can commit without an answer. From this point, only a confirmed terminal receipt releases its hold.
  admitting(): void {
    this.check();
    this.admissionStarted = true;
  }

  async wait<T>(work: (signal: AbortSignal) => Promise<T>): Promise<T> {
    this.check();
    try {
      return await work(this.reads.signal);
    } finally {
      this.check();
    }
  }

  stop(): void {
    this.finish(this.admissionStarted ? 'unknown' : 'unavailable');
  }

  private check(): void {
    if (performance.now() >= this.deadline) this.stop();
    if (this.stopped) throw new Error('The membership removal lifetime has ended');
  }

  private finish(result: RemovalResult): void {
    if (this.stopped) return;
    this.stopped = true;
    clearTimeout(this.timer);
    this.reads.abort();
    const expired = performance.now() >= this.deadline;
    this.completion.resolve(expired ? (this.admissionStarted ? 'unknown' : 'unavailable') : result);
  }
}
