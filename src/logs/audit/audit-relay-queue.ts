import type { AuditCollectorBounds } from './audit-collector-state.ts';
import type { RelayItem } from './audit-relay-item.ts';

/**
 * The pending relays in the order of arrival for each tenant, within the item, byte, and tenant bounds of the audit
 * collector, in all and for each tenant. Only the head of a tenant runs, so the events of a tenant keep their order.
 * The bounds are small, so the totals are counted again at each admission.
 */
export class RelayQueue {
  // A tenant has an entry only while it has a pending item, so the size of the map counts the tenants of the bound.
  private readonly tenants = new Map<string, RelayItem[]>();

  constructor(private readonly bounds: AuditCollectorBounds) {}

  /** Adds the item when it fits each bound; else the item is lost. */
  add(item: RelayItem): boolean {
    const items = this.tenants.get(item.tenant) ?? [];
    if (!fitsBounds(this.bounds, { all: this.items(), items, tenants: this.tenants.size }, item)) return false;
    this.tenants.set(item.tenant, [...items, item]);
    return true;
  }

  waitingHeads(): RelayItem[] {
    return [...this.tenants.values()].flatMap((items) => items.slice(0, 1)).filter((head) => !head.active);
  }

  items(): RelayItem[] {
    return [...this.tenants.values()].flat();
  }

  /** Removes an item and frees its place. False when it was removed before. */
  remove(item: RelayItem): boolean {
    const items = this.tenants.get(item.tenant) ?? [];
    if (!items.includes(item)) return false;
    const rest = items.filter((pending) => pending !== item);
    if (rest.length === 0) this.tenants.delete(item.tenant);
    else this.tenants.set(item.tenant, rest);
    return true;
  }
}

interface Pending {
  readonly all: readonly RelayItem[];
  readonly items: readonly RelayItem[];
  readonly tenants: number;
}

// One more item must keep the items and the bytes within their bounds, in all and for its tenant. A new tenant needs a
// free tenant place too.
function fitsBounds(bounds: AuditCollectorBounds, pending: Pending, item: RelayItem): boolean {
  const { all, items, tenants } = pending;
  const fitsAll = all.length < bounds.items && bytesOf(all) + item.bytes <= bounds.bytes;
  const fitsTenant = items.length < bounds.tenantItems && bytesOf(items) + item.bytes <= bounds.tenantBytes;
  return fitsAll && fitsTenant && (items.length > 0 || tenants < bounds.tenants);
}

function bytesOf(items: readonly RelayItem[]): number {
  return items.reduce((total, item) => total + item.bytes, 0);
}
