import type { AccessContextVerification, VerifiedAccessContext } from '../../../accounts/identity/signed-access-context.ts';
import type { AuditLog, RelayedToolCompletion } from '../../../logs/audit/audit-log.ts';

/** Checks the access context of a relay for the organization of its event. App gives the public key of the gateway. */
export type RelayContextCheck = (context: string | null, organizationId: string) => Promise<AccessContextVerification>;

/** The reason of a refused relay, for the operator log. The detail is the reason of a refused context. */
export interface RelayRefusal {
  readonly reason: 'body' | 'event' | 'organization' | 'context' | 'actor' | 'memory';
  readonly detail?: string;
  readonly organizationId?: string;
}

export type CheckedRelay = { readonly event: RelayedToolCompletion; readonly context: VerifiedAccessContext } | { readonly refusal: RelayRefusal };

export interface RelayCheckRule {
  /** The authority of the control plane. The tenant ID of a relayed event is this authority and the organization ID. */
  readonly authority: string;
  readonly verify: RelayContextCheck;
  readonly audit: Pick<AuditLog, 'relayedToolCompletion'>;
}

/**
 * The trust rule of a relay (answer 6 of 27 October 2026). The body is one tool completion event that the projection
 * rules of the audit capture accept. Its tenant ID names an organization of this control plane. The signed access
 * context is valid for that organization, and it names the user of the event. So a tenant cannot relay an event of
 * another organization or of another user.
 */
export async function checkRelay(rule: RelayCheckRule, body: string, header: string | null): Promise<CheckedRelay> {
  const value = jsonOf(body);
  const event = value === undefined ? undefined : rule.audit.relayedToolCompletion(value);
  if (event === undefined) return { refusal: { reason: value === undefined ? 'body' : 'event' } };
  const organizationId = organizationOf(rule.authority, event.organizationId);
  if (organizationId === undefined) return { refusal: { reason: 'organization' } };
  const verification = await rule.verify(header, organizationId);
  if (verification.status === 'refused') return { refusal: { reason: 'context', detail: verification.reason, organizationId } };
  const { context } = verification;
  const sameUser = context.authority === rule.authority && event.actor.authority === context.authority && event.actor.subject === context.subject;
  return sameUser ? { event, context } : { refusal: { reason: 'actor', organizationId } };
}

// The tenant ID of a hosted event is the authority of the control plane, a colon, and the organization ID.
function organizationOf(authority: string, tenantId: string): string | undefined {
  const prefix = `${authority}:`;
  const organizationId = tenantId.startsWith(prefix) ? tenantId.slice(prefix.length) : '';
  return organizationId === '' ? undefined : organizationId;
}

function jsonOf(body: string): unknown {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return undefined;
  }
}
