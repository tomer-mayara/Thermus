import type { AccessDecision, AccessResolver, AuthenticatedUser } from '../auth/access-context.ts';
import type { BrowserSession, BrowserSessionState } from '../hosted-admin/browser-session.ts';
import type {
  DirectoryChangeResult,
  DirectoryGrantChange,
  InvitationPageRequest,
  InvitationRequest,
  InvitationSendResult,
  InvitationUpdateResult,
  MemberPageRequest,
  OrganizationDirectory,
  OrganizationInvitation,
  OrganizationMember,
  OrganizationMembership,
  Page,
} from '../organizations/organization-administration.ts';

const UNAVAILABLE: BrowserSessionState = Object.freeze({ status: 'unavailable' });
const DENIED: AccessDecision = Object.freeze({ allowed: false, reason: 'account-inactive' });
const NO_MEMBERSHIPS: readonly OrganizationMembership[] = Object.freeze([]);
const NO_RECORDS: Page<never> = Object.freeze({ items: Object.freeze([]) });
const NO_CHANGE = Object.freeze({ outcome: 'unsupported' });
const MCP_UNAVAILABLE = Object.freeze({ error: 'temporarily_unavailable', error_description: 'Hosted authentication is not available yet.' });

// Stands in for the hosted WorkOS provider, which does not exist yet, so that the hosted edition can start without it.
// It knows no member or invitation and makes no change.
export class UnavailableHostedAuthentication implements BrowserSession, AccessResolver, OrganizationDirectory {
  // It claims no strict address match, because it enforces none.
  readonly invitationIdentityPolicy = 'provider-rules';

  async authenticate(_cookieHeader: string | null): Promise<BrowserSessionState> {
    return UNAVAILABLE;
  }

  async resolve(_user: AuthenticatedUser): Promise<AccessDecision> {
    return DENIED;
  }

  async membershipsOf(_user: AuthenticatedUser): Promise<readonly OrganizationMembership[]> {
    return NO_MEMBERSHIPS;
  }

  async memberPage(_request: MemberPageRequest): Promise<Page<OrganizationMember>> {
    return NO_RECORDS;
  }

  async member(_membershipId: string): Promise<OrganizationMember | undefined> {
    return undefined;
  }

  async changeGrant(_change: DirectoryGrantChange): Promise<DirectoryChangeResult> {
    return NO_CHANGE;
  }

  async invitationPage(_request: InvitationPageRequest): Promise<Page<OrganizationInvitation>> {
    return NO_RECORDS;
  }

  async invitation(_invitationId: string): Promise<OrganizationInvitation | undefined> {
    return undefined;
  }

  async sendInvitation(_request: InvitationRequest): Promise<InvitationSendResult> {
    return NO_CHANGE;
  }

  async resendInvitation(_invitationId: string): Promise<InvitationUpdateResult> {
    return NO_CHANGE;
  }

  async revokeInvitation(_invitationId: string): Promise<InvitationUpdateResult> {
    return NO_CHANGE;
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
