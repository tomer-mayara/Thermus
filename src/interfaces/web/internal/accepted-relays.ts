// A context is valid at most 155 s after its signature: 2 minutes, the 30 s relay grace, and 5 s of clock tolerance.
// After 160 s, a repeat of an accepted relay cannot pass the context check, so the memory can forget it.
const MEMORY_MS = 160_000;
const MEMORY_SIZE = 16_384;

export type RelayAdmission = 'new' | 'repeated' | 'full';

/** The operation IDs of the accepted relays of each tenant, for as long as a repeat can still pass the context check. */
export class AcceptedRelays {
  private readonly now: () => number;
  private readonly until = new Map<string, number>();

  constructor(now: () => number) {
    this.now = now;
  }

  /** new: not accepted before, and now remembered. repeated: accepted before. full: no place to remember it. */
  admit(tenantId: string, operationId: string): RelayAdmission {
    const now = this.now();
    const key = `${tenantId}\u0000${operationId}`;
    if ((this.until.get(key) ?? 0) > now) return 'repeated';
    if (this.until.size >= MEMORY_SIZE) this.forgetBefore(now);
    if (this.until.size >= MEMORY_SIZE) return 'full';
    this.until.set(key, now + MEMORY_MS);
    return 'new';
  }

  private forgetBefore(now: number): void {
    for (const [key, until] of this.until) if (until <= now) this.until.delete(key);
  }
}
