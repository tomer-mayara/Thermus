import type { RequestContext } from '../../accounts/identity/access-context.ts';
import type { AccessContextClaims } from '../../accounts/identity/signed-access-context.ts';
import { tenantHeaders } from './mcp-gateway-headers.ts';
import type { GatewayRefusals } from './mcp-gateway-refusals.ts';
import { readForwardedBody, tooLargeAnswer } from './mcp-gateway-request.ts';
import { GatewaySearches } from './mcp-gateway-searches.ts';
import { callTenant, type TenantAnswer } from './mcp-gateway-stream.ts';
import type { GatewayTenants } from './mcp-gateway-tenants.ts';
import type { McpForwardedRequest } from './mcp-server.ts';

/** Signs the access context of one request. Only the control plane holds the private key. */
export interface ContextSigner {
  sign(claims: AccessContextClaims, bearerToken: string): Promise<string>;
}

/**
 * The forward of a request to a live tenant: the body within the SDK limit, the search places, the signed context,
 * the call, and the answer stream. The search places of a request stay taken until its answer stream ends.
 */
export class LiveForward {
  private readonly searches = new GatewaySearches();

  constructor(private readonly parts: { readonly signer: ContextSigner; readonly tenants: Pick<GatewayTenants, 'recordActive'>; readonly refusals: GatewayRefusals }) {}

  async forward(request: Request, forwarded: McpForwardedRequest, internalUrl: string): Promise<Response> {
    const organizationId = forwarded.context.organizationId ?? '';
    const read = await readForwardedBody(request, forwarded.lifetime.signal);
    if (read.status === 'too-large') return tooLargeAnswer();
    const release = this.searches.take(read.body);
    if (release === undefined) return this.parts.refusals.searchBusy(organizationId, read.body);
    let answer: TenantAnswer;
    try {
      const context = await this.parts.signer.sign(claimsOf(forwarded.context), forwarded.bearerToken);
      const call = { target: targetOf(request, internalUrl), method: request.method, headers: tenantHeaders(request.headers, context) };
      answer = await callTenant(read.body.bytes === undefined ? call : { ...call, body: read.body.bytes }, forwarded.lifetime.signal);
    } catch (error) {
      release();
      throw error;
    }
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
}

// The tenant serves the same MCP path as the public origin, because it has the same PUBLIC_BASE_URL.
function targetOf(request: Request, internalUrl: string): URL {
  const { pathname, search } = new URL(request.url);
  return new URL(`${pathname}${search}`, internalUrl);
}

function claimsOf(context: RequestContext): AccessContextClaims {
  const { authority, subject, name } = context.user;
  return { authority, subject, ...(name === undefined ? {} : { name }), organizationId: context.organizationId ?? '', grants: context.grants };
}
