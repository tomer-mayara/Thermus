import type { AuthenticatedUser } from '../../../../src/auth/access-context.ts';
import type { BillingState } from '../../../../src/billing/billing.ts';
import type { OrganizationService } from '../../../../src/hosted-admin/account-routes.ts';
import type { InvitationOverview, MemberOverview } from '../../../../src/organizations/administration-overviews.ts';
import type { ChangeResult } from '../../../../src/organizations/change-records.ts';
import type {
  Actor,
  AdministrationRefusal,
  AuthorizedOrganization,
  GrantChangeRequest,
  InvitationChangeRequest,
  InvitationSendRequest,
} from '../../../../src/organizations/organization-administration.ts';

export type ConfiguredOrganizations = readonly AuthorizedOrganization[] | Error;

export interface SelectionCheck {
  readonly user: AuthenticatedUser;
  readonly organizationId: string;
}

export interface AdministrationSetup {
  readonly members?: MemberOverview | AdministrationRefusal | Error;
  readonly invitations?: InvitationOverview | AdministrationRefusal | Error;
  readonly change?: ChangeResult | Error;
  readonly billing?: BillingState | AdministrationRefusal | Error;
}

export interface AdministrationCall {
  readonly operation: string;
  readonly actor: Actor;
  readonly request: string | GrantChangeRequest | InvitationSendRequest | InvitationChangeRequest;
}

export class OrganizationAdministrationDouble implements OrganizationService {
  readonly lists: AuthenticatedUser[] = [];
  readonly selections: SelectionCheck[] = [];
  readonly administrationCalls: AdministrationCall[] = [];
  private readonly organizations: ReadonlyMap<string, ConfiguredOrganizations>;
  private readonly administration: AdministrationSetup;

  constructor(organizations: ReadonlyMap<string, ConfiguredOrganizations> = new Map(), administration: AdministrationSetup = {}) {
    this.organizations = organizations;
    this.administration = administration;
  }

  async listOrganizations(user: AuthenticatedUser): Promise<readonly AuthorizedOrganization[]> {
    this.lists.push(user);
    return this.configuredFor(user);
  }

  async authorizeSelection(user: AuthenticatedUser, organizationId: string): Promise<AuthorizedOrganization | undefined> {
    this.selections.push({ user, organizationId });
    return this.configuredFor(user).find((organization) => organization.organizationId === organizationId);
  }

  async memberOverview(actor: Actor, organizationId: string): Promise<MemberOverview | AdministrationRefusal> {
    return this.answer({ operation: 'memberOverview', actor, request: organizationId }, this.administration.members ?? 'denied');
  }

  async invitationOverview(actor: Actor, organizationId: string): Promise<InvitationOverview | AdministrationRefusal> {
    return this.answer({ operation: 'invitationOverview', actor, request: organizationId }, this.administration.invitations ?? 'denied');
  }

  async changeGrant(actor: Actor, request: GrantChangeRequest): Promise<ChangeResult> {
    return this.answer({ operation: 'changeGrant', actor, request }, this.administration.change ?? 'applied');
  }

  async sendInvitation(actor: Actor, request: InvitationSendRequest): Promise<ChangeResult> {
    return this.answer({ operation: 'sendInvitation', actor, request }, this.administration.change ?? 'applied');
  }

  async resendInvitation(actor: Actor, request: InvitationChangeRequest): Promise<ChangeResult> {
    return this.answer({ operation: 'resendInvitation', actor, request }, this.administration.change ?? 'applied');
  }

  async revokeInvitation(actor: Actor, request: InvitationChangeRequest): Promise<ChangeResult> {
    return this.answer({ operation: 'revokeInvitation', actor, request }, this.administration.change ?? 'applied');
  }

  async billingState(actor: Actor, organizationId: string): Promise<BillingState | AdministrationRefusal> {
    return this.answer({ operation: 'billingState', actor, request: organizationId }, this.administration.billing ?? 'denied');
  }

  private answer<T>(call: AdministrationCall, configured: T | Error): T {
    this.administrationCalls.push(call);
    if (configured instanceof Error) throw configured;
    return configured;
  }

  private configuredFor(user: AuthenticatedUser): readonly AuthorizedOrganization[] {
    const configured = this.organizations.get(user.subject) ?? [];
    if (configured instanceof Error) throw configured;
    return configured;
  }
}
