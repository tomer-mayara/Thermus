import { randomUUID } from 'node:crypto';
import type { DestinationSettings, DestinationSettingsStore, ReadSettingsResult, SaveSettingsResult, StoredDestinationSettings } from '../../../../src/logs/audit/destination-settings-store.ts';

// Keeps atomic expected-revision writes in memory. The uncertain outcome can commit before its answer is lost.
export class DestinationSettingsFake implements DestinationSettingsStore {
  readonly settings = new Map<string, StoredDestinationSettings>();
  writes = 0;
  unconfirmNextSave = false;

  async read(tenantId: string): Promise<ReadSettingsResult> {
    const settings = this.settings.get(tenantId);
    return settings === undefined ? { status: 'absent' } : { status: 'found', settings };
  }

  async save(tenantId: string, expectedRevision: string | null, desired: DestinationSettings): Promise<SaveSettingsResult> {
    this.writes += 1;
    const previous = this.settings.get(tenantId);
    if ((previous?.revision ?? null) !== expectedRevision) return { status: 'conflict' };
    const unchanged = sameSettings(previous, desired);
    const settings = unchanged ? previous : { ...desired, revision: randomUUID() };
    this.settings.set(tenantId, settings);
    if (this.unconfirmNextSave) {
      this.unconfirmNextSave = false;
      return { status: 'unconfirmed' };
    }
    return { status: unchanged ? 'unchanged' : 'saved', settings };
  }
}

const settingFields = ['endpoint', 'axiomDataset', 'auth', 'enabled', 'encryptedCredential'] as const;

function sameSettings(previous: StoredDestinationSettings | undefined, desired: DestinationSettings): previous is StoredDestinationSettings {
  return previous !== undefined && settingFields.every(field => previous[field] === desired[field]);
}
