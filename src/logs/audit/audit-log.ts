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

/** Metadata-only foundation. Production capture and safe content limits belong to S2-03a. */
export interface AuditLog {
  toolCompleted(completion: ToolCompletion): void;
  administrationChanged(change: AdministrationChange): void;
}

export type AuditEvent =
  | (ToolCompletion & { readonly eventName: 'mcp.tool.completed' })
  | (AdministrationChange & { readonly eventName: 'organization.changed' });

/** No exporter is wired yet. A sink accepts a projected event without changing the action outcome. */
export interface AuditEventSink {
  /** Complete synchronously, for example by bounded enqueue; this contract does not await export. */
  writeAuditEvent(event: AuditEvent): void;
}
