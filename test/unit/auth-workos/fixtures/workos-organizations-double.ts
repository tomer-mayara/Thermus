import assert from 'node:assert/strict';
import {
  GenericServerException,
  NotFoundException,
  type AssignRoleOptions,
  type ListInvitationsOptions,
  type ListOrganizationMembershipsOptions,
  type OrganizationMembershipStatus,
  type RemoveRoleOptions,
  type SendInvitationOptions,
} from '@workos-inc/node';
import { HostedRoleConfigurationError } from '../../../../src/accounts/providers/workos/hosted-role-mapping.ts';
import { WorkOSOrganizations } from '../../../../src/accounts/providers/workos/workos-organizations.ts';

export interface MembershipRecord {
  readonly id: string;
  readonly userId: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly status: OrganizationMembershipStatus;
  readonly updatedAt: string;
  readonly directoryManaged?: unknown;
  readonly roles?: readonly { readonly slug: string }[];
}

export interface InvitationRecord {
  readonly id: string;
  readonly email: string;
  readonly state: 'pending' | 'accepted' | 'revoked' | 'expired';
  readonly expiresAt: string;
  readonly organizationId: string | null;
  readonly roleSlug: string | null;
  readonly token: string;
  readonly acceptInvitationUrl: string;
}

export interface RoleRecord {
  readonly slug: string;
  readonly permissions: readonly string[];
}

export interface OrganizationRecord {
  readonly id: string;
  readonly externalId: string | null;
}

export interface SdkCall {
  readonly method: string;
  readonly input: unknown;
}

interface ListAnswer<T> {
  readonly data: readonly T[];
  readonly after: string | null;
}

type InvitationChange = 'sendInvitation' | 'resendInvitation' | 'revokeInvitation';

const authority = 'workos:client_test';
export const acme = 'org_01ACME';
export const globex = 'org_02GLOBEX';
// The external ID of Acme, as each customer organization of the operator runbook has one. Globex has none.
export const acmeExternalId = 'customer-acme';
export const now = new Date('2026-10-14T12:00:00.000Z');

export function stagingRoles(): RoleRecord[] {
  return [
    { slug: 'member', permissions: [] },
    { slug: 'user', permissions: ['product:access'] },
    { slug: 'admin', permissions: ['product:access', 'user-grants:manage', 'admin-grants:manage', 'billing:manage'] },
    { slug: 'super-admin', permissions: [] },
  ];
}

export function roles(...slugs: string[]): { readonly slug: string }[] {
  return slugs.map((slug) => ({ slug }));
}

export function membership(changes: Partial<MembershipRecord> = {}): MembershipRecord {
  return {
    id: 'om_01ALICE',
    userId: 'user_01ALICE',
    organizationId: acme,
    organizationName: 'Acme',
    status: 'active',
    updatedAt: '2026-10-14T08:00:00.000Z',
    directoryManaged: false,
    roles: roles('user'),
    ...changes,
  };
}

export function invitation(changes: Partial<InvitationRecord> = {}): InvitationRecord {
  return {
    id: 'invitation_01BOB',
    email: 'bob@example.com',
    state: 'pending',
    expiresAt: '2026-10-21T12:00:00.000Z',
    organizationId: acme,
    roleSlug: 'user',
    token: 'invitation-token-of-bob',
    acceptInvitationUrl: 'https://auth.example/invite?invitation_token=invitation-token-of-bob',
    ...changes,
  };
}

export function notFound(): NotFoundException {
  return new NotFoundException({ code: 'entity_not_found', message: 'The entity was not found.', path: '/user_management/entity', requestID: 'request_01' });
}

export function refusal(code: string, status = 400): GenericServerException {
  return new GenericServerException(status, `WorkOS refused the request with ${code}.`, { code, message: `WorkOS refused the request with ${code}.` }, 'request_01');
}

export class WorkOSOrganizationsDouble {
  readonly calls: SdkCall[] = [];
  readonly memberships = new Map<string, MembershipRecord>();
  readonly emails = new Map<string, string>();
  readonly invitations = new Map<string, InvitationRecord>();
  membershipList: ListAnswer<MembershipRecord> = { data: [], after: null };
  invitationList: ListAnswer<InvitationRecord> = { data: [], after: null };
  organizationRoles: readonly RoleRecord[] = stagingRoles();
  readonly organizationRecords = new Map<string, OrganizationRecord>([
    [acme, { id: acme, externalId: acmeExternalId }],
    [globex, { id: globex, externalId: null }],
  ]);
  readonly changeAnswers = new Map<InvitationChange, InvitationRecord>();
  // A failure for each method name. The double records the call before it fails.
  readonly failures = new Map<string, Error>();

