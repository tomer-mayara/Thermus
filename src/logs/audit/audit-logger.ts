import type { AdministrationChange, AuditEventSink, AuditLog, ToolCompletion } from './audit-log.ts';

/** Projects explicit audit fields. It has no system-log dependency or production capture wiring. */
export class AuditLogger implements AuditLog {
  private readonly sink: AuditEventSink;

  constructor(sink: AuditEventSink) { this.sink = sink; }

  toolCompleted(completion: ToolCompletion): void {
    try {
      this.sink.writeAuditEvent({
        eventName: 'mcp.tool.completed',
        timestamp: completion.timestamp,
        organizationId: completion.organizationId,
        actor: { authority: completion.actor.authority, subject: completion.actor.subject },
        operationId: completion.operationId,
        tool: completion.tool,
        status: completion.status,
        durationMs: completion.durationMs,
      });
    } catch {
      // Audit delivery is best effort; sink failure must not alter the completed action.
    }
  }

  administrationChanged(change: AdministrationChange): void {
    try {
      this.sink.writeAuditEvent({
        eventName: 'organization.changed',
        timestamp: change.timestamp,
        organizationId: change.organizationId,
        actor: { authority: change.actor.authority, subject: change.actor.subject },
        action: change.action,
        target: 'email' in change.target ? { email: change.target.email } : { invitationId: change.target.invitationId },
        ...(change.role === undefined ? {} : { role: change.role }),
        outcome: change.outcome,
      });
    } catch {
      // Audit delivery is best effort; sink failure must not alter the completed action.
    }
  }
}
