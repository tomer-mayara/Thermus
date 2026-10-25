export interface MemberRemovalRequest {
    readonly organizationId: string;
    readonly membershipId: string;
    readonly revision: string;
}
export type RemovalResult = 'applied' | 'denied' | 'stale' | 'unsupported' | 'last-admin' | 'busy' | 'unavailable' | 'unknown';
export interface RemovalIntent {
    readonly organizationId: string;
    readonly operationId: string;
    readonly membershipId: string;
    readonly revision: string;
    readonly actor: {
        readonly authority: string;
        readonly subject: string;
    };
    readonly startedAt: string;
}
export type RemovalTerminal = 'applied' | 'no-effect';
export type RemovalOperation = RemovalIntent & {
    readonly outcome: RemovalTerminal | null;
};
export interface RemovalOperationStore {
    admitRemoval(intent: RemovalIntent): Promise<{
        status: 'admitted' | 'busy' | 'unavailable' | 'unconfirmed';
    }>;
    readRemoval(organizationId: string): Promise<{
        status: 'found';
        operation: RemovalOperation;
    } | {
        status: 'absent' | 'unavailable';
    }>;
    completeRemoval(organizationId: string, operationId: string, outcome: RemovalTerminal): Promise<{
        status: 'completed' | 'mismatch' | 'unavailable' | 'unconfirmed';
    }>;
}
