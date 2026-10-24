import type { AuditEvent } from '../../../../../src/logs/audit/audit-log.ts';
import type { ReadSettingsResult } from '../../../../../src/logs/audit/destination-settings-store.ts';

export function eventFor(organizationId = 'tenant-a'): AuditEvent {
  return { eventName: 'audit.destination.changed', timestamp: '2026-10-24T12:00:00.000Z', organizationId, actor: { authority: 'provider', subject: 'admin' }, action: 'save', outcome: 'saved' };
}

export function settings(enabled = true, revision = 'revision-a'): ReadSettingsResult {
  return { status: 'found', settings: { enabled, revision, endpoint: 'private-endpoint', auth: 'bearer', encryptedCredential: 'private-ciphertext' } };
}

export class SnapshotStoreSpy {
  readonly reads: string[] = [];
  private pending: ((result: ReadSettingsResult) => void)[] = [];
  readonly read = (tenantId: string): Promise<ReadSettingsResult> => {
    this.reads.push(tenantId);
    return new Promise(resolve => { this.pending.push(resolve); });
  };
  async answer(result: ReadSettingsResult): Promise<void> {
    const next = this.pending.shift();
    if (next === undefined) throw new Error('No pending settings read');
    next(result);
    await immediateTurn();
  }
}

export const immediateTurn = () => new Promise<void>(resolve => setImmediate(resolve));
