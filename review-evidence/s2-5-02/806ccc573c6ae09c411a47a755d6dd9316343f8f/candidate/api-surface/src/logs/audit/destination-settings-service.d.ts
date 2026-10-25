import type { DestinationSettingsStore } from './destination-settings-store.ts';
import type { AuditDestination } from './audit-send.ts';
import type { DestinationTestResult, DestinationTestSender } from './destination-test.ts';
export type { DestinationTestResult } from './destination-test.ts';
export interface PublicDestinationSettings {
    readonly revision: string | null;
    readonly endpoint: string;
    readonly axiomDataset?: string;
    readonly auth: 'none' | 'bearer';
    readonly enabled: boolean;
    readonly tokenPresent: boolean;
    readonly tokenPreview?: string;
}
export interface DestinationSettingsSaveInput {
    readonly expectedRevision: string | null;
    readonly endpoint: string;
    readonly axiomDataset?: string;
    readonly auth: 'none' | 'bearer';
    readonly enabled: boolean;
    readonly token: string;
}
export type DestinationSettingsReadResult = {
    readonly status: 'found' | 'absent';
    readonly settings: PublicDestinationSettings;
} | {
    readonly status: 'unavailable';
};
export type DestinationSettingsSaveResult = {
    readonly status: 'saved' | 'unchanged';
    readonly settings: PublicDestinationSettings;
} | {
    readonly status: 'invalid';
    readonly reason: 'endpoint' | 'dataset' | 'token' | 'settings';
} | {
    readonly status: 'conflict' | 'unavailable' | 'unconfirmed';
};
export type ExportAuthorization = {
    readonly status: 'ready';
    readonly destination: AuditDestination;
} | {
    readonly status: 'changed' | 'unavailable';
};
export declare class DestinationSettingsService {
    private readonly store;
    private readonly sender;
    private readonly codec;
    private readonly tests;
    constructor(store: DestinationSettingsStore, key: Uint8Array, sender: DestinationTestSender);
    authorizeExport(tenantId: string, expectedRevision: string, signal?: AbortSignal): Promise<ExportAuthorization>;
    test(tenantId: string, input: DestinationSettingsSaveInput, actor: {
        readonly authority: string;
        readonly subject: string;
    }, signal?: AbortSignal): Promise<DestinationTestResult>;
    private testSaved;
    read(tenantId: string): Promise<DestinationSettingsReadResult>;
    save(tenantId: string, input: DestinationSettingsSaveInput): Promise<DestinationSettingsSaveResult>;
    private readStored;
    private token;
}
