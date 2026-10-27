// A context is valid at most 155 s after its signature: 2 minutes, the 30 s relay grace, and 5 s of clock tolerance.
// After 160 s, a repeat of an accepted relay cannot pass the context check, so the memory can forget it.
const MEMORY_MS = 160_000;
const MEMORY_SIZE = 16_384;

export type RelayAdmission = 'new' | 'repeated' | 'full';

/** The operation IDs of the accepted relays of each tenant, for as long as a repeat can still pass the context check. */
export class AcceptedRelays {
  /** A monotonic clock in milliseconds; tests give a double. */
  private readonly now: () => number;
  /** For each tenant and operation ID, the time until which a repeat is dropped. */
  private readonly until = new Map<string, number>();

  constructor(now: () => number) {
    this.now = now;
  }

  /** new: not accepted before, and now remembered. repeated: accepted before. full: no place to remember it. */
  admit(tenantId: string, operationId: string): RelayAdmission {
    const now = this.now();
    const key = `${tenantId}\u0000${operationId}`;
    if ((this.until.get(key) ?? 0) > now) return 'repeated';
    if (!placeFor(this.until, now)) return 'full';
    this.until.set(key, now + MEMORY_MS);
    return 'new';
  }
}

// A full memory first forgets the operation IDs whose time ended; it is full when none ended.
function placeFor(until: Map<string, number>, now: number): boolean {
  if (until.size < MEMORY_SIZE) return true;
  for (const [key, time] of until) if (time <= now) until.delete(key);
  return until.size < MEMORY_SIZE;
}
