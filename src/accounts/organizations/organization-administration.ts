import type { AuthenticatedUser } from '../identity/access-context.ts';
import type { Billing, BillingState } from '../billing/billing.ts';
import { readInvitationOverview, readMemberOverview, type InvitationChange, type InvitationOverview, type MemberOverview } from './administration-overviews.ts';
import { ChangeRecording, type ChangeEntry, type ChangeRecorder, type ChangeResult } from './change-records.ts';
import { managedRole, managedRoles, managesBilling } from './customer-roles.ts';
import { invitationsOf } from './directory-reads.ts';
import type { AssignableRole, InvitationRequest, OrganizationDirectory, OrganizationMembership } from './organization-directory.ts';

// The person who asks for an administration operation.
export interface Actor {
  readonly user: AuthenticatedUser;
}

export interface InvitationSendRequest {
  readonly organizationId: string;
  readonly email: string;
  readonly role: string;
}

export interface InvitationChangeRequest {
  readonly organizationId: string;
  readonly invitationId: string;
}

export type AdministrationRefusal = 'denied';

export interface AuthorizedOrganization {
  readonly organizationId: string;
  readonly organizationName: string;
  // The browser session of the user selected this organization.
  readonly selected: boolean;
}

export interface OrganizationAdministrationOptions {
  readonly directory: OrganizationDirectory;
  readonly records: ChangeRecorder;
  readonly billing: Billing;
  readonly clock?: () => Date;
}

const SEND_RESULTS: ReadonlySet<ChangeResult> = new Set(['applied', 'address-in-use', 'unsupported']);
const UPDATE_RESULTS: ReadonlySet<ChangeResult> = new Set(['applied', 'not-pending', 'unsupported']);

// Customer organization work: the onboarding, listing, and selection of the organizations of the signed-in user, and
// invitations and product member counts. Each operation checks current actor and target state for its organization.
// Each invitation change keeps a record. Billing reads require the current billing permission. The external operator
// sets up organizations and their Admins outside this service.
export class OrganizationAdministration {
  private readonly directory: OrganizationDirectory;
  private readonly changes: ChangeRecording;
  private readonly billing: Billing;

  constructor(options: OrganizationAdministrationOptions) {
    this.directory = options.directory;
    this.changes = new ChangeRecording(options.records, options.clock ?? (() => new Date()));
    this.billing = options.billing;
  }

  // Only active memberships whose grants give at least one application permission, because a default role gives none.
  // An empty list means that the user must accept an invitation or ask the operator: no default organization exists.
  async listOrganizations(user: AuthenticatedUser): Promise<readonly AuthorizedOrganization[]> {
    const memberships = await this.directory.membershipsOf(user);
    return Object.freeze(memberships.filter(isAuthorized).map((membership) => Object.freeze({
      organizationId: membership.organizationId,
      organizationName: membership.organizationName,
      selected: membership.organizationId === user.selectedOrganizationId,
    })));
  }

  // The organization ID comes from the request, so only the current memberships of the user can authorize it.
  async authorizeSelection(user: AuthenticatedUser, organizationId: string): Promise<AuthorizedOrganization | undefined> {
    const organizations = await this.listOrganizations(user);
    return organizations.find((organization) => organization.organizationId === organizationId);
  }

  async memberOverview(actor: Actor, organizationId: string): Promise<MemberOverview | AdministrationRefusal> {
    const managed = await this.managedBy(actor, organizationId);
    return typeof managed === 'string' ? managed : readMemberOverview(this.directory, organizationId);
  }

  async invitationOverview(actor: Actor, organizationId: string): Promise<InvitationOverview | AdministrationRefusal> {
    const managed = await this.managedBy(actor, organizationId);
    return typeof managed === 'string' ? managed : readInvitationOverview(this.directory, organizationId, managed);
  }

