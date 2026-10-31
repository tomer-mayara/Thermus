import type { AuditEvent } from './audit-log.ts';
import type { AuditSendOutcome } from './audit-send.ts';
export interface AuditCollectorBounds {
  items: number; tenantItems: number; bytes: number; tenantBytes: number; eventBytes: number;
  tenants: number; active: number; ageMs: number; readMs: number; attempts: number; backoffMs: number; backoffCapMs: number;
}

const defaults: AuditCollectorBounds = {
  items: 128, tenantItems: 16, bytes: 8_388_608, tenantBytes: 1_048_576, eventBytes: 131_072,
  tenants: 32, active: 2, ageMs: 30_000, readMs: 2_500, attempts: 3, backoffMs: 250, backoffCapMs: 2_000,
};

export interface CollectorItem {
  readonly tenant: string; readonly revision: string; readonly bytes: number; readonly until: number;
  event?: AuditEvent; attempts: number; nextAt: number; disposed: boolean; active: boolean;
  controller?: AbortController; deadline?: ReturnType<typeof setTimeout>; readDeadline?: ReturnType<typeof setTimeout>;
}
export interface CollectorTenant { readonly items: CollectorItem[]; bytes: number; active: boolean }

export function collectorBounds(overrides: Partial<AuditCollectorBounds>): AuditCollectorBounds {
  const bounds = { ...defaults, ...overrides };
  for (const value of Object.values(bounds)) if (!Number.isSafeInteger(value) || value < 1) throw new TypeError('Invalid audit collector bounds');
  return bounds;
}

export function boundedCollectorText(value: unknown, bytes: number): value is string {
  return typeof value === 'string' && value !== '' && Buffer.byteLength(value) <= bytes;
}

export interface RetryBackoff { readonly bounds: AuditCollectorBounds; readonly random: () => number }

export function retryDelay(outcome: AuditSendOutcome | 'unavailable', attempts: number, backoff: RetryBackoff): number | undefined {
  const { bounds } = backoff;
  const jitter = Math.max(0, Math.min(1, backoff.random()));
  if (attempts >= bounds.attempts) return undefined;
  if (outcome !== 'unavailable' && outcome.kind !== 'transient_failure' && outcome.kind !== 'busy') return undefined;
  const base = Math.min(bounds.backoffCapMs, bounds.backoffMs * 2 ** (attempts - 1));
  const delay = base + Math.floor(base * 0.25 * jitter);
  const retryAfter = outcome === 'unavailable' ? 0 : outcome.retryAfterMs ?? 0;
  return Number.isFinite(retryAfter) && retryAfter >= 0 ? Math.max(delay, retryAfter) : undefined;
}