  readonly userManagement = {
    listOrganizationMemberships: async (options: ListOrganizationMembershipsOptions) => this.answer('listOrganizationMemberships', options, () => listOf(this.membershipList)),
    deleteOrganizationMembership: async (id: string): Promise<void> => this.answer('deleteOrganizationMembership', id, () => { this.memberships.delete(id); }),
    getOrganizationMembership: async (id: string) => this.answer('getOrganizationMembership', id, () => this.memberships.get(id) ?? missing()),
    getUser: async (userId: string) => this.answer('getUser', userId, () => ({ email: this.emails.get(userId) ?? missing() })),
    listInvitations: async (options: ListInvitationsOptions) => this.answer('listInvitations', options, () => listOf(this.invitationList)),
    getInvitation: async (id: string) => this.answer('getInvitation', id, () => this.invitations.get(id) ?? missing()),
    sendInvitation: async (options: SendInvitationOptions) => this.answer('sendInvitation', options, () => this.changeAnswers.get('sendInvitation') ?? sent(options)),
    resendInvitation: async (id: string) => this.answer('resendInvitation', id, () => this.changeAnswers.get('resendInvitation') ?? this.invitations.get(id) ?? missing()),
    revokeInvitation: async (id: string) => this.answer('revokeInvitation', id, () => this.changeAnswers.get('revokeInvitation') ?? this.revoked(id)),
  };

  readonly authorization = {
    listOrganizationRoles: async (organizationId: string) => this.answer('listOrganizationRoles', organizationId, () => ({ object: 'list' as const, data: this.organizationRoles })),
    assignRole: async (options: AssignRoleOptions) => this.answer('assignRole', options, () => this.changeRole(options.organizationMembershipId, options.roleSlug, 'add')),
    removeRole: async (options: RemoveRoleOptions) => this.answer('removeRole', options, () => this.changeRole(options.organizationMembershipId, options.roleSlug, 'remove')),
  };

  readonly organizations = {
    getOrganization: async (id: string) => this.answer('getOrganization', id, () => this.organizationRecords.get(id) ?? missing()),
  };

  directory(clock: () => Date = () => new Date(now)): WorkOSOrganizations {
    const { userManagement, authorization } = this;
    return new WorkOSOrganizations({ authority, memberships: userManagement, userManagement, authorization, clock });
  }

  methods(): string[] {
    return this.calls.map(({ method }) => method);
  }

  roleSlugsOf(membershipId: string): string[] {
    return (this.memberships.get(membershipId)?.roles ?? []).map(({ slug }) => slug);
  }

  private async answer<T>(method: string, input: unknown, give: () => T): Promise<T> {
    this.calls.push({ method, input });
    const failure = this.failures.get(method);
    if (failure !== undefined) throw failure;
    return give();
  }

  private revoked(id: string): InvitationRecord {
    const revoked = { ...(this.invitations.get(id) ?? missing()), state: 'revoked' as const };
    this.invitations.set(id, revoked);
    return revoked;
  }

  // WorkOS keeps each other role. A write that adds a role that the membership has, or removes one that it does not
  // have, changes nothing, also not the update time.
  private changeRole(membershipId: string, role: string, change: 'add' | 'remove'): void {
    const record = this.memberships.get(membershipId) ?? missing();
    const slugs = new Set((record.roles ?? []).map(({ slug }) => slug));
    if (slugs.has(role) === (change === 'add')) return;
    if (change === 'add') slugs.add(role);
    else slugs.delete(role);
    const updatedAt = new Date(Date.parse(record.updatedAt) + 1_000).toISOString();
    this.memberships.set(membershipId, { ...record, roles: roles(...slugs), updatedAt });
  }
}

// A failed directory call that is not a configuration error names no user ID, no email address, and no invitation
// credential, so that a report of the failure holds none.
export async function assertWorkOSFailure(work: Promise<unknown>, message: RegExp): Promise<void> {
  await assert.rejects(work, (error: unknown) => {
    assert.ok(error instanceof Error && !(error instanceof HostedRoleConfigurationError), String(error));
    assert.match(error.message, message);
    assert.doesNotMatch(error.message, /user_0|@|invitation-token|invitation_token/);
    return true;
  });
}

export async function assertConfigurationError(work: Promise<unknown>, ...parts: RegExp[]): Promise<void> {
  await assert.rejects(work, (error: unknown) => {
    assert.ok(error instanceof HostedRoleConfigurationError, String(error));
    for (const part of parts) assert.match(error.message, part);
    return true;
  });
}

function listOf<T>(list: ListAnswer<T>) {
  return { object: 'list' as const, data: list.data, listMetadata: { before: null, after: list.after } };
}

function sent(options: SendInvitationOptions): InvitationRecord {
  return invitation({ id: 'invitation_02SENT', email: options.email, organizationId: options.organizationId ?? null, roleSlug: options.roleSlug ?? null });
}

function missing(): never {
  throw notFound();
}
