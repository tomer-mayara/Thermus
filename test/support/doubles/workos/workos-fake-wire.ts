import { hostedRolePermissions } from '../../fixtures/hosted-roles.ts';
import type { FakeAnswer } from './workos-fake-api.ts';
import type { FakeInvitation, FakeMembership, FakeUser, MembershipStatus } from './workos-fake.ts';

export interface ShownMembership extends FakeMembership {
  readonly id: string;
  readonly status: MembershipStatus;
  readonly organizationName: string;
  readonly changes: number;
}

export interface ShownInvitation extends FakeInvitation {
  readonly userId: string | null;
  readonly changes: number;
}

const createdAt = '2026-10-01T08:00:00.000Z';
const firstUpdateTime = Date.parse('2026-10-13T08:00:00.000Z');

function updateTime(changes: number): string {
  return new Date(firstUpdateTime + changes * 1_000).toISOString();
}

export function userJson(user: FakeUser) {
  return {
    object: 'user', id: user.id, email: user.email, email_verified: user.emailVerified ?? true, first_name: user.firstName, last_name: 'Example',
    profile_picture_url: null, last_sign_in_at: null, locale: null, external_id: null, metadata: {},
    created_at: createdAt, updated_at: updateTime(0),
  };
}

export function roleJson(slug: string) {
  return {
    object: 'role', id: `role_01${slug.toUpperCase().replace('-', '')}`, name: slug, slug, description: null,
    permissions: hostedRolePermissions[slug] ?? [], type: 'EnvironmentRole', resource_type_slug: 'organization',
    created_at: createdAt, updated_at: createdAt,
  };
}

export function membershipJson(membership: ShownMembership) {
  const { roles } = membership;
  return {
    object: 'organization_membership', id: membership.id, user_id: membership.userId, organization_id: membership.organizationId,
    organization_name: membership.organizationName, status: membership.status,
    directory_managed: membership.directoryManaged ?? false, role: { slug: roles[0] }, roles: roles.map((slug) => ({ slug })),
    custom_attributes: {}, created_at: createdAt, updated_at: updateTime(membership.changes),
  };
}

export function roleAssignmentJson(membership: ShownMembership, role: string, resourceExternalId: string) {
  const { id: membershipId, organizationId } = membership;
  const changedAt = updateTime(membership.changes);
  return {
    object: 'role_assignment', id: `role_assignment_${membershipId}_${role}`, organization_membership_id: membershipId, role: { slug: role },
    resource: { id: `authz_resource_${organizationId}`, external_id: resourceExternalId, resource_type_slug: 'organization' },
    source: { type: 'direct', group_role_assignment_id: null }, created_at: changedAt, updated_at: changedAt,
  };
}

export function organizationJson(organizationId: string, name: string, externalId: string) {
  return {
    object: 'organization', id: organizationId, name,
    allow_profiles_outside_organization: false, domains: [], external_id: externalId,
    metadata: {}, created_at: createdAt, updated_at: createdAt,
  };
}

export function invitationJson(invitation: ShownInvitation) {
  const changedAt = updateTime(invitation.changes);
  const token = `invitation-token-${invitation.id}`;
  return {
    object: 'invitation', id: invitation.id, email: invitation.email, state: invitation.state,
    accepted_at: invitation.state === 'accepted' ? changedAt : null, revoked_at: invitation.state === 'revoked' ? changedAt : null,
    expires_at: invitation.expiresAt, organization_id: invitation.organizationId, inviter_user_id: null,
    accepted_user_id: invitation.state === 'accepted' ? invitation.userId : null,
    role_slug: invitation.roleSlug, token, accept_invitation_url: `https://authkit.fake.example/invite?invitation_token=${token}`,
    created_at: createdAt, updated_at: changedAt,
  };
}

export function listAnswer(data: readonly unknown[], after: string | null): FakeAnswer {
  return { status: 200, body: { object: 'list', data, list_metadata: { before: null, after } } };
}

export function notFound(message: string): FakeAnswer {
  return { status: 404, body: { code: 'entity_not_found', message } };
}

// WorkOS gives these refusals without an errors list.
export function refusal(code: string, message: string): FakeAnswer {
  return { status: 400, body: { code, message } };
}

export function invalidGrant(description: string): FakeAnswer {
  return { status: 400, body: { error: 'invalid_grant', error_description: description } };
}

export const organizationMembershipNotFound: FakeAnswer = { status: 400, body: { error: 'organization_membership_not_found', error_description: 'No membership.' } };
