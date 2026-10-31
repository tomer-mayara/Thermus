import type { TenantGatewayStore } from './tenant-gateway-store.ts';

// The answer of 27 October 2026: at most one write of last_active_at a minute for each organization.
const WRITE_INTERVAL_MS = 60_000;
// Above this many remembered organizations, each new write first forgets the entries of more than a minute.
const CLEANUP_SIZE = 1_024;

/**
 * The use of the tenants for the idle sweep. After each successful forward, the gateway records the organization;
 * the registry gets at most one write of last_active_at a minute for it. The time of the last write stays in memory
 * for a minute. The write does not delay the forward: a failed write is not repeated before the minute ends.
 */
export class TenantActivity {
  private readonly store: Pick<TenantGatewayStore, 'recordActive'>;
  /** A monotonic clock in milliseconds; tests give a double. */
  private readonly now: () => number;
  private readonly lastWrites = new Map<string, number>();

  constructor(store: Pick<TenantGatewayStore, 'recordActive'>, now: () => number = () => performance.now()) {
    this.store = store;
    this.now = now;
  }

  recordActive(organizationId: string): void {
    const now = this.now();
    if (!writeIsDue(this.lastWrites, organizationId, now)) return;
    this.lastWrites.set(organizationId, now);
    this.store.recordActive(organizationId).catch(() => undefined);
  }
}

// A write is due one minute after the last write. Before a new entry, a full memory forgets the entries of more than a
// minute: they stop no write.
function writeIsDue(lastWrites: Map<string, number>, organizationId: string, now: number): boolean {
  const lastWrite = lastWrites.get(organizationId);
  if (lastWrite !== undefined && now - lastWrite < WRITE_INTERVAL_MS) return false;
  if (lastWrites.size >= CLEANUP_SIZE) {
    for (const [organization, time] of lastWrites) if (time <= now - WRITE_INTERVAL_MS) lastWrites.delete(organization);
  }
  return true;
}
