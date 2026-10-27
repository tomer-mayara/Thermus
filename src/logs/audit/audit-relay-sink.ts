import type { AuditEvent, AuditEventSink } from './audit-log.ts';
import { collectorBounds, type AuditCollectorBounds } from './audit-collector-state.ts';
import { relayItemOf, type RelayClock, type RelayRoute } from './audit-relay-item.ts';
import { RelayQueue } from './audit-relay-queue.ts';
import { postAuditRelay } from './audit-relay-request.ts';
import { RelayScheduler } from './audit-relay-scheduler.ts';

export type { AuditRelay } from './audit-relay-request.ts';

export interface AuditRelayOptions extends Partial<RelayClock> {
  readonly bounds?: Partial<AuditCollectorBounds>;
}

/**
 * The audit sink of a tenant: it relays each event to the control plane, which exports it. The relay is bounded best
 * effort with the bounds of the audit collector, as today's capture: a refused, failed, slow, or excess relay loses
 * its event and never changes a tool result. Each event goes with the access context of the request that made it.
 */
export class AuditRelaySink {
  private readonly route: RelayRoute;
  private readonly queue: RelayQueue;
  private readonly scheduler: RelayScheduler;
  private closed = false;

  constructor(target: URL, options: AuditRelayOptions = {}) {
    const clock = { now: options.now ?? (() => performance.now()), random: options.random ?? Math.random, post: options.post ?? postAuditRelay };
    this.route = { target, clock, bounds: collectorBounds(options.bounds ?? {}) };
    this.queue = new RelayQueue(this.route.bounds);
    this.scheduler = new RelayScheduler(this.queue, this.route);
  }

  /** The sink of the events of one request. A tool server of that request writes its audit events here. */
  forContext(context: string): AuditEventSink {
    return { writeAuditEvent: (event) => this.admit(event, context) };
  }

  /** Stops admission, aborts each attempt, and drops each pending event. */
  close(): void {
    this.closed = true;
    this.scheduler.close();
  }

  private admit(event: AuditEvent, context: string): boolean {
    try {
      const item = this.closed ? undefined : relayItemOf(event, context, this.route);
      if (item === undefined || !this.queue.add(item)) return false;
      item.deadline = setTimeout(() => this.scheduler.dispose(item), this.route.bounds.ageMs);
      this.scheduler.schedule();
      return true;
    } catch {
      // Capture is best effort. An event that fails here is lost; the tool result stays.
      return false;
    }
  }
}
