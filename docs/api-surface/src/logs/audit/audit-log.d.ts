import type { ChangeOutcome } from '../../accounts/organizations/change-records.ts';
export { AUDIT_CAPTURE_LIMITS } from './audit-content.ts';
export interface AuditContext {
    readonly timestamp: string;
    readonly organizationId: string;
    readonly actor: {
        readonly authority: string;
        readonly subject: string;
        readonly name?: string;
    };
}
interface ToolOutcome extends AuditContext {
    readonly operationId: string;
    readonly status: 'success' | 'access_denied' | 'fetch_failed' | 'processing_failed' | 'cancelled' | 'busy' | 'search_failed' | 'withheld';
    readonly durationMs: number;
}
export type ToolInput = {
    readonly tool: 'getURLAsMarkdown';
    readonly input: {
        readonly url: string;
        readonly reason: string;
    };
} | {
    readonly tool: 'search';
    readonly input: {
        readonly query: string;
        readonly reason: string;
    };
};
export type ToolCompletion = ToolOutcome & ToolInput & {
    readonly result: string;
};
export interface AuditResult {
    readonly text: string;
    readonly originalBytes: number;
    readonly capturedBytes: number;
    readonly truncated: boolean;
}
export interface AdministrationChange extends AuditContext {
    readonly action: 'invite' | 'resend-invitation' | 'revoke-invitation';
    readonly target: {
        readonly email: string;
    } | {
        readonly invitationId: string;
    };
    readonly role?: 'admin' | 'user';
    readonly outcome: ChangeOutcome;
}
export interface DestinationChange extends AuditContext {
    readonly action: 'save' | 'test';
    readonly outcome: 'saved' | 'unchanged' | 'invalid' | 'conflict' | 'unavailable' | 'unconfirmed' | 'tested' | 'unsaved' | 'cancelled' | 'busy' | 'denied' | 'stale';
}
interface DestinationTestEvent extends AuditContext {
    readonly destinationRevision: string;
}
export type AuditEvent = (ToolOutcome & ToolInput & {
    readonly eventName: 'mcp.tool.completed';
    readonly result: AuditResult;
}) | (AdministrationChange & {
    readonly eventName: 'organization.changed';
}) | (DestinationChange & {
    readonly eventName: 'audit.destination.changed';
}) | (DestinationTestEvent & {
    readonly eventName: 'audit.destination.test';
});
export interface AuditEventSink {
    writeAuditEvent(event: AuditEvent): void | boolean;
}
export declare class AuditLog {
    private readonly sink;
    constructor(sink: AuditEventSink);
    toolCompleted(completion: ToolCompletion): void;
    administrationChanged(change: AdministrationChange): void;
    destinationChanged(change: DestinationChange): void;
}
