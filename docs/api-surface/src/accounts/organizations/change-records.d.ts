import type { AuthenticatedUser } from '../identity/access-context.ts';
export type ChangeResult = 'applied' | 'unchanged' | 'denied' | 'stale' | 'not-pending' | 'address-in-use' | 'limit-reached' | 'unsupported';
export type ChangeOutcome = ChangeResult | 'failed' | 'unknown' | 'last-admin' | 'busy' | 'unavailable';
export declare class UnconfirmedChangeError extends Error {
    constructor(cause: unknown);
}
type ChangeTarget = {
    readonly membershipId: string;
} | {
    readonly invitationId: string;
} | {
    readonly email: string;
};
export interface ChangeRecord {
    readonly time: string;
    readonly actor: {
        readonly authority: string;
        readonly subject: string;
    };
    readonly organizationId: string;
    readonly target: ChangeTarget;
    readonly action: string;
    readonly role?: string;
    readonly outcome: ChangeOutcome;
}
export interface ChangeRecorder {
    record(entry: ChangeRecord): void;
}
export type DirectoryChange = () => Promise<ChangeResult>;
export interface ChangeEntry {
    readonly actor: AuthenticatedUser;
    readonly organizationId: string;
    readonly target: ChangeTarget;
    readonly action: string;
    role?: string;
}
export declare class ChangeRecording {
    private readonly records;
    private readonly clock;
    constructor(records: ChangeRecorder, clock: () => Date);
    run(entry: ChangeEntry, check: () => Promise<ChangeResult | DirectoryChange>): Promise<ChangeResult>;
    private recordingFailure;
    record(entry: ChangeEntry, outcome: ChangeOutcome): void;
}
export {};
