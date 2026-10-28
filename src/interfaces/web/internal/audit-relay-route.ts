import { ACCESS_CONTEXT_HEADER } from '../../../accounts/identity/signed-access-context.ts';
import type { AuditLog } from '../../../logs/audit/audit-log.ts';
import { readBoundedBody } from '../../../runtime/http/bounded-body.ts';
import { AcceptedRelays } from './accepted-relays.ts';
import { checkRelay, type RelayCheckRule, type RelayRefusal } from './audit-relay-check.ts';

export interface AuditRelayRouteOptions extends RelayCheckRule {
  /** The host of CONTROL_PLANE_INTERNAL_URL: a tenant relays to this host, so only it reaches /internal/*. */
  readonly internalHost: string;
  readonly audit: Pick<AuditLog, 'relayedToolCompletion' | 'toolRelayed'>;
  readonly reportRefusal: (refusal: RelayRefusal) => void;
  readonly now?: () => number;
}

const INTERNAL_PREFIX = '/internal/';
const RELAY_PATH = '/internal/audit';
// A bound of the work of an untrusted body before the parse. The event bound of the audit capture is smaller.
const MAX_BODY_BYTES = 256 * 1024;

const STATUS_OF: Readonly<Record<RelayRefusal['reason'], number>> = { body: 400, event: 400, organization: 403, context: 403, actor: 403, memory: 503 };

/**
 * The route POST /internal/audit of the control plane (SO-05). A tenant relays each audit event of its tools with the
 * access context of the request (answer 6 of 27 October 2026). The route accepts a relay only on the internal service
 * host, only when the relay passes its check, and only one time for each operation ID. It captures the event through
 * the audit capture of today, which exports it with the destination settings of the organization. Each other request
 * under /internal/ gets 404.
 */
export class AuditRelayRoute {
  /** The rule of the relay check, the capture, and the report of each refusal. */
  private readonly options: AuditRelayRouteOptions;
  /** The host of the internal origin, in lower case. */
  private readonly internalHost: string;
  /** The operation IDs that the route accepted, so that a repeat is not captured again. */
  private readonly accepted: AcceptedRelays;

  constructor(options: AuditRelayRouteOptions) {
    this.options = options;
    this.internalHost = options.internalHost.toLowerCase();
    this.accepted = new AcceptedRelays(options.now ?? (() => Date.now()));
  }

  /** Each path under /internal/, so that no internal path reaches the account routes. */
  handles(pathname: string): boolean {
    return pathname.startsWith(INTERNAL_PREFIX);
  }

  /** 202 for an accepted relay and for a repeat of one; else the status of the refusal and one report line. */
  async handle(request: Request): Promise<Response> {
    const transport = transportRefusalOf(request, this.internalHost);
    if (transport !== undefined) return transport;
    const body = await readBoundedBody(request, MAX_BODY_BYTES, request.signal);
    if (body === undefined) return this.refused({ reason: 'body' }, 413);
    const checked = await checkRelay(this.options, body.toString('utf8'), request.headers.get(ACCESS_CONTEXT_HEADER));
    if ('refusal' in checked) return this.refused(checked.refusal);
    const admission = this.accepted.admit(checked.event.organizationId, checked.event.operationId);
    if (admission === 'full') return this.refused({ reason: 'memory', organizationId: checked.context.organizationId });
    // A repeated operation ID is a retry of an accepted relay: the tenant stops, and the event is not captured again.
    if (admission === 'new') this.options.audit.toolRelayed(checked.event);
    return new Response(null, { status: 202 });
  }

  /** A refusal: one report line for the operator, and an answer that tells the tenant whether to try again. */
  private refused(refusal: RelayRefusal, status = STATUS_OF[refusal.reason]): Response {
    this.options.reportRefusal(refusal);
    return Response.json({ error: status === 503 ? 'temporarily_unavailable' : 'relay_refused' }, { status });
  }
}

// The public host and each other internal path get 404, so the public origin shows no internal route. The relay path
// takes POST only.
function transportRefusalOf(request: Request, internalHost: string): Response | undefined {
  const { pathname } = new URL(request.url);
  if (request.headers.get('host')?.toLowerCase() !== internalHost || pathname !== RELAY_PATH) return new Response('Not Found', { status: 404 });
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });
  return undefined;
}
