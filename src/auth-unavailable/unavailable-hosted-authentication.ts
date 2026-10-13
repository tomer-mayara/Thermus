import type { AccessDecision, AccessResolver, AuthenticatedUser } from '../auth/access-context.ts';
import type { BrowserSession, BrowserSessionState } from '../hosted-admin/browser-session.ts';

const UNAVAILABLE: BrowserSessionState = Object.freeze({ status: 'unavailable' });
const DENIED: AccessDecision = Object.freeze({ allowed: false, reason: 'account-inactive' });

// Holds the place of the hosted WorkOS provider until that provider replaces it in the hosted composition. It reads
// no setting and no request data, and it calls no service. It never gives an identity, a grant, a cookie, or a tenant.
export class UnavailableHostedAuthentication implements BrowserSession, AccessResolver {
  async authenticate(_request: Request): Promise<BrowserSessionState> {
    return UNAVAILABLE;
  }

  async resolve(_user: AuthenticatedUser): Promise<AccessDecision> {
    return DENIED;
  }
}
