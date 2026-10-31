import { hostedRolePermissions } from '../../fixtures/hosted-roles.ts';
import type { FakeAnswer, RecordedRequest, WorkOSFakeApi } from './workos-fake-api.ts';
import type { FakeMembership, FakeUser, MembershipStatus } from './workos-fake.ts';
import { listAnswer, membershipJson, notFound, refusal, roleAssignmentJson, roleJson, userJson, type ShownMembership } from './workos-fake-wire.ts';

// What the directory routes read and change in the fake.
export interface DirectoryView {
  memberships: readonly FakeMembership[];
  readonly deletedMembershipIds: Set<string>;
  readonly users: readonly FakeUser[];
  readonly organizationNames: Readonly<Record<string, string>>;
  readonly organizationExternalIds: Readonly<Record<string, string>>;
  readonly membershipPageSize: number;
  readonly membershipPageOverlap: number;
  readonly membershipOutage: FakeAnswer | undefined;
  readonly laterMembershipPageOutage: FakeAnswer | undefined;
  changesOf(index: number): number;
  organizationJson(organizationId: string): unknown;
}

interface RoleAssignmentBody {
  readonly role_slug?: string;
  readonly resource_type_slug?: string;
  readonly resource_external_id?: string;
}

// WorkOS gives the default role to a membership that has no other role.
const defaultRoles: readonly string[] = Object.freeze(['member']);
const membershipsRoute = 'GET /user_management/organization_memberships';
const roleAssignmentsPath = '/authorization/organization_memberships/:id/role_assignments';
const membershipNotFound = notFound('UserOrganizationMembership not found');

export function membershipIdAt(index: number): string {
  return `om_${index}`;
}

export function effectiveRoles(membership: FakeMembership): readonly string[] {
  return membership.roles.length === 0 ? defaultRoles : membership.roles;
}

export function currentStatus(membership: FakeMembership): MembershipStatus {
  return membership.status ?? 'active';
}

// The status and the roles of a membership as one value, so that a change of either shows.
export function grantState(membership: FakeMembership): string {
  return `${currentStatus(membership)}:${effectiveRoles(membership).toSorted().join(',')}`;
}

export function isKnownRole(slug: string | undefined): slug is string {
  return slug !== undefined && Object.hasOwn(hostedRolePermissions, slug);
}

function indexOfId(memberships: readonly FakeMembership[], membershipId: string): number {
  return memberships.findIndex((_membership, index) => membershipIdAt(index) === membershipId);
}

export function indexOfUser(memberships: readonly FakeMembership[], userId: string, organizationId: string): number {
  return memberships.findIndex((membership) => membership.userId === userId && membership.organizationId === organizationId);
}

export function changeMembership(view: { memberships: readonly FakeMembership[] }, index: number, change: Partial<FakeMembership>): void {
  view.memberships = view.memberships.with(index, { ...view.memberships[index], ...change });
}

export function queryOf(request: RecordedRequest): URLSearchParams {
  return new URL(request.path, 'http://fake').searchParams;
}

export function matches(filter: string | null, value: string): boolean {
  return filter === null || filter === value;
}

// The position of the first record after the record of the cursor. It stays a position when that record no longer
// fits the read.
function positionAfter(records: readonly { readonly index: number }[], cursorIndex: number): number {
  const position = records.findIndex(({ index }) => index > cursorIndex);
  return position === -1 ? records.length : position;
}

// The routes of the membership reads and creates, the user reads, the role assignments, and the role lists of the
// organizations of start(). workos-fake-organizations.ts has the organization reads.
export function answerDirectoryRoutes(fake: WorkOSFakeApi, view: DirectoryView, organizations: readonly string[]): void {
  fake.answer(membershipsRoute, (request) => membershipsAnswer(view, request));
  fake.answer('POST /user_management/organization_memberships', (request) => createMembershipAnswer(view, request));
  fake.answerEach(`${membershipsRoute}/:id`, (_request, id) => membershipAnswer(view, id));
  fake.answerEach('DELETE /user_management/organization_memberships/:id', (_request, id) => deleteMembershipAnswer(view, id));
  fake.answerEach('GET /user_management/users/:id', (_request, id) => userAnswer(view, id));
  fake.answerEach(`POST ${roleAssignmentsPath}`, (request, id) => roleAssignmentAnswer(view, request, id));
  fake.answerEach(`DELETE ${roleAssignmentsPath}`, (request, id) => roleAssignmentAnswer(view, request, id));
  for (const organization of organizations) {
    fake.answer(`GET /authorization/organizations/${organization}/roles`, { status: 200, body: { object: 'list', data: Object.keys(hostedRolePermissions).map(roleJson) } });
  }
}

// A read names a user, an organization, or both. Without statuses, WorkOS gives only active memberships. The after
// cursor is the ID of the last membership of the page before; the next page starts after it, less the overlap.
function membershipsAnswer(view: DirectoryView, request: RecordedRequest): FakeAnswer {
  const query = queryOf(request);
  const after = query.get('after');
  if (view.membershipOutage) return view.membershipOutage;
  if (after !== null && view.laterMembershipPageOutage) return view.laterMembershipPageOutage;
  const statuses = (query.get('statuses') ?? 'active').split(',');
  const fitting = view.memberships
    .map((membership, index) => ({ membership, index }))
    .filter(({ index }) => !view.deletedMembershipIds.has(membershipIdAt(index)))
    .filter(({ membership }) => matches(query.get('user_id'), membership.userId) && matches(query.get('organization_id'), membership.organizationId))
    .filter(({ membership }) => statuses.includes(currentStatus(membership)));
  const start = after === null ? 0 : Math.max(0, positionAfter(fitting, indexOfId(view.memberships, after)) - view.membershipPageOverlap);
  const end = start + Math.min(Number(query.get('limit') ?? 10), view.membershipPageSize);
  const next = end < fitting.length ? membershipIdAt(fitting[end - 1].index) : null;
  return listAnswer(fitting.slice(start, end).map(({ index }) => membershipJson(shownMembership(view, index))), next);
}

