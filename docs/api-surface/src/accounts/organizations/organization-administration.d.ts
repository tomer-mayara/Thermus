import type { AuthenticatedUser } from '../identity/access-context.ts';
import type { Billing, BillingState } from '../billing/billing.ts';
import { type InvitationOverview, type MemberOverview } from './administration-overviews.ts';
import { type ChangeRecorder, type ChangeResult } from './change-records.ts';
import type { OrganizationDirectory } from './organization-directory.ts';
import type { MemberRemovalRequest, RemovalOperationStore, RemovalResult } from './removal-operation-store.ts';
export type { MemberRemovalRequest, RemovalResult } from './removal-operation-store.ts';
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
    readonly selected: boolean;
}
export interface OrganizationAdministrationOptions {
    readonly directory: OrganizationDirectory;
    readonly records: ChangeRecorder;
    readonly billing: Billing;
    readonly clock?: () => Date;
    readonly removalStore?: RemovalOperationStore;
}
export declare class OrganizationAdministration {
    private readonly directory;
    private readonly changes;
    private readonly billing;
    private readonly limit;
    private readonly removals;
    constructor(options: OrganizationAdministrationOptions);
    removeMember(actor: Actor, request: MemberRemovalRequest): Promise<RemovalResult>;
    close(): Promise<void>;
    listOrganizations(user: AuthenticatedUser): Promise<readonly AuthorizedOrganization[]>;
    authorizeSelection(user: AuthenticatedUser, organizationId: string): Promise<AuthorizedOrganization | undefined>;
    memberOverview(actor: Actor, organizationId: string): Promise<MemberOverview | AdministrationRefusal>;
    invitationOverview(actor: Actor, organizationId: string): Promise<InvitationOverview | AdministrationRefusal>;
    billingState(actor: Actor, organizationId: string): Promise<BillingState | AdministrationRefusal>;
    sendInvitation(actor: Actor, request: InvitationSendRequest): Promise<ChangeResult>;
    resendInvitation(actor: Actor, request: InvitationChangeRequest): Promise<ChangeResult>;
    revokeInvitation(actor: Actor, request: InvitationChangeRequest): Promise<ChangeResult>;
    private changeInvitation;
    private managedBy;
}
