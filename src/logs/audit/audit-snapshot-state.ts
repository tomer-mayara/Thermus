import type { AuditEvent } from './audit-log.ts';
import type { ReadSettingsResult } from './destination-settings-store.ts';

export interface AuditSnapshotBounds {
  freshMs: number; backoffMs: number; loadMs: number; active: number;
  entries: number; metadataBytes: number; tenantBytes: number; revisionBytes: number;
  pendingItems: number; pendingBytes: number; eventBytes: number;
}

const AUDIT_SNAPSHOT_LIMITS: Readonly<AuditSnapshotBounds> = Object.freeze({
  freshMs: 30_000, backoffMs: 5_000, loadMs: 2_500, active: 2,
  entries: 256, metadataBytes: 262_144, tenantBytes: 1_024, revisionBytes: 128,
  pendingItems: 16, pendingBytes: 1_048_576, eventBytes: 131_072,
});

export interface Snapshot { readonly enabled: boolean; readonly revision: string; readonly until: number }
export interface SnapshotResident { readonly bytes: number; snapshot?: Snapshot; retryAt: number }
export interface SnapshotLoad {
  readonly resident: SnapshotResident; readonly bytes: number; readonly until: number; expired: boolean; started: boolean;
  readonly pending: AuditEvent[]; pendingBytes: number;
  scheduled?: ReturnType<typeof setImmediate>; deadline?: ReturnType<typeof setTimeout>;
}

export function snapshotBounds(overrides: Partial<AuditSnapshotBounds>): AuditSnapshotBounds {
  const bounds = { ...AUDIT_SNAPSHOT_LIMITS, ...overrides };
  for (const value of Object.values(bounds)) {
    if (!Number.isSafeInteger(value) || value < 1) throw new TypeError('Invalid audit snapshot bounds');
  }
  return bounds;
}

export function boundedSnapshotText(value: unknown, bytes: number): value is string {
  return typeof value === 'string' && value.trim() !== '' && value.isWellFormed() && Buffer.byteLength(value) <= bytes;
}

export function snapshotFrom(result: ReadSettingsResult, until: number, revisionBytes: number): Snapshot | undefined {
  if (result.status === 'absent') return { enabled: false, revision: '', until };
  if (result.status !== 'found') return undefined;
  const { enabled, revision } = result.settings;
  if (typeof enabled !== 'boolean' || !boundedSnapshotText(revision, revisionBytes)) return undefined;
  return { enabled, revision, until };
}

export function detachedAuditEvent(event: AuditEvent): AuditEvent {
  // This sink receives the plain, bounded projection from AuditLog, not an arbitrary input object.
  const copy = structuredClone(event);
  Object.freeze(copy.actor);
  if ('input' in copy) { Object.freeze(copy.input); Object.freeze(copy.result); }
  if ('target' in copy) Object.freeze(copy.target);
  return Object.freeze(copy);
}

export function retainPendingEvent(load: SnapshotLoad, event: AuditEvent, bounds: AuditSnapshotBounds): boolean {
  if (load.pending.length >= bounds.pendingItems) return false;
  const bytes = Buffer.byteLength(JSON.stringify(event));
  if (bytes > bounds.eventBytes || load.pendingBytes + bytes > bounds.pendingBytes) return false;
  load.pending.push(detachedAuditEvent(event));
  load.pendingBytes += bytes;
  return true;
}

export function clearPendingEvents(load: SnapshotLoad): void {
  load.pending.length = 0;
  load.pendingBytes = 0;
}
