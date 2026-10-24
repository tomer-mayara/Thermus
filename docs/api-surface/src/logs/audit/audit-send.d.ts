import type { AuditEvent } from './audit-log.ts';
export interface AuditDestination {
    readonly endpoint: string;
    readonly auth: {
        readonly type: 'none';
    } | {
        readonly type: 'bearer';
        readonly token: string;
    };
}
type AuditFailureReason = 'invalid_destination' | 'unsafe_destination' | 'dns_limit' | 'invalid_auth' | 'invalid_event' | 'request_too_large' | 'http_status' | 'retry_after_exceeds_limit' | 'invalid_response' | 'response_too_large' | 'transport' | 'tls' | 'timeout';
export type AuditSendOutcome = {
    readonly kind: 'accepted' | 'warning' | 'cancelled' | 'busy';
    readonly retryAfterMs?: never;
} | {
    readonly kind: 'partial_rejection';
    readonly rejectedRecords: 1;
    readonly retryAfterMs?: never;
} | {
    readonly kind: 'permanent_failure' | 'unconfirmed';
    readonly reason: AuditFailureReason;
    readonly statusCode?: number;
    readonly retryAfterMs?: never;
} | {
    readonly kind: 'transient_failure';
    readonly reason: AuditFailureReason;
    readonly statusCode?: number;
    readonly retryAfterMs?: number;
};
export interface AuditSendAttempt {
    readonly outcome: Promise<AuditSendOutcome>;
    readonly settled: Promise<void>;
}
export interface TrackedAuditSender {
    start(destination: AuditDestination, event: AuditEvent, signal?: AbortSignal): AuditSendAttempt;
}
export declare const AUDIT_SEND_LIMITS: Readonly<{
    active: 4;
    timeoutMs: 5000;
    requestBytes: 262144;
    responseBytes: 16384;
    headerBytes: 16384;
    tokenBytes: 8192;
    endpointCharacters: 2048;
    dnsAnswers: 32;
    retryAfterMs: 86400000;
}>;
export declare class AuditSendFailure extends Error {
    readonly outcome: AuditSendOutcome;
    constructor(outcome: AuditSendOutcome);
}
export {};
