import type { AccessDecision, AccessResolver, AuthenticatedUser } from '../auth/access-context.ts';
import type { BrowserSession, BrowserSessionState } from '../hosted-admin/browser-session.ts';

const UNAVAILABLE: BrowserSessionState = Object.freeze({ status: 'unavailable' });
const DENIED: AccessDecision = Object.freeze({ allowed: false, reason: 'account-inactive' });
const MCP_UNAVAILABLE = Object.freeze({ error: 'temporarily_unavailable', error_description: 'Hosted authentication is not available yet.' });

// Stands in for the hosted WorkOS provider, which does not exist yet, so that the hosted edition can start without it.
export class UnavailableHostedAuthentication implements BrowserSession, AccessResolver {
  async authenticate(_cookieHeader: string | null): Promise<BrowserSessionState> {
    return UNAVAILABLE;
  }

  async resolve(_user: AuthenticatedUser): Promise<AccessDecision> {
    return DENIED;
  }
}

// A Bearer challenge would send MCP clients to an authorization server that does not exist, so each MCP request,
// also one without a credential, gets this answer.
export class UnavailableMcpEndpoint {
  async fetch(_request: Request): Promise<Response> {
    return Response.json(MCP_UNAVAILABLE, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }

  async close(): Promise<void> {}
}
