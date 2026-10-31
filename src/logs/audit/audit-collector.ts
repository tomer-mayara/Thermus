import type { RevisionBoundAuditEvent, RevisionBoundAuditSink } from './audit-snapshots.ts';
import type { DestinationSettingsService } from './destination-settings-service.ts';
import type { AuditSendAttempt, AuditSendOutcome, TrackedAuditSender } from './audit-send.ts';
import { boundedCollectorText, collectorBounds, retryDelay } from './audit-collector-state.ts';
import type { AuditCollectorBounds, CollectorItem, CollectorTenant, RetryBackoff } from './audit-collector-state.ts';
import { detachedAuditEvent } from './audit-snapshot-state.ts';

export type { AuditCollectorBounds } from './audit-collector-state.ts';
export interface AuditCollectorOptions { readonly now?: () => number; readonly random?: () => number; readonly bounds?: Partial<AuditCollectorBounds> }

export class AuditCollector implements RevisionBoundAuditSink {
  private readonly bounds: AuditCollectorBounds;
  private readonly now: () => number;
  private readonly retries: RetryBackoff;
  private readonly items = new Set<CollectorItem>();
  private readonly tenants = new Map<string, CollectorTenant>();
  private bytes = 0;
  private active = 0;
  private closed = false;
  private scheduled?: ReturnType<typeof setImmediate>;
  private retry?: ReturnType<typeof setTimeout>;

  constructor(private readonly authorizer: Pick<DestinationSettingsService, 'authorizeExport'>, private readonly sender: TrackedAuditSender, options: AuditCollectorOptions = {}) {
    this.bounds = collectorBounds(options.bounds ?? {});
    this.now = options.now ?? (() => performance.now());
    this.retries = { bounds: this.bounds, random: options.random ?? Math.random };
  }

  admit(captured: RevisionBoundAuditEvent): boolean {
    try {
      if (this.closed) return false;
      const admission = admissionOf(captured, this.bounds.eventBytes);
      if (admission === undefined || !this.capacity(this.tenants.get(admission.tenant), admission.bytes)) return false;
      this.enqueue(admission, captured.event);
      return true;
    } catch { return false; }
  }

  settingsObserved(tenantId: string, revision: string | null): void {
    const group = this.tenants.get(tenantId);
    if (group === undefined) return;
    for (const item of [...group.items]) if (revision === null || item.revision !== revision) this.dispose(item);
  }

  close(): void {
    this.closed = true;
    clearImmediate(this.scheduled); clearTimeout(this.retry);
    for (const item of this.items) this.dispose(item);
  }

  private capacity(group: CollectorTenant | undefined, bytes: number): boolean {
    return this.items.size < this.bounds.items && this.bytes + bytes <= this.bounds.bytes
      && (group !== undefined || this.tenants.size < this.bounds.tenants)
      && (group?.items.length ?? 0) < this.bounds.tenantItems && (group?.bytes ?? 0) + bytes <= this.bounds.tenantBytes;
  }

  private enqueue(admission: Admission, event: RevisionBoundAuditEvent['event']): void {
    const group = this.tenants.get(admission.tenant) ?? { items: [], bytes: 0, active: false };
    const item: CollectorItem = { ...admission, until: this.now() + this.bounds.ageMs,
      event: detachedAuditEvent(event), attempts: 0, nextAt: 0, disposed: false, active: false };
    this.tenants.set(admission.tenant, group); group.items.push(item); group.bytes += admission.bytes;
    this.items.add(item); this.bytes += admission.bytes;
    item.deadline = setTimeout(() => this.dispose(item), this.bounds.ageMs);
    this.schedule();
  }

  private schedule(): void {
    if (this.closed || this.scheduled !== undefined) return;
    this.scheduled = setImmediate(() => { this.scheduled = undefined; this.pump(); });
  }

