import type { AuditEvent } from './audit-log.ts';
import { boundedCollectorText, type AuditCollectorBounds, type RetryBackoff } from './audit-collector-state.ts';
import type { AuditSendOutcome } from './audit-send.ts';
import type { AuditRelay } from './audit-relay-request.ts';

// One relay attempt. Its outcome is never an exception.
type AuditRelayPost = (relay: AuditRelay, signal: AbortSignal) => Promise<AuditSendOutcome>;

export interface RelayClock {
  readonly now: () => number;
  readonly random: () => number;
  readonly post: AuditRelayPost;
}

export interface RelayRoute {
  readonly target: URL;
  readonly clock: RelayClock;
  readonly bounds: AuditCollectorBounds;
  readonly retries: RetryBackoff;
}

/** One pending relay of one event. Its event JSON stays until the relay ends or drops. */
export interface RelayItem {
  readonly tenant: string;
  readonly context: string;
  readonly bytes: number;
  readonly until: number;
  body?: string;
  attempts: number;
  disposed: boolean;
  active: boolean;
  controller?: AbortController;
  deadline?: ReturnType<typeof setTimeout>;
  retry?: ReturnType<typeof setTimeout>;
}

/**
 * The relay of an event with the access context of its request, or undefined for an event that the bounds refuse:
 * a missing context or tenant, or a tenant ID or an event above the bounds of the audit collector.
 */
export function relayItemOf(event: AuditEvent, context: string, route: RelayRoute): RelayItem | undefined {
  const tenant: unknown = event.organizationId;
  if (context === '' || !boundedCollectorText(tenant, 1_024)) return undefined;
  const body = JSON.stringify(event);
  const eventBytes = Buffer.byteLength(body);
  if (eventBytes > route.bounds.eventBytes) return undefined;
  const until = route.clock.now() + route.bounds.ageMs;
  return { tenant, context, body, bytes: eventBytes + Buffer.byteLength(context), until, attempts: 0, disposed: false, active: false };
}

/**
 * One attempt of a relay. It gives the wait before the next attempt, or undefined when the relay ends: it was
 * accepted, it failed for good or threw, it used its attempts, or the next attempt would come after its age.
 */
export async function attemptRelay(item: RelayItem, route: RelayRoute): Promise<number | undefined> {
  item.attempts++;
  item.controller = new AbortController();
  try {
    const outcome = await route.clock.post({ target: route.target, context: item.context, body: item.body ?? '' }, item.controller.signal);
    const delay = item.disposed ? undefined : route.retries.delayAfter(outcome, item.attempts);
    return delay === undefined || route.clock.now() + delay >= item.until ? undefined : delay;
  } catch {
    return undefined;
  }
}