// WorkOS create reactivates an inactive record. Thus callers cannot use a retry as an absence check.
function createMembershipAnswer(view: DirectoryView, request: RecordedRequest): FakeAnswer {
  const body = request.body as { organization_id: string; user_id: string; role_slug?: string; role_slugs?: string[] };
  const index = indexOfUser(view.memberships, body.user_id, body.organization_id);
  if (index !== -1 && currentStatus(view.memberships[index]) !== 'inactive') return refusal('organization_membership_exists', 'Membership exists.');
  const roles = body.role_slugs ?? [body.role_slug ?? 'member'];
  if (roles.some((role) => !isKnownRole(role))) return refusal('invalid_role', 'The role is invalid.');
  if (index !== -1) changeMembership(view, index, { roles, status: 'active' });
  else view.memberships = [...view.memberships, { userId: body.user_id, organizationId: body.organization_id, roles, status: 'active' }];
  return { status: 201, body: membershipJson(shownMembership(view, index === -1 ? view.memberships.length - 1 : index)) };
}

function membershipAnswer(view: DirectoryView, membershipId: string): FakeAnswer {
  if (view.membershipOutage) return view.membershipOutage;
  if (view.deletedMembershipIds.has(membershipId)) return membershipNotFound;
  const index = indexOfId(view.memberships, membershipId);
  return index === -1 ? membershipNotFound : { status: 200, body: membershipJson(shownMembership(view, index)) };
}

function deleteMembershipAnswer(view: DirectoryView, membershipId: string): FakeAnswer {
  const index = indexOfId(view.memberships, membershipId);
  if (index === -1 || view.deletedMembershipIds.has(membershipId)) return membershipNotFound;
  if (view.memberships[index].directoryManaged === true) {
    return { status: 422, body: { code: 'organization_membership_directory_managed', message: 'The directory manages this membership.' } };
  }
  view.deletedMembershipIds.add(membershipId);
  return { status: 204 };
}

function userAnswer(view: DirectoryView, userId: string): FakeAnswer {
  const user = view.users.find(({ id }) => id === userId);
  return user === undefined ? notFound('User not found') : { status: 200, body: userJson(user) };
}

// A role assignment names one role and the authorization resource of the organization of the membership. A POST
// adds that role and a DELETE removes it. Each other role and the status stay, also on a membership that is not
// active. The resource of an organization with an external ID has only that external ID: WorkOS refuses the
// organization ID of such an organization.
function roleAssignmentAnswer(view: DirectoryView, request: RecordedRequest, membershipId: string): FakeAnswer {
  const index = indexOfId(view.memberships, membershipId);
  const membership = view.memberships[index];
  if (membership === undefined) return membershipNotFound;
  const { role_slug: role, resource_type_slug: resourceType, resource_external_id: resource } = (request.body ?? {}) as RoleAssignmentBody;
  if (resourceType !== 'organization' || resource !== resourceExternalIdOf(view, membership.organizationId)) {
    return notFound(`AuthorizationResource not found: '${resource}'.`);
  }
  if (!isKnownRole(role)) return notFound('Role not found');
  return request.method === 'POST' ? assignRole(view, index, role) : removeRole(view, index, role);
}

// The external ID of the authorization resource of an organization: the external ID of the organization, or its
// organization ID when it has none.
function resourceExternalIdOf(view: DirectoryView, organizationId: string): string {
  return view.organizationExternalIds[organizationId] ?? organizationId;
}

// A second assignment of a role changes nothing and gives the same assignment.
function assignRole(view: DirectoryView, index: number, role: string): FakeAnswer {
  const roles = effectiveRoles(view.memberships[index]);
  if (roles.includes(role)) return { status: 200, body: roleAssignmentJsonAt(view, index, role) };
  changeMembership(view, index, { roles: [...roles, role] });
  return { status: 201, body: roleAssignmentJsonAt(view, index, role) };
}

// When the last role goes, WorkOS gives the default role. A role that the membership does not have changes nothing.
function removeRole(view: DirectoryView, index: number, role: string): FakeAnswer {
  const remaining = effectiveRoles(view.memberships[index]).filter((slug) => slug !== role);
  changeMembership(view, index, { roles: remaining.length === 0 ? defaultRoles : remaining });
  return { status: 204 };
}

function shownMembership(view: DirectoryView, index: number): ShownMembership {
  const membership = view.memberships[index];
  return {
    ...membership, id: membershipIdAt(index), roles: effectiveRoles(membership), status: currentStatus(membership),
    organizationName: view.organizationNames[membership.organizationId] ?? membership.organizationId, changes: view.changesOf(index),
  };
}

function roleAssignmentJsonAt(view: DirectoryView, index: number, role: string) {
  const membership = shownMembership(view, index);
  return roleAssignmentJson(membership, role, resourceExternalIdOf(view, membership.organizationId));
}
