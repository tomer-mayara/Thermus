import type { AuditEvent } from './audit-log.ts';
import type { AuditDestination, AuditSendAttempt, AuditSendOutcome } from './audit-send.ts';
export type { AuditDestination, AuditSendOutcome } from './audit-send.ts';
export declare class OtlpAuditSender {
    private active;
    send(destination: AuditDestination, event: AuditEvent, signal?: AbortSignal): Promise<AuditSendOutcome>;
    start(destination: AuditDestination, event: AuditEvent, signal?: AbortSignal): AuditSendAttempt;
}
