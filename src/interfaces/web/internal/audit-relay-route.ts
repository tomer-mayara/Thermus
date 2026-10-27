import { ACCESS_CONTEXT_HEADER, type AccessContextVerification, type VerifiedAccessContext } from '../../../accounts/identity/signed-access-context.ts';
import type { AuditLog, RelayedToolCompletion } from '../../../logs/audit/audit-log.ts';
import { AcceptedRelays } from './accepted-relays.ts';

/** Checks the access context of a relay for the organization of its event. App gives the public key of the gateway. */
export type RelayContextCheck = (context: string | null, organizationId: string) => Promise<AccessContextVerification>;

/** The reason of a refused relay, for the operator log. The detail is the reason of a refused context. */
export interface RelayRefusal {
  readonly reason: 'body' | 'event' | 'organization' | 'context' | 'actor' | 'memory';
  readonly detail?: string;
  readonly organizationId?: string;
}

export interface AuditRelayRouteOptions {
  /** The host of CONTROL_PLANE_INTERNAL_URL: a tenant relays to this host, so only it reaches /internal/*. */
  readonly internalHost: string;
  /** The authority of the control plane. The tenant ID of a relayed event is this authority and the organization ID. */
  readonly authority: string;
  readonly verify: RelayContextCheck;
  readonly audit: Pick<AuditLog, 'relayedToolCompletion' | 'toolRelayed'>;
  readonly reportRefusal: (refusal: RelayRefusal) => void;
  readonly now?: () => number;
}

const INTERNAL_PREFIX = '/internal/';
const RELAY_PATH = '/internal/audit';
// A bound of the work of an untrusted body before the parse. The event bound of the audit capture is smaller.
const MAX_BODY_BYTES = 256 * 1024;

type Checked = { readonly event: RelayedToolCompletion; readonly context: VerifiedAccessContext } | { readonly refusal: RelayRefusal };

const STATUS_OF: Readonly<Record<RelayRefusal['reason'], number>> = { body: 400, event: 400, organization: 403, context: 403, actor: 403, memory: 503 };

/**
 * The route POST /internal/audit of the control plane (SO-05). A tenant relays each audit event of its tools with the
 * access context of the request (answer 6 of 27 October 2026). The route accepts a relay only on the internal service
 * host, only with a valid context for the organization and the user of the event, and only one time for each operation
 * ID. It captures the event through the audit capture of today, which exports it with the destination settings of the
 * organization. Each other request under /internal/ gets 404.
 */
export class AuditRelayRoute {
  private readonly options: AuditRelayRouteOptions;
  private readonly internalHost: string;
  private readonly accepted: AcceptedRelays;

  constructor(options: AuditRelayRouteOptions) {
    this.options = options;
    this.internalHost = options.internalHost.toLowerCase();
    this.accepted = new AcceptedRelays(options.now ?? (() => Date.now()));
  }

  handles(pathname: string): boolean {
    return pathname.startsWith(INTERNAL_PREFIX);
  }

  async handle(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (request.headers.get('host')?.toLowerCase() !== this.internalHost || pathname !== RELAY_PATH) return new Response('Not Found', { status: 404 });
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });
    const body = await boundedText(request);
    if (body === undefined) return this.refused({ reason: 'body' }, 413);
    const checked = await this.check(body, request.headers.get(ACCESS_CONTEXT_HEADER));
    if ('refusal' in checked) return this.refused(checked.refusal);
    const admission = this.accepted.admit(checked.event.organizationId, checked.event.operationId);
    if (admission === 'full') return this.refused({ reason: 'memory', organizationId: checked.context.organizationId });
    // A repeated operation ID is a retry of an accepted relay: the tenant stops, and the event is not captured again.
    if (admission === 'new') this.options.audit.toolRelayed(checked.event);
    return new Response(null, { status: 202 });
  }

  private async check(body: string, header: string | null): Promise<Checked> {
    const value = jsonOf(body);
    const event = value === undefined ? undefined : this.options.audit.relayedToolCompletion(value);
    if (event === undefined) return { refusal: { reason: value === undefined ? 'body' : 'event' } };
    const organizationId = this.organizationOf(event.organizationId);
    if (organizationId === undefined) return { refusal: { reason: 'organization' } };
    const verification = await this.options.verify(header, organizationId);
    if (verification.status === 'refused') return { refusal: { reason: 'context', detail: verification.reason, organizationId } };
    const { context } = verification;
    const sameUser = context.authority === this.options.authority && event.actor.authority === context.authority && event.actor.subject === context.subject;
    return sameUser ? { event, context } : { refusal: { reason: 'actor', organizationId } };
  }

  // The tenant ID of a hosted event is the authority of the control plane, a colon, and the organization ID.
  private organizationOf(tenantId: string): string | undefined {
    const prefix = `${this.options.authority}:`;
    const organizationId = tenantId.startsWith(prefix) ? tenantId.slice(prefix.length) : '';
    return organizationId === '' ? undefined : organizationId;
  }

  private refused(refusal: RelayRefusal, status = STATUS_OF[refusal.reason]): Response {
    this.options.reportRefusal(refusal);
    return Response.json({ error: status === 503 ? 'temporarily_unavailable' : 'relay_refused' }, { status });
  }
}

async function boundedText(request: Request): Promise<string | undefined> {
  if (request.body === null) return '';
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) return undefined;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    size += chunk.value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return undefined;
    }
    chunks.push(chunk.value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function jsonOf(body: string): unknown {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return undefined;
  }
}
