import type { RequestContext } from '../../accounts/identity/access-context.ts';
import type { AccessContextClaims } from '../../accounts/identity/signed-access-context.ts';
import { tenantHeaders } from './mcp-gateway-headers.ts';
import type { GatewayRefusals } from './mcp-gateway-refusals.ts';
import { readForwardedBody, tooLargeAnswer, type ForwardedBody } from './mcp-gateway-request.ts';
import { GatewaySearches } from './mcp-gateway-searches.ts';
import { callTenant, type TenantAnswer, type TenantCall } from './mcp-gateway-stream.ts';
import type { GatewayTenants } from './mcp-gateway-tenants.ts';
import type { McpForwardedRequest } from './mcp-server.ts';

/** Signs the access context of one request. Only the control plane holds the private key. */
export interface ContextSigner {
  sign(claims: AccessContextClaims, bearerToken: string): Promise<string>;
}

/** The parts of the live forward: the signer of the context, the activity write, and the answers of the gateway. */
interface ForwardParts {
  readonly signer: ContextSigner;
  readonly tenants: Pick<GatewayTenants, 'recordActive'>;
  readonly refusals: GatewayRefusals;
}

/**
 * The forward of a request to a live tenant: the body within the SDK limit, the search places, the signed context,
 * the call, and the answer stream. The search places of a request stay taken until its answer stream ends.
 */
export class LiveForward {
  /** The search places of all tenants together. */
  private readonly searches = new GatewaySearches();
  /** The signer of the context, the activity write, and the answers of the gateway. */
  private readonly parts: ForwardParts;

  constructor(parts: ForwardParts) {
    this.parts = parts;
  }

  /**
   * The steps in their order: the body, the search places, the signed call, then the answer. A failed call and a
   * restart free the places at once; an answer frees them at the end of its stream.
   */
  async forward(request: Request, forwarded: McpForwardedRequest, internalUrl: string): Promise<Response> {
    const organizationId = forwarded.context.organizationId ?? '';
    const read = await readForwardedBody(request, forwarded.lifetime.signal);
    if (read.status === 'too-large') return tooLargeAnswer();
    const call = callOf(request, internalUrl, read.body);
    const release = this.searches.take(read.body);
    if (release === undefined) return this.parts.refusals.searchBusy(organizationId, read.body);
    const answer = await this.signedCall(forwarded, call).catch((error: unknown) => {
      // An abort or a failed signature frees the places; the error goes on to MCPServer.
      release();
      throw error;
    });
    if (answer.status === 'restarted') {
      release();
      return this.parts.refusals.restarted(organizationId, read.body, answer.cause);
    }
    // A forward that answers keeps its search places until its answer stream ends.
    forwarded.lifetime.track(answer.ended.then((end) => {
      release();
      if (end === 'failed') this.parts.refusals.streamBrokenOff(organizationId);
    }));
    // A successful forward: the tenant answered. The registry writes last_active_at at most one time a minute.
    if (answer.response.status < 500) this.parts.tenants.recordActive(organizationId);
    return answer.response;
  }

  /** The call with the context that the gateway signs for the access and the bearer token of the request. */
  private async signedCall(forwarded: McpForwardedRequest, call: TenantCall): Promise<TenantAnswer> {
    const context = await this.parts.signer.sign(claimsOf(forwarded.context), forwarded.bearerToken);
    return callTenant({ ...call, headers: tenantHeaders(call.headers, context) }, forwarded.lifetime.signal);
  }
}

// The call before the signature: the target, the method, the headers of the client, and the bytes of the body. The
// tenant serves the same MCP path as the public origin, because it has the same PUBLIC_BASE_URL.
function callOf(request: Request, internalUrl: string, body: ForwardedBody): TenantCall {
  const { pathname, search } = new URL(request.url);
  const call = { target: new URL(`${pathname}${search}`, internalUrl), method: request.method, headers: request.headers };
  return body.bytes === undefined ? call : { ...call, body: body.bytes };
}

function claimsOf(context: RequestContext): AccessContextClaims {
  const { authority, subject, name } = context.user;
  return { authority, subject, ...(name === undefined ? {} : { name }), organizationId: context.organizationId ?? '', grants: context.grants };
}
