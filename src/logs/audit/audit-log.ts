import type { ChangeOutcome } from '../../accounts/organizations/change-records.ts';
import { projectAdministrationChange, projectDestinationChange, projectToolCompletion } from './audit-event-projection.ts';

export { AUDIT_CAPTURE_LIMITS } from './audit-content.ts';

export interface AuditContext {
  /** Explicit time of the outcome, in ISO 8601 UTC. */
  readonly timestamp: string;
  readonly organizationId: string;
  readonly actor: { readonly authority: string; readonly subject: string };
}

interface ToolOutcome extends AuditContext {
  readonly operationId: string;
  readonly status: 'success' | 'access_denied' | 'fetch_failed' | 'processing_failed' | 'cancelled' | 'busy' | 'search_failed' | 'withheld';
  readonly durationMs: number;
}

export type ToolInput =
  | { readonly tool: 'getURLAsMarkdown'; readonly input: { readonly url: string; readonly reason: string } }
  | { readonly tool: 'search'; readonly input: { readonly query: string; readonly reason: string } };

/** Call only with validated input and the final public text after outcome mapping. */
export type ToolCompletion = ToolOutcome & ToolInput & { readonly result: string };

export interface AuditResult {
  readonly text: string;
  readonly originalBytes: number;
  /** Includes the marker when the exported copy is truncated. */
  readonly capturedBytes: number;
  readonly truncated: boolean;
}

export interface AdministrationChange extends AuditContext {
  readonly action: 'invite' | 'resend-invitation' | 'revoke-invitation';
  readonly target: { readonly email: string } | { readonly invitationId: string };
  readonly role?: 'admin' | 'user';
  readonly outcome: ChangeOutcome;
}

export interface DestinationChange extends AuditContext {
  readonly action: 'save' | 'test';
  readonly outcome: 'saved' | 'unchanged' | 'invalid' | 'conflict' | 'unavailable' | 'unconfirmed' | 'tested' | 'unsaved' | 'cancelled' | 'busy' | 'denied' | 'stale';
}

/** A synthetic record from an explicit saved-destination Test. */
interface DestinationTestEvent extends AuditContext {
  readonly destinationRevision: string;
}

export type AuditEvent =
  | (ToolOutcome & ToolInput & { readonly eventName: 'mcp.tool.completed'; readonly result: AuditResult })
  | (AdministrationChange & { readonly eventName: 'organization.changed' })
  | (DestinationChange & { readonly eventName: 'audit.destination.changed' })
  | (DestinationTestEvent & { readonly eventName: 'audit.destination.test' });

export interface AuditEventSink {
  /** Finish synchronously, for example by bounded enqueue. False means refused admission. */
  writeAuditEvent(event: AuditEvent): void | boolean;
}

/** Copies only supported customer fields. Capture failure cannot change a completed action. */
export class AuditLog {
  private readonly sink: AuditEventSink;

  constructor(sink: AuditEventSink) { this.sink = sink; }

  toolCompleted(completion: ToolCompletion): void {
    try {
      const event = projectToolCompletion(completion);
      if (event !== undefined) this.sink.writeAuditEvent(event);
    } catch {
      // Capture is best effort. Do not export failure details through another log.
    }
  }

  administrationChanged(change: AdministrationChange): void {
    try {
      const event = projectAdministrationChange(change);
      if (event !== undefined) this.sink.writeAuditEvent(event);
    } catch {
      // A failed capture must not replay a completed administration action.
    }
  }

  destinationChanged(change: DestinationChange): void {
    try {
      const event = projectDestinationChange(change);
      if (event !== undefined) this.sink.writeAuditEvent(event);
    } catch {
      // A failed capture must not replay Save or Test.
    }
  }
}
