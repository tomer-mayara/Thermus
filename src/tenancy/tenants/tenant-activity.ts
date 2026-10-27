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
  private readonly now: () => number;
  private readonly lastWrites = new Map<string, number>();

  constructor(store: Pick<TenantGatewayStore, 'recordActive'>, now: () => number = () => performance.now()) {
    this.store = store;
    this.now = now;
  }

  recordActive(organizationId: string): void {
    const now = this.now();
    const lastWrite = this.lastWrites.get(organizationId);
    if (lastWrite !== undefined && now - lastWrite < WRITE_INTERVAL_MS) return;
    if (this.lastWrites.size >= CLEANUP_SIZE) this.forgetBefore(now - WRITE_INTERVAL_MS);
    this.lastWrites.set(organizationId, now);
    this.store.recordActive(organizationId).catch(() => undefined);
  }

  // An entry of more than a minute stops no write, so it can go.
  private forgetBefore(time: number): void {
    for (const [organizationId, lastWrite] of this.lastWrites) if (lastWrite <= time) this.lastWrites.delete(organizationId);
  }
}
