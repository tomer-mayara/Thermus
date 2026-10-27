import type { AuditCollectorBounds } from './audit-collector-state.ts';
import type { RelayItem } from './audit-relay-item.ts';

/**
 * The pending relays in the order of arrival for each tenant, within the item, byte, and tenant bounds of the audit
 * collector, in all and for each tenant. Only the head of a tenant runs, so the events of a tenant keep their order.
 * The bounds are small, so the totals are counted again at each admission.
 */
export class RelayQueue {
  private readonly tenants = new Map<string, RelayItem[]>();

  constructor(private readonly bounds: AuditCollectorBounds) {}

  /** Adds the item when it fits each bound; else the item is lost. */
  add(item: RelayItem): boolean {
    const all = this.items();
    const items = this.tenants.get(item.tenant) ?? [];
    const fitsAll = all.length < this.bounds.items && bytesOf(all) + item.bytes <= this.bounds.bytes;
    const fitsTenant = items.length < this.bounds.tenantItems && bytesOf(items) + item.bytes <= this.bounds.tenantBytes;
    if (!fitsAll || !fitsTenant || (items.length === 0 && this.tenants.size >= this.bounds.tenants)) return false;
    this.tenants.set(item.tenant, [...items, item]);
    return true;
  }

  /** The head of each tenant whose head does not run. */
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

function bytesOf(items: readonly RelayItem[]): number {
  return items.reduce((total, item) => total + item.bytes, 0);
}
