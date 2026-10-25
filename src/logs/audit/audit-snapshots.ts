import type { AuditEvent, AuditEventSink } from './audit-log.ts';
import type { DestinationSettingsStore } from './destination-settings-store.ts';
import { boundedSnapshotText, clearPendingEvents, detachedAuditEvent, retainPendingEvent, snapshotBounds, snapshotFrom } from './audit-snapshot-state.ts';
import type { AuditSnapshotBounds, Snapshot, SnapshotLoad, SnapshotResident } from './audit-snapshot-state.ts';

export type { AuditSnapshotBounds } from './audit-snapshot-state.ts';

export interface RevisionBoundAuditEvent { readonly destinationRevision: string; readonly event: AuditEvent }
export interface RevisionBoundAuditSink {
  admit(item: RevisionBoundAuditEvent): void | boolean;
  settingsObserved?(tenantId: string, revision: string | null): void;
}
export interface AuditSnapshotsOptions { readonly now?: () => number; readonly bounds?: Partial<AuditSnapshotBounds> }

/** Capture never waits for settings. A snapshot never authorizes a network send. */
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
      const load = this.loadLater(tenant, resident);
      return load !== undefined && retainPendingEvent(load, event, this.bounds);
    } catch {
      // Store and capture failures cannot change completed product work or expose their causes.
    }
    return false;
  }

  close(): void {
    this.closed = true;
    for (const [tenant, load] of this.loads) {
      load.expired = true;
      clearPendingEvents(load);
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

  private loadLater(tenant: string, resident: SnapshotResident): SnapshotLoad | undefined {
    const pending = this.loads.get(tenant);
    if (pending !== undefined) {
      if (this.now() >= pending.until) this.expire(tenant, pending);
      return this.current(tenant, pending) ? pending : undefined;
    }
    if (resident.retryAt > this.now() || this.loads.size >= this.bounds.active) return;
    // Also charge the expired resident object if it is evicted before this read settles.
    const bytes = Buffer.byteLength(tenant) + 256;
    if (!this.makeRoom(bytes, resident)) return;
    const load: SnapshotLoad = { resident, bytes, until: this.now() + this.bounds.loadMs, expired: false, started: false, pending: [], pendingBytes: 0 };
    // Only the load owns pending content, so expiry can clear it before a read settles.
    this.loads.set(tenant, load); this.bytes += bytes;
    load.deadline = setTimeout(() => this.expire(tenant, load), this.bounds.loadMs);
    load.scheduled = setImmediate(() => { load.scheduled = undefined; void this.read(tenant, load); });
    return load;
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
      else {
        load.resident.snapshot = snapshot; load.resident.retryAt = 0;
        try { this.downstream.settingsObserved?.(tenant, snapshot.enabled ? snapshot.revision : null); }
        catch { /* A downstream observation failure cannot invalidate a successful metadata load. */ }
        this.flushPending(tenant, load, snapshot);
      }
    } catch {
      this.expire(tenant, load);
    } finally {
      this.finish(tenant, load);
    }
  }

  private flushPending(tenant: string, load: SnapshotLoad, snapshot: Snapshot): void {
    if (!snapshot.enabled) return;
    // This read decides initial admission. Later rejection never replays this batch.
    for (const event of load.pending) {
      if (!this.current(tenant, load) || this.now() >= load.until) break;
      try { this.downstream.admit(Object.freeze({ destinationRevision: snapshot.revision, event })); }
      catch { /* One refused event must not prevent another event's admission or cleanup. */ }
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
    clearPendingEvents(load);
    if (!load.started) this.finish(tenant, load);
  }

  private finish(tenant: string, load: SnapshotLoad): void {
    clearPendingEvents(load);
    clearTimeout(load.deadline); clearImmediate(load.scheduled);
    if (this.loads.get(tenant) !== load) return;
    this.loads.delete(tenant); this.bytes -= load.bytes;
  }
}
