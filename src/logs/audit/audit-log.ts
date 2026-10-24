import type { ChangeOutcome } from '../../accounts/organizations/change-records.ts';

interface AuditContext {
  /** Explicit time of the outcome, in ISO 8601 UTC. */
  readonly timestamp: string;
  readonly organizationId: string;
  readonly actor: { readonly authority: string; readonly subject: string };
}

export interface ToolCompletion extends AuditContext {
  readonly operationId: string;
  readonly tool: 'getURLAsMarkdown' | 'search';
  readonly status: 'success' | 'access_denied' | 'fetch_failed' | 'processing_failed' | 'cancelled' | 'busy' | 'search_failed' | 'withheld';
  readonly durationMs: number;
}

export interface AdministrationChange extends AuditContext {
  readonly action: 'invite' | 'resend-invitation' | 'revoke-invitation';
  readonly target: { readonly email: string } | { readonly invitationId: string };
  readonly role?: 'admin' | 'user';
  readonly outcome: ChangeOutcome;
}

/** A synthetic record from an explicit saved-destination Test. */
interface DestinationTestEvent extends AuditContext {
  readonly destinationRevision: string;
}

export type AuditEvent =
  | (ToolCompletion & { readonly eventName: 'mcp.tool.completed' })
  | (AdministrationChange & { readonly eventName: 'organization.changed' })
  | (DestinationTestEvent & { readonly eventName: 'audit.destination.test' });

/** No production capture is wired through this sink.
 * It accepts projected events without changing action outcomes. */
export interface AuditEventSink {
  /** Complete synchronously, for example by bounded enqueue; this contract does not await export. */
  writeAuditEvent(event: AuditEvent): void;
}

/** Projects explicit audit fields. It has no system-log dependency or production capture wiring. */
export class AuditLog {
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