  async billingState(actor: Actor, organizationId: string): Promise<BillingState | AdministrationRefusal> {
    const memberships = await this.directory.membershipsOf(actor.user);
    return managesBilling(memberships, organizationId) ? this.billing.stateOf(organizationId) : 'denied';
  }

  // An invitation gives the role that it names. Admin includes product access. The directory owns the acceptance.
  async sendInvitation(actor: Actor, request: InvitationSendRequest): Promise<ChangeResult> {
    const entry: ChangeEntry = { actor: actor.user, organizationId: request.organizationId, target: { email: request.email }, action: 'invite', role: request.role };
    return this.changes.run(entry, async () => {
      const managed = await this.managedBy(actor, request.organizationId);
      if (typeof managed === 'string') return managed;
      const role = managedRole(managed, request.role);
      if (role === undefined) return 'denied';
      const invitation = { organizationId: request.organizationId, email: request.email, role };
      if (await this.isPending(invitation)) return 'unchanged';
      return async () => explicitResult(await this.directory.sendInvitation(invitation), SEND_RESULTS);
    });
  }

  async resendInvitation(actor: Actor, request: InvitationChangeRequest): Promise<ChangeResult> {
    return this.changeInvitation(actor, request, 'resend');
  }

  async revokeInvitation(actor: Actor, request: InvitationChangeRequest): Promise<ChangeResult> {
    return this.changeInvitation(actor, request, 'revoke');
  }

  // A resend or a revoke of a pending invitation of the organization, for a role that the actor manages.
  private async changeInvitation(actor: Actor, request: InvitationChangeRequest, change: InvitationChange): Promise<ChangeResult> {
    const entry: ChangeEntry = { actor: actor.user, organizationId: request.organizationId, target: { invitationId: request.invitationId }, action: `${change}-invitation` };
    return this.changes.run(entry, async () => {
      const managed = await this.managedBy(actor, request.organizationId);
      if (typeof managed === 'string') return managed;
      const invitation = await this.directory.invitation(request.invitationId);
      if (invitation?.organizationId !== request.organizationId) return 'denied';
      entry.role = invitation.role;
      if (managedRole(managed, invitation.role) === undefined) return 'denied';
      if (invitation.state !== 'pending') return 'not-pending';
      const { invitationId } = invitation;
      return async () => explicitResult(await (change === 'resend' ? this.directory.resendInvitation(invitationId) : this.directory.revokeInvitation(invitationId)), UPDATE_RESULTS);
    });
  }

  // A pending invitation to the same address for the same role makes another send unnecessary, also as a retry after
  // an unknown outcome. Providers compare addresses without letter case.
  private async isPending(request: InvitationRequest): Promise<boolean> {
    const pending = await invitationsOf(this.directory, request.organizationId, ['pending']);
    const address = request.email.toLowerCase();
    return pending.some((invitation) => invitation.role === request.role && invitation.email.toLowerCase() === address);
  }

  // The customer roles that the actor manages in the organization now, from a current read of its own memberships.
  // The organization comes from the request; a selected organization of a session authorizes nothing.
  private async managedBy(actor: Actor, organizationId: string): Promise<readonly AssignableRole[] | AdministrationRefusal> {
    const managed = managedRoles(await this.directory.membershipsOf(actor.user), organizationId);
    return managed.length === 0 ? 'denied' : managed;
  }
}

function isAuthorized(membership: OrganizationMembership): boolean {
  return membership.active && membership.grants.some((grant) => grant.permissions.length > 0);
}

// Only an explicit result of the directory counts. Another answer leaves the effect unknown, so the change fails.
function explicitResult(result: unknown, results: ReadonlySet<ChangeResult>): ChangeResult {
  const outcome = typeof result === 'object' && result !== null && 'outcome' in result ? result.outcome : undefined;
  const explicit = [...results].find((candidate) => candidate === outcome);
  if (explicit === undefined) throw new Error('The directory gave no explicit result for the change');
  return explicit;
}
