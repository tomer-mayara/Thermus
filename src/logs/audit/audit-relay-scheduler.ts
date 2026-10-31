import { attemptRelay, type RelayItem, type RelayRoute } from './audit-relay-item.ts';
import type { RelayQueue } from './audit-relay-queue.ts';

/**
 * Runs the relays of a queue: the head of each tenant within the active bound of the audit collector, and again
 * after the backoff of a transient failure. An accepted relay, a final failure, and an expired event leave the queue.
 */
export class RelayScheduler {
  // The attempts that run now: at most the active bound. A relay that waits for its retry holds no place.
  private active = 0;
  private closed = false;
  private scheduled?: ReturnType<typeof setImmediate>;

  constructor(private readonly queue: RelayQueue, private readonly route: RelayRoute) {}

  /** One pump at a time, in a later turn: an admission never waits for a relay. */
  schedule(): void {
    if (this.closed || this.scheduled !== undefined) return;
    this.scheduled = setImmediate(() => { this.scheduled = undefined; this.pump(); });
  }

  /** Stops each later pump and drops each pending event. An active attempt aborts. */
  close(): void {
    this.closed = true;
    clearImmediate(this.scheduled);
    for (const item of this.queue.items()) this.dispose(item);
  }

  /** Ends a relay: its event and its timers go, and an active attempt aborts and leaves the queue when it settles. */
  dispose(item: RelayItem): void {
    release(item);
    if (!item.active && this.queue.remove(item)) this.schedule();
  }

  // A head waits while its retry timer runs; an expired head drops.
  private pump(): void {
    for (const item of this.queue.waitingHeads()) {
      if (this.route.clock.now() >= item.until) this.dispose(item);
      else if (item.retry === undefined && this.active < this.route.bounds.active) void this.attempt(item);
    }
  }

  private async attempt(item: RelayItem): Promise<void> {
    this.active++; item.active = true;
    const wait = await attemptRelay(item, this.route);
    this.active--; item.active = false;
    if (wait === undefined) this.dispose(item);
    else item.retry = setTimeout(() => { item.retry = undefined; this.schedule(); }, wait);
    this.schedule();
  }
}

function release(item: RelayItem): void {
  item.disposed = true; item.body = undefined;
  clearTimeout(item.deadline); clearTimeout(item.retry);
  item.controller?.abort();
}