  private pump(): void {
    clearTimeout(this.retry);
    let nextAt = Infinity;
    for (const group of this.tenants.values()) {
      if (group.active) continue;
      const item = group.items[0];
      if (item === undefined) continue;
      if (this.now() >= item.until) { this.dispose(item); continue; }
      if (item.nextAt > this.now()) { nextAt = Math.min(nextAt, item.nextAt); continue; }
      if (this.active >= this.bounds.active) continue;
      group.active = true; item.active = true; this.active++; item.attempts++;
      item.controller = new AbortController();
      void this.dispatch(item);
    }
    if (Number.isFinite(nextAt)) this.retry = setTimeout(() => this.schedule(), Math.max(0, nextAt - this.now()));
  }

  private async dispatch(item: CollectorItem): Promise<void> {
    try {
      // The short authorization frame returns only a send handle, never a destination or token.
      const attempt = await this.startAttempt(item);
      if (attempt === 'disposed') this.dispose(item);
      else if (attempt === 'changed') this.discardRevision(item);
      else if (attempt === 'unavailable') this.backoff(item, attempt);
      else {
        try { this.backoff(item, await attempt.outcome); }
        catch { this.dispose(item); }
        await attempt.settled.catch(() => {});
      }
    } catch { this.dispose(item); }
    finally {
      item.active = false; this.active--;
      const group = this.tenants.get(item.tenant);
      if (group !== undefined) group.active = false;
      if (item.disposed) this.release(item);
      this.schedule();
    }
  }

  private async startAttempt(item: CollectorItem): Promise<AuditSendAttempt | 'changed' | 'unavailable' | 'disposed'> {
    const until = Math.min(item.until, this.now() + this.bounds.readMs);
    item.readDeadline = setTimeout(() => this.dispose(item), Math.max(0, until - this.now()));
    try {
      const authorization = await this.authorizer.authorizeExport(item.tenant, item.revision, item.controller?.signal);
      if (item.disposed || this.closed || this.now() >= until) { this.dispose(item); return 'disposed'; }
      if (authorization.status !== 'ready') return authorization.status;
      if (item.event === undefined) return 'disposed';
      return this.sender.start(authorization.destination, item.event, item.controller?.signal);
    } catch { return 'unavailable'; }
    finally { clearTimeout(item.readDeadline); }
  }

  private backoff(item: CollectorItem, outcome: AuditSendOutcome | 'unavailable'): void {
    if (item.disposed) return;
    const delay = retryDelay(outcome, item.attempts, this.retries);
    if (delay === undefined || this.now() + delay >= item.until) this.dispose(item);
    else item.nextAt = this.now() + delay;
  }

  private discardRevision(item: CollectorItem): void {
    for (const pending of [...(this.tenants.get(item.tenant)?.items ?? [])]) if (pending.revision === item.revision) this.dispose(pending);
  }

  private dispose(item: CollectorItem): void {
    item.disposed = true; item.event = undefined;
    clearTimeout(item.readDeadline); clearTimeout(item.deadline);
    item.controller?.abort();
    if (!item.active) this.release(item);
  }

  private release(item: CollectorItem): void {
    if (!this.items.delete(item)) return;
    clearTimeout(item.deadline); this.bytes -= item.bytes;
    const group = this.tenants.get(item.tenant);
    if (group === undefined) return;
    group.bytes -= item.bytes; group.items.splice(group.items.indexOf(item), 1);
    if (group.items.length === 0) this.tenants.delete(item.tenant);
    this.schedule();
  }
}

type Admission = Pick<CollectorItem, 'tenant' | 'revision' | 'bytes'>;

function admissionOf(captured: RevisionBoundAuditEvent, eventBytes: number): Admission | undefined {
  const { organizationId: tenant } = captured.event;
  const revision = captured.destinationRevision;
  if (!boundedCollectorText(tenant, 1_024) || !boundedCollectorText(revision, 128)) return undefined;
  // The input is the plain, bounded projection owned by AuditSnapshots.
  if (Buffer.byteLength(JSON.stringify(captured.event)) > eventBytes) return undefined;
  return { tenant, revision, bytes: Buffer.byteLength(JSON.stringify({ destinationRevision: revision, event: captured.event })) };
}
