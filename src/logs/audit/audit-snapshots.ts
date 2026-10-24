import type { AuditEvent, AuditEventSink } from './audit-log.ts';
import type { DestinationSettingsStore } from './destination-settings-store.ts';
import { boundedSnapshotText, detachedAuditEvent, snapshotBounds, snapshotFrom } from './audit-snapshot-state.ts';
import type { AuditSnapshotBounds, SnapshotLoad, SnapshotResident } from './audit-snapshot-state.ts';

export type { AuditSnapshotBounds } from './audit-snapshot-state.ts';

export interface RevisionBoundAuditEvent { readonly destinationRevision: string; readonly event: AuditEvent }
export interface RevisionBoundAuditSink { admit(item: RevisionBoundAuditEvent): void | boolean }
export interface AuditSnapshotsOptions { readonly now?: () => number; readonly bounds?: Partial<AuditSnapshotBounds> }

/** Activity loads metadata for future capture. A snapshot never authorizes a network send. */
export class AuditSnapshots implements AuditEventSink {
  private readonly residents = new Map<string, SnapshotResident>();
  private readonly loads = new Map<string, SnapshotLoad>();
  private readonly bounds: AuditSnapshotBounds;
  private readonly now: () => number;
  private bytes = 0;
  private closed = false;

  constructor(private readonly store: Pick<DestinationSettingsStore, 'read'>, private readonly downstream: RevisionBoundAuditSink, options: AuditSnapshotsOptions = {}) {
    this.bounds = snapshotBounds(options.bounds ?? {});
    this.now = options.now ?? (() => performance.now());
  }

  writeAuditEvent(event: AuditEvent): boolean {
    try {
      if (this.closed || !boundedSnapshotText(event.organizationId, this.bounds.tenantBytes)) return false;
      const tenant = event.organizationId;
      const resident = this.residentFor(tenant);
      if (resident === undefined) return false;
      const snapshot = resident.snapshot;
      if (snapshot !== undefined && this.now() < snapshot.until) {
        return snapshot.enabled && this.downstream.admit(Object.freeze({ destinationRevision: snapshot.revision, event: detachedAuditEvent(event) })) !== false;
      }
      resident.snapshot = undefined;
      this.loadLater(tenant, resident);
    } catch {
      // Store and capture failures cannot change completed product work or expose their causes.
    }
    return false;
  }

  close(): void {
    this.closed = true;
    for (const [tenant, load] of this.loads) {
      load.expired = true;
      load.resident.snapshot = undefined;
      clearTimeout(load.deadline);
      if (!load.started) this.finish(tenant, load);
    }
    for (const resident of this.residents.values()) this.bytes -= resident.bytes;
    this.residents.clear();
  }

  private residentFor(tenant: string): SnapshotResident | undefined {
    const found = this.residents.get(tenant);
    if (found !== undefined) {
      this.residents.delete(tenant); this.residents.set(tenant, found);
      return found;
    }
    // Charge a full revision allowance and fixed bookkeeping, without measuring JavaScript heap.
    const bytes = Buffer.byteLength(tenant) + this.bounds.revisionBytes + 128;
    if (!this.makeRoom(bytes)) return undefined;
    const resident: SnapshotResident = { bytes, retryAt: 0 };
    this.residents.set(tenant, resident); this.bytes += bytes;
    return resident;
  }

  private makeRoom(bytes: number, protectedResident?: SnapshotResident): boolean {
    while (this.residents.size + this.loads.size >= this.bounds.entries || this.bytes + bytes > this.bounds.metadataBytes) {
      const candidate = [...this.residents].find(([tenant, resident]) =>
        resident !== protectedResident && resident.retryAt <= this.now() && !(this.loads.get(tenant)?.expired === false));
      if (candidate === undefined) return false;
      this.residents.delete(candidate[0]); this.bytes -= candidate[1].bytes;
    }
    return true;
  }

  private loadLater(tenant: string, resident: SnapshotResident): void {
    if (resident.retryAt > this.now() || this.loads.has(tenant) || this.loads.size >= this.bounds.active) return;
    // Also charge the expired resident object if it is evicted before this read settles.
    const bytes = Buffer.byteLength(tenant) + 256;
    if (!this.makeRoom(bytes, resident)) return;
    const load: SnapshotLoad = { resident, bytes, until: this.now() + this.bounds.loadMs, expired: false, started: false };
    // Reserve scheduled work now; the callback closes over tenant metadata, never the event.
    this.loads.set(tenant, load); this.bytes += bytes;
    load.deadline = setTimeout(() => this.expire(tenant, load), this.bounds.loadMs);
    load.scheduled = setImmediate(() => { load.scheduled = undefined; void this.read(tenant, load); });
  }

  private async read(tenant: string, load: SnapshotLoad): Promise<void> {
    try {
      if (this.closed || load.expired) return;
      if (this.now() >= load.until) { this.expire(tenant, load); return; }
      load.started = true;
      const result = await this.store.read(tenant);
      if (!this.current(tenant, load)) return;
      if (this.now() >= load.until) { this.expire(tenant, load); return; }
      const snapshot = snapshotFrom(result, this.now() + this.bounds.freshMs, this.bounds.revisionBytes);
      if (snapshot === undefined) this.expire(tenant, load);
      else { load.resident.snapshot = snapshot; load.resident.retryAt = 0; }
    } catch {
      this.expire(tenant, load);
    } finally {
      this.finish(tenant, load);
    }
  }

  private current(tenant: string, load: SnapshotLoad): boolean {
    return !this.closed && !load.expired && this.residents.get(tenant) === load.resident;
  }

  private expire(tenant: string, load: SnapshotLoad): void {
    if (this.current(tenant, load)) {
      load.resident.snapshot = undefined;
      load.resident.retryAt = this.now() + this.bounds.backoffMs;
    }
    load.expired = true;
    if (!load.started) this.finish(tenant, load);
  }

  private finish(tenant: string, load: SnapshotLoad): void {
    clearTimeout(load.deadline); clearImmediate(load.scheduled);
    if (this.loads.get(tenant) !== load) return;
    this.loads.delete(tenant); this.bytes -= load.bytes;
  }
}
