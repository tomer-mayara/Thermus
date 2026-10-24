import type { ReadSettingsResult } from '../../../../src/logs/audit/destination-settings-store.ts';
import { DestinationSettingsFake } from './destination-settings-fake.ts';

export class SnapshotSettingsStoreSpy extends DestinationSettingsFake {
  readonly reads: string[] = [];
  unavailable = false;
  hold: Promise<void> | undefined;
  readonly started = Promise.withResolvers<void>();
  closes = 0;

  close(): void { this.closes++; }

  override async read(tenantId: string): Promise<ReadSettingsResult> {
    this.reads.push(tenantId);
    this.started.resolve();
    await this.hold;
    return this.unavailable ? { status: 'unavailable' } : super.read(tenantId);
  }
}
