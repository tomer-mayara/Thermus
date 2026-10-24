import { AuditCollector, type AuditCollectorOptions } from '../../../../../src/logs/audit/audit-collector.ts';
import type { AuditDestination, AuditSendOutcome, TrackedAuditSender } from '../../../../../src/logs/audit/audit-send.ts';
import type { ExportAuthorization } from '../../../../../src/logs/audit/destination-settings-service.ts';
import type { RevisionBoundAuditEvent } from '../../../../../src/logs/audit/audit-snapshots.ts';

export function pending<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

export const turn = () => new Promise<void>(resolve => setImmediate(resolve));
export const destination: AuditDestination = { endpoint: 'https://collector.example/v1/logs', auth: { type: 'none' } };
export const ready: ExportAuthorization = { status: 'ready', destination };

export function captured(tenant = 'tenant-a', revision = 'revision-a', subject = 'admin'): RevisionBoundAuditEvent {
  return Object.freeze({ destinationRevision: revision, event: Object.freeze({
    eventName: 'audit.destination.changed', timestamp: '2026-10-24T12:00:00.000Z', organizationId: tenant,
    actor: Object.freeze({ authority: 'provider', subject }), action: 'save', outcome: 'saved',
  }) });
}

export function collectorWith(options: AuditCollectorOptions = {}, setup: {
  authorize?: (tenant: string, revision: string, signal?: AbortSignal) => Promise<ExportAuthorization>;
  start?: TrackedAuditSender['start'];
} = {}) {
  const reads: { tenant: string; revision: string; signal?: AbortSignal }[] = [];
  const sends: { destination: AuditDestination; item: unknown; signal?: AbortSignal }[] = [];
  const collector = new AuditCollector({ authorizeExport: (tenant, revision, signal) => {
    reads.push({ tenant, revision, signal });
    return setup.authorize?.(tenant, revision, signal) ?? Promise.resolve(ready);
  } }, { start: (destination, event, signal) => {
    sends.push({ destination, item: event, signal });
    return setup.start?.(destination, event, signal) ?? { outcome: Promise.resolve<AuditSendOutcome>({ kind: 'accepted' }), settled: Promise.resolve() };
  } }, options);
  return { collector, reads, sends };
}
