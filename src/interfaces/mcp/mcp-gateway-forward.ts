import type { RequestContext } from '../../accounts/identity/access-context.ts';
import type { AccessContextClaims } from '../../accounts/identity/signed-access-context.ts';
import { tenantHeaders } from './mcp-gateway-headers.ts';
import type { GatewayRefusals } from './mcp-gateway-refusals.ts';
import { readForwardedBody, tooLargeAnswer, type ForwardedBody } from './mcp-gateway-request.ts';
import { GatewaySearches } from './mcp-gateway-searches.ts';
import { callTenant, type TenantAnswer, type TenantCall } from './mcp-gateway-stream.ts';
import type { GatewayTenants } from './mcp-gateway-tenants.ts';
import type { McpForwardedRequest } from './mcp-server.ts';

export interface ContextSigner {
  sign(claims: AccessContextClaims, bearerToken: string): Promise<string>;
}

interface ForwardParts {
  readonly signer: ContextSigner;
  readonly tenants: Pick<GatewayTenants, 'recordActive'>;
  readonly refusals: GatewayRefusals;
}

/** The live tenant of a row: its internal address, and the time since the last change of the row. */
export interface LiveTenant {
  readonly internalUrl: string;
  readonly sinceChangeMs: number;
}

export class LiveForward {
  private readonly searches = new GatewaySearches();
  private readonly parts: ForwardParts;

  constructor(parts: ForwardParts) {
    this.parts = parts;
  }

  /**
   * The steps in their order: the body, the search places, the signed call, then the answer. A failed call and a
   * failure before the first answer byte free the places at once; an answer frees them at the end of its stream.
   */
  async forward(request: Request, forwarded: McpForwardedRequest, tenant: LiveTenant): Promise<Response> {
    const organizationId = forwarded.context.organizationId ?? '';
    const read = await readForwardedBody(request, forwarded.lifetime.signal);
    if (read.status === 'too-large') return tooLargeAnswer();
    const call = callOf(request, tenant.internalUrl, read.body);
    const release = this.searches.take(read.body);
    if (release === undefined) return this.parts.refusals.searchBusy(organizationId, read.body);
    const answer = await this.signedCall(forwarded, call).catch((error: unknown) => {
      // An abort or a failed signature frees the places; the error goes on to MCPServer.
      release();
      throw error;
    });
    if (answer.status === 'restarted') {
      release();
      return this.parts.refusals.failedBeforeAnswer(organizationId, read.body, { cause: answer.cause, sinceChangeMs: tenant.sinceChangeMs });
    }
    forwarded.lifetime.track(answer.ended.then((end) => {
      release();
      if (end === 'failed') this.parts.refusals.streamBrokenOff(organizationId);
    }));
    if (answer.response.status < 500) this.parts.tenants.recordActive(organizationId);
    return answer.response;
  }

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
