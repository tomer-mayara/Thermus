import type { TestContext } from 'node:test';
import { createRemoteJWKSet } from 'jose';
import type { WorkOSConnection } from '../../../../src/hosted-workos-application.ts';
import type { WorkOSSettings } from '../../../../src/auth/hosted-auth/workos/workos-settings.ts';
import { nowInSeconds, SigningKey } from './jwt-signing-key.ts';
import { cookiePassword, fakeApiKey, fakeClientId, WorkOSFakeApi, workosClientFor, type FakeAnswer, type RecordedRequest } from './workos-fake-api.ts';

export interface FakeUser {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  // False for a user that an invitation made. Without a value, the address is verified.
  readonly emailVerified?: boolean;
}

export interface FakeMembership {
  readonly userId: string;
  readonly organizationId: string;
  // WorkOS shows a membership without a role with the default role member.
  readonly roles: readonly string[];
  readonly status?: 'active' | 'inactive' | 'pending';
  readonly directoryManaged?: boolean;
}

export interface FakeInvitation {
  readonly id: string;
  readonly email: string;
  readonly organizationId: string;
  readonly roleSlug: string;
  readonly state: 'pending' | 'accepted' | 'revoked' | 'expired';
  // An ISO 8601 time. WorkOS can keep the state pending after this time.
  readonly expiresAt: string;
}

type MembershipStatus = NonNullable<FakeMembership['status']>;

interface FakeSession {
  readonly user: FakeUser;
  organizationId: string | undefined;
  ended: boolean;
}

interface RoleAssignmentBody {
  readonly role_slug?: string;
  readonly resource_type_slug?: string;
  readonly resource_external_id?: string;
}

interface InvitationBody {
  readonly email?: string;
  readonly organization_id?: string;
  readonly role_slug?: string;
}

// The roles of the hosted role mapping, as the staging environment defines them.
const environmentRoles: Readonly<Record<string, readonly string[]>> = {
  user: ['product:access'],
  admin: ['user-grants:manage'],
  'super-admin': ['admin-grants:manage', 'billing:manage'],
  member: [],
};
// WorkOS gives the default role to a membership that has no other role.
const defaultRoles: readonly string[] = Object.freeze(['member']);
const membershipsRoute = 'GET /user_management/organization_memberships';
const authenticateRoute = 'POST /user_management/authenticate';
const roleAssignmentsPath = '/authorization/organization_memberships/:id/role_assignments';
const invitationsPath = '/user_management/invitations';
const createdAt = '2026-10-01T08:00:00.000Z';
const firstUpdateTime = Date.parse('2026-10-13T08:00:00.000Z');
const invitationLifetimeMs = 7 * 24 * 60 * 60 * 1_000;
const membershipNotFound = notFound('UserOrganizationMembership not found');
const invitationNotFound = notFound('Invite not found');
const organizationNotFound = notFound('Organization not found');
const resendRefusals: Readonly<Record<FakeInvitation['state'], FakeAnswer | undefined>> = {
  pending: undefined,
  accepted: refusal('invite_accepted', 'Invite has already been accepted.'),
  revoked: refusal('invite_revoked', 'Invite has been revoked.'),
  expired: refusal('invite_expired', 'Invite has expired.'),
};
const mcpClientId = 'client_01MCPCLIENT';

function userJson(user: FakeUser) {
  return {
    object: 'user', id: user.id, email: user.email, email_verified: user.emailVerified ?? true, first_name: user.firstName, last_name: 'Example',
    profile_picture_url: null, last_sign_in_at: null, locale: null, external_id: null, metadata: {},
    created_at: createdAt, updated_at: updateTime(0),
  };
}

function roleJson(slug: string) {
  return {
    object: 'role', id: `role_01${slug.toUpperCase().replace('-', '')}`, name: slug, slug, description: null,
    permissions: environmentRoles[slug] ?? [], type: 'EnvironmentRole', resource_type_slug: 'organization',
    created_at: createdAt, updated_at: createdAt,
  };
}

function matches(filter: string | null, value: string): boolean {
  return filter === null || filter === value;
}

// Each change gives a later update time: one second after the time before.
function updateTime(changes: number): string {
  return new Date(firstUpdateTime + changes * 1_000).toISOString();
}

function membershipIdAt(index: number): string {
  return `om_${index}`;
}

function effectiveRoles(membership: FakeMembership): readonly string[] {
  return membership.roles.length === 0 ? defaultRoles : membership.roles;
}

function currentStatus(membership: FakeMembership): MembershipStatus {
  return membership.status ?? 'active';
}

// The status and the roles of a membership as one value, so that a change of either shows.
function grantState(membership: FakeMembership): string {
  return `${currentStatus(membership)}:${effectiveRoles(membership).toSorted().join(',')}`;
}

// A pending invitation whose expiry time has passed is expired, also when WorkOS still gives the state pending.
function currentState(invitation: FakeInvitation): FakeInvitation['state'] {
  return invitation.state === 'pending' && Date.parse(invitation.expiresAt) <= Date.now() ? 'expired' : invitation.state;
}

function sameAddress(first: string, second: string): boolean {
  return first.toLowerCase() === second.toLowerCase();
}

function isKnownRole(slug: string | undefined): slug is string {
  return slug !== undefined && Object.hasOwn(environmentRoles, slug);
}

// The position of the first record after the record of the cursor. It stays a position when that record no longer
// fits the read.
function positionAfter(records: readonly { readonly index: number }[], cursorIndex: number): number {
  const position = records.findIndex(({ index }) => index > cursorIndex);
  return position === -1 ? records.length : position;
}

function queryOf(request: RecordedRequest): URLSearchParams {
  return new URL(request.path, 'http://fake').searchParams;
}

function listAnswer(data: readonly unknown[], after: string | null): FakeAnswer {
  return { status: 200, body: { object: 'list', data, list_metadata: { before: null, after } } };
}

function notFound(message: string): FakeAnswer {
  return { status: 404, body: { code: 'entity_not_found', message } };
}

// WorkOS gives these refusals without an errors list.
function refusal(code: string, message: string): FakeAnswer {
  return { status: 400, body: { code, message } };
}

// A local WorkOS environment for the offline tests of the hosted WorkOS composition: a fake WorkOS API with
// organizations, users, memberships, the hosted roles, role assignments, invitations, browser sign-ins and refreshes,
// and AuthKit-signed Connect tokens. The membership at index i of memberships has the ID om_i. The fake knows the
// organizations of start() and of organizationNames. The answers follow what WorkOS staging showed; the design document
// gives these findings.
export class WorkOSFake {
  readonly fake: WorkOSFakeApi;
  readonly browserKey: SigningKey;
  readonly authkitKey: SigningKey;
  readonly settings: WorkOSSettings;
  readonly mcpResourceUrl: string;
  // The users that the user reads give. A send to an unknown address adds an unverified user.
  users: readonly FakeUser[] = [];
  // The invitations of all organizations, in the order of the invitation pages. The JSON of each has a fake token
  // "invitation-token-<ID>" and a link on authkit.fake.example, so that a test can check that they never show.
  invitations: readonly FakeInvitation[] = [];
  // The name of each organization in the membership answers. An organization without a name here has its ID as name.
  organizationNames: Readonly<Record<string, string>> = {};
  // The external ID of each organization. An organization without an entry here has none. WorkOS names the
  // authorization resource of an organization by its external ID, and by its organization ID only when it has none.
  organizationExternalIds: Readonly<Record<string, string>> = {};
  // The most records on one page. WorkOS gives at most the limit of the read, and it can give fewer.
  membershipPageSize = 100;
  invitationPageSize = 100;
  // Each next membership page starts with this many records from the end of the page before, as WorkOS can give
  // during concurrent changes.
  membershipPageOverlap = 0;
  // The authentication method of each new sign-in. In the staging environment, only 'Password' is MFA evidence.
  authenticationMethod = 'Password';
  // Set to an answer, such as a 500, to make reads fail: each membership read, only the membership pages after the
  // first, each invitation read, or the refreshes.
  membershipOutage: FakeAnswer | undefined;
  laterMembershipPageOutage: FakeAnswer | undefined;
  invitationOutage: FakeAnswer | undefined;
  refreshOutage: FakeAnswer | undefined;
  // The organizations of start().
  readonly #organizations: ReadonlySet<string>;
  #memberships: readonly FakeMembership[] = [];
  // The number of changes of the roles or the status of each membership, by index, and of each invitation, by ID.
  // The update times come from them.
  readonly #membershipChanges: number[] = [];
  readonly #invitationChanges = new Map<string, number>();
  readonly #sessions = new Map<string, FakeSession>();
  readonly #codes = new Map<string, FakeSession>();
  #accessTokenLifetime = 300;
  #counter = 0;

  private constructor(parts: { fake: WorkOSFakeApi; browserKey: SigningKey; authkitKey: SigningKey; publicBaseUrl: string; organizations: readonly string[] }) {
    this.fake = parts.fake;
    this.browserKey = parts.browserKey;
    this.authkitKey = parts.authkitKey;
    this.#organizations = new Set(parts.organizations);
    this.mcpResourceUrl = new URL('mcp', parts.publicBaseUrl).href;
    this.settings = Object.freeze({
      apiKey: fakeApiKey,
      clientId: fakeClientId,
      authkitIssuer: parts.fake.authkitIssuer,
      redirectUri: new URL('callback', parts.publicBaseUrl).href,
      cookiePassword,
    });
    this.fake.answer(membershipsRoute, (request) => this.membershipsAnswer(request));
    this.fake.answer(authenticateRoute, (request) => this.authenticateAnswer(request));
    this.answerAdministration();
  }

  static async start(t: TestContext, publicBaseUrl: string, organizations: readonly string[]): Promise<WorkOSFake> {
    const fake = await WorkOSFakeApi.start(t);
    const [browserKey, authkitKey] = await Promise.all([SigningKey.generate('browser-key-1'), SigningKey.generate('authkit-key-1')]);
    fake.browserKeySet.publish(browserKey);
    fake.authkitKeySet.publish(authkitKey);
    const world = new WorkOSFake({ fake, browserKey, authkitKey, publicBaseUrl, organizations });
    for (const organization of organizations) {
      fake.answer(`GET /authorization/organizations/${organization}/roles`, { status: 200, body: { object: 'list', data: Object.keys(environmentRoles).map(roleJson) } });
    }
    return world;
  }

  get memberships(): readonly FakeMembership[] {
    return this.#memberships;
  }

  // A replacement keeps the ID of each index. A membership whose roles or status change gets a later update time, as
  // after a change in WorkOS.
  set memberships(memberships: readonly FakeMembership[]) {
    memberships.forEach((membership, index) => {
      const before = this.#memberships[index];
      if (before !== undefined && grantState(before) !== grantState(membership)) this.#membershipChanges[index] = this.changesOf(index) + 1;
    });
    this.#memberships = memberships;
  }

  connection(): WorkOSConnection {
    return { settings: this.settings, workos: workosClientFor(this.fake), authkitKeySet: createRemoteJWKSet(this.fake.authkitKeySetUrl) };
  }

  // Makes an authorization code as AuthKit gives it after the sign-in, the MFA step, and the organization choice.
  codeFor(user: FakeUser, organizationId?: string): string {
    const code = `code_${(this.#counter += 1)}`;
    this.#codes.set(code, { user, organizationId, ended: false });
    return code;
  }

  // Lets each next access token expire at once, so the next request needs a refresh.
  expireAccessTokens(): void {
    this.#accessTokenLifetime = -60;
  }

  endSessionsOf(user: FakeUser): void {
    for (const session of this.#sessions.values()) if (session.user.id === user.id) session.ended = true;
  }

  connectToken(user: FakeUser, claims: Readonly<Record<string, unknown>> = {}): Promise<string> {
    return this.authkitKey.sign({ sub: user.id, client_id: mcpClientId, sid: `app_consent_${user.id}`, scope: 'email offline_access openid profile', jti: `jti_${(this.#counter += 1)}`, ...claims }, {
      issuer: this.fake.authkitIssuer,
      audience: this.mcpResourceUrl,
      expiresAtUnixSeconds: nowInSeconds() + 300,
    });
  }

  browserToken(user: FakeUser, organizationId?: string): Promise<string> {
    return this.browserKey.sign({ sub: user.id, sid: `session_${user.id}`, client_id: fakeClientId, ...(organizationId === undefined ? {} : { org_id: organizationId }) }, {
      issuer: this.fake.browserIssuer,
      expiresAtUnixSeconds: nowInSeconds() + this.#accessTokenLifetime,
    });
  }

  // The ID, the roles, and the status of the membership of the user in the organization. Each fails without it.
  membershipId(user: FakeUser, organizationId: string): string {
    return membershipIdAt(this.requiredIndex(user, organizationId));
  }

  rolesOf(user: FakeUser, organizationId: string): readonly string[] {
    return effectiveRoles(this.#memberships[this.requiredIndex(user, organizationId)]);
  }

  statusOf(user: FakeUser, organizationId: string): MembershipStatus {
    return currentStatus(this.#memberships[this.requiredIndex(user, organizationId)]);
  }

  // Changes a membership as someone else does in WorkOS. A change gives a later update time.
  setRoles(user: FakeUser, organizationId: string, roles: readonly string[]): void {
    this.changeMembership(this.requiredIndex(user, organizationId), { roles });
  }

  setStatus(user: FakeUser, organizationId: string, status: MembershipStatus): void {
    this.changeMembership(this.requiredIndex(user, organizationId), { status });
  }

  // Accepts an invitation as AuthKit does: the membership of its address in its organization becomes active with only
  // the role of the invitation, and the invitation becomes accepted.
  acceptInvitation(invitationId: string): void {
    const invitation = this.requiredInvitation(invitationId);
    if (currentState(invitation) !== 'pending') throw new Error(`The invitation ${invitationId} is not pending`);
    this.putMembershipOf(invitation, { roles: [this.roleSlugOf(invitation)], status: 'active' });
    this.changeInvitation(invitation, { state: 'accepted' });
  }

  // Moves the expiry time of an invitation into the past and keeps the state pending, so that a reader must compare
  // the expiry time.
  expireInvitation(invitationId: string): void {
    const invitation = this.requiredInvitation(invitationId);
    const expired = { ...invitation, expiresAt: new Date(Date.now() - 60_000).toISOString() };
    this.invitations = this.invitations.map((each) => (each === invitation ? expired : each));
  }

  // The routes of the member and organization reads, the role assignments, and the invitations of the organization
  // administration.
  private answerAdministration(): void {
    const { fake } = this;
    fake.answerEach(`${membershipsRoute}/:id`, (_request, id) => this.membershipAnswer(id));
    fake.answerEach('GET /user_management/users/:id', (_request, id) => this.userAnswer(id));
    fake.answerEach('GET /organizations/:id', (_request, id) => this.organizationAnswer(id));
    fake.answerEach(`POST ${roleAssignmentsPath}`, (request, id) => this.roleAssignmentAnswer(request, id));
    fake.answerEach(`DELETE ${roleAssignmentsPath}`, (request, id) => this.roleAssignmentAnswer(request, id));
    fake.answer(`GET ${invitationsPath}`, (request) => this.invitationsAnswer(request));
    fake.answer(`POST ${invitationsPath}`, (request) => this.sendAnswer(request));
    fake.answerEach(`GET ${invitationsPath}/:id`, (_request, id) => this.invitationAnswer(id));
    fake.answerEach(`POST ${invitationsPath}/:id/resend`, (_request, id) => this.resendAnswer(id));
    fake.answerEach(`POST ${invitationsPath}/:id/revoke`, (_request, id) => this.revokeAnswer(id));
  }

  // A read names a user, an organization, or both. Without statuses, WorkOS gives only active memberships. The after
  // cursor is the ID of the last membership of the page before; the next page starts after it, less the overlap.
  private membershipsAnswer(request: RecordedRequest): FakeAnswer {
    const query = queryOf(request);
    const after = query.get('after');
    if (this.membershipOutage) return this.membershipOutage;
    if (after !== null && this.laterMembershipPageOutage) return this.laterMembershipPageOutage;
    const statuses = (query.get('statuses') ?? 'active').split(',');
    const fitting = this.#memberships
      .map((membership, index) => ({ membership, index }))
      .filter(({ membership }) => matches(query.get('user_id'), membership.userId) && matches(query.get('organization_id'), membership.organizationId))
      .filter(({ membership }) => statuses.includes(currentStatus(membership)));
    const start = after === null ? 0 : Math.max(0, positionAfter(fitting, this.indexOfId(after)) - this.membershipPageOverlap);
    const end = start + Math.min(Number(query.get('limit') ?? 10), this.membershipPageSize);
    const next = end < fitting.length ? membershipIdAt(fitting[end - 1].index) : null;
    return listAnswer(fitting.slice(start, end).map(({ index }) => this.membershipJson(index)), next);
  }

  private membershipAnswer(membershipId: string): FakeAnswer {
    if (this.membershipOutage) return this.membershipOutage;
    const index = this.indexOfId(membershipId);
    return index === -1 ? membershipNotFound : { status: 200, body: this.membershipJson(index) };
  }

  private userAnswer(userId: string): FakeAnswer {
    const user = this.users.find(({ id }) => id === userId);
    return user === undefined ? notFound('User not found') : { status: 200, body: userJson(user) };
  }

  private organizationAnswer(organizationId: string): FakeAnswer {
    const known = this.#organizations.has(organizationId) || Object.hasOwn(this.organizationNames, organizationId);
    return known ? { status: 200, body: this.organizationJson(organizationId) } : organizationNotFound;
  }

  // A role assignment names one role and the authorization resource of the organization of the membership. A POST
  // adds that role and a DELETE removes it. Each other role and the status stay, also on a membership that is not
  // active. The resource of an organization with an external ID has only that external ID: WorkOS refuses the
  // organization ID of such an organization.
  private roleAssignmentAnswer(request: RecordedRequest, membershipId: string): FakeAnswer {
    const index = this.indexOfId(membershipId);
    const membership = this.#memberships[index];
    if (membership === undefined) return membershipNotFound;
    const { role_slug: role, resource_type_slug: resourceType, resource_external_id: resource } = (request.body ?? {}) as RoleAssignmentBody;
    if (resourceType !== 'organization' || resource !== this.resourceExternalIdOf(membership.organizationId)) {
      return notFound(`AuthorizationResource not found: '${resource}'.`);
    }
    if (!isKnownRole(role)) return notFound('Role not found');
    return request.method === 'POST' ? this.assignRole(index, role) : this.removeRole(index, role);
  }

  // The external ID of the authorization resource of an organization: the external ID of the organization, or its
  // organization ID when it has none.
  private resourceExternalIdOf(organizationId: string): string {
    return this.organizationExternalIds[organizationId] ?? organizationId;
  }

  // A second assignment of a role changes nothing and gives the same assignment.
  private assignRole(index: number, role: string): FakeAnswer {
    const roles = effectiveRoles(this.#memberships[index]);
    if (roles.includes(role)) return { status: 200, body: this.roleAssignmentJson(index, role) };
    this.changeMembership(index, { roles: [...roles, role] });
    return { status: 201, body: this.roleAssignmentJson(index, role) };
  }

  // When the last role goes, WorkOS gives the default role. A role that the membership does not have changes nothing.
  private removeRole(index: number, role: string): FakeAnswer {
    const remaining = effectiveRoles(this.#memberships[index]).filter((slug) => slug !== role);
    this.changeMembership(index, { roles: remaining.length === 0 ? defaultRoles : remaining });
    return { status: 204 };
  }

  // WorkOS has no state filter for invitations. The after cursor is the ID of the last invitation of the page before.
  private invitationsAnswer(request: RecordedRequest): FakeAnswer {
    if (this.invitationOutage) return this.invitationOutage;
    const query = queryOf(request);
    const fitting = this.invitations.filter(({ organizationId }) => matches(query.get('organization_id'), organizationId));
    const start = fitting.findIndex(({ id }) => id === query.get('after')) + 1;
    const end = start + Math.min(Number(query.get('limit') ?? 10), this.invitationPageSize);
    const next = end < fitting.length ? fitting[end - 1].id : null;
    return listAnswer(fitting.slice(start, end).map((invitation) => this.invitationJson(invitation)), next);
  }

  private invitationAnswer(invitationId: string): FakeAnswer {
    if (this.invitationOutage) return this.invitationOutage;
    const invitation = this.invitationWithId(invitationId);
    return invitation === undefined ? invitationNotFound : { status: 200, body: this.invitationJson(invitation) };
  }

  // A send makes a pending membership with only the invited role: for a new address with a new unverified user, and
  // for a known address from its inactive or pending membership, whose earlier roles go.
  private sendAnswer(request: RecordedRequest): FakeAnswer {
    const { email = '', organization_id: organizationId = '', role_slug: roleSlug = 'member' } = (request.body ?? {}) as InvitationBody;
    const expiresAt = new Date(Date.now() + invitationLifetimeMs).toISOString();
    const invitation: FakeInvitation = { id: `invitation_${(this.#counter += 1)}`, email, organizationId, roleSlug, state: 'pending', expiresAt };
    const refused = this.sendRefusal(invitation);
    if (refused) return refused;
    this.putMembershipOf(invitation, { roles: [roleSlug], status: 'pending' });
    this.invitations = [...this.invitations, invitation];
    return { status: 201, body: this.invitationJson(invitation) };
  }

  // WorkOS refuses an unknown role, an address with a pending invitation of the organization in any letter case and
  // for any role, and the address of an active member.
  private sendRefusal(invitation: FakeInvitation): FakeAnswer | undefined {
    if (!isKnownRole(invitation.roleSlug)) return refusal('invalid_role', 'The role is invalid.');
    const invited = this.invitations.some((other) => other.organizationId === invitation.organizationId && sameAddress(other.email, invitation.email) && currentState(other) === 'pending');
    if (invited) return refusal('email_already_invited_to_organization', 'Email already invited to organization.');
    const index = this.indexOfAddress(invitation);
    if (index !== -1 && currentStatus(this.#memberships[index]) === 'active') return refusal('user_already_organization_member', 'User already a member of organization.');
    return undefined;
  }

  // A resend changes only the update time of a pending invitation.
  private resendAnswer(invitationId: string): FakeAnswer {
    const invitation = this.invitationWithId(invitationId);
    if (invitation === undefined) return invitationNotFound;
    const refused = resendRefusals[currentState(invitation)];
    if (refused) return refused;
    return { status: 200, body: this.invitationJson(this.changeInvitation(invitation, {})) };
  }

  // A revoke leaves the pending membership of the invitation pending.
  private revokeAnswer(invitationId: string): FakeAnswer {
    const invitation = this.invitationWithId(invitationId);
    if (invitation === undefined) return invitationNotFound;
    if (currentState(invitation) !== 'pending') return refusal('invite_not_pending', 'Invite is not pending.');
    return { status: 200, body: this.invitationJson(this.changeInvitation(invitation, { state: 'revoked' })) };
  }

  private membershipJson(index: number) {
    const membership = this.#memberships[index];
    const roles = effectiveRoles(membership);
    return {
      object: 'organization_membership', id: membershipIdAt(index), user_id: membership.userId, organization_id: membership.organizationId,
      organization_name: this.organizationNames[membership.organizationId] ?? membership.organizationId, status: currentStatus(membership),
      directory_managed: membership.directoryManaged ?? false, role: { slug: roles[0] }, roles: roles.map((slug) => ({ slug })),
      custom_attributes: {}, created_at: createdAt, updated_at: updateTime(this.changesOf(index)),
    };
  }

  private roleAssignmentJson(index: number, role: string) {
    const { organizationId } = this.#memberships[index];
    const membershipId = membershipIdAt(index);
    const changedAt = updateTime(this.changesOf(index));
    return {
      object: 'role_assignment', id: `role_assignment_${membershipId}_${role}`, organization_membership_id: membershipId, role: { slug: role },
      resource: { id: `authz_resource_${organizationId}`, external_id: this.resourceExternalIdOf(organizationId), resource_type_slug: 'organization' },
      source: { type: 'direct', group_role_assignment_id: null }, created_at: changedAt, updated_at: changedAt,
    };
  }

  // The JSON of an organization, as the pinned SDK reads it.
  private organizationJson(organizationId: string) {
    return {
      object: 'organization', id: organizationId, name: this.organizationNames[organizationId] ?? organizationId,
      allow_profiles_outside_organization: false, domains: [], external_id: this.organizationExternalIds[organizationId] ?? null,
      metadata: {}, created_at: createdAt, updated_at: createdAt,
    };
  }

  private invitationJson(invitation: FakeInvitation) {
    const changedAt = updateTime(this.#invitationChanges.get(invitation.id) ?? 0);
    const token = `invitation-token-${invitation.id}`;
    return {
      object: 'invitation', id: invitation.id, email: invitation.email, state: invitation.state,
      accepted_at: invitation.state === 'accepted' ? changedAt : null, revoked_at: invitation.state === 'revoked' ? changedAt : null,
      expires_at: invitation.expiresAt, organization_id: invitation.organizationId, inviter_user_id: null,
      accepted_user_id: invitation.state === 'accepted' ? this.userWithAddress(invitation.email)?.id ?? null : null,
      role_slug: this.roleSlugOf(invitation), token, accept_invitation_url: `https://authkit.fake.example/invite?invitation_token=${token}`,
      created_at: createdAt, updated_at: changedAt,
    };
  }

  // WorkOS gives the role of an invitation from the current role of its membership. Thus only the role of a pending
  // invitation is the role that its acceptance gives.
  private roleSlugOf(invitation: FakeInvitation): string {
    const index = this.indexOfAddress(invitation);
    return index === -1 ? invitation.roleSlug : effectiveRoles(this.#memberships[index])[0];
  }

  private changesOf(index: number): number {
    return this.#membershipChanges[index] ?? 0;
  }

  private changeMembership(index: number, change: Partial<FakeMembership>): void {
    this.memberships = this.#memberships.with(index, { ...this.#memberships[index], ...change });
  }

  // Gives the membership of the address of an invitation in its organization these roles and this status. A new
  // address gets a new unverified user, and a user without a membership there gets a new membership.
  private putMembershipOf(invitation: FakeInvitation, grant: Pick<FakeMembership, 'roles' | 'status'>): void {
    const user = this.userWithAddress(invitation.email) ?? this.addInvitedUser(invitation.email);
    const index = this.indexOfUser(user.id, invitation.organizationId);
    if (index === -1) this.memberships = [...this.#memberships, { userId: user.id, organizationId: invitation.organizationId, ...grant }];
    else this.changeMembership(index, grant);
  }

  private addInvitedUser(email: string): FakeUser {
    const user: FakeUser = { id: `user_invited_${(this.#counter += 1)}`, email, firstName: '', emailVerified: false };
    this.users = [...this.users, user];
    return user;
  }

  // Replaces an invitation after a change in WorkOS, which gives it a later update time.
  private changeInvitation(invitation: FakeInvitation, change: Partial<FakeInvitation>): FakeInvitation {
    const changed = { ...invitation, ...change };
    this.invitations = this.invitations.map((each) => (each === invitation ? changed : each));
    this.#invitationChanges.set(invitation.id, (this.#invitationChanges.get(invitation.id) ?? 0) + 1);
    return changed;
  }

  private userWithAddress(email: string): FakeUser | undefined {
    return this.users.find((user) => sameAddress(user.email, email));
  }

  private indexOfId(membershipId: string): number {
    return this.#memberships.findIndex((_membership, index) => membershipIdAt(index) === membershipId);
  }

  private indexOfUser(userId: string, organizationId: string): number {
    return this.#memberships.findIndex((membership) => membership.userId === userId && membership.organizationId === organizationId);
  }

  private indexOfAddress(invitation: FakeInvitation): number {
    const user = this.userWithAddress(invitation.email);
    return user === undefined ? -1 : this.indexOfUser(user.id, invitation.organizationId);
  }

  private requiredIndex(user: FakeUser, organizationId: string): number {
    const index = this.indexOfUser(user.id, organizationId);
    if (index === -1) throw new Error(`The world has no membership of ${user.id} in ${organizationId}`);
    return index;
  }

  private invitationWithId(invitationId: string): FakeInvitation | undefined {
    return this.invitations.find(({ id }) => id === invitationId);
  }

  private requiredInvitation(invitationId: string): FakeInvitation {
    const invitation = this.invitationWithId(invitationId);
    if (invitation === undefined) throw new Error(`The world has no invitation ${invitationId}`);
    return invitation;
  }

  private async authenticateAnswer(request: RecordedRequest): Promise<FakeAnswer> {
    const body = request.body as Readonly<Record<string, string | undefined>>;
    return body.grant_type === 'authorization_code' ? this.codeAnswer(body.code ?? '') : this.refreshAnswer(body);
  }

  private async codeAnswer(code: string): Promise<FakeAnswer> {
    const session = this.#codes.get(code);
    if (session === undefined) return { status: 400, body: { error: 'invalid_grant', error_description: 'The code is not valid.' } };
    this.#codes.delete(code);
    return this.sessionAnswer(session);
  }

  private async refreshAnswer(body: Readonly<Record<string, string | undefined>>): Promise<FakeAnswer> {
    if (this.refreshOutage) return this.refreshOutage;
    const session = this.#sessions.get(body.refresh_token ?? '');
    if (session === undefined || session.ended) return { status: 400, body: { error: 'invalid_grant', error_description: 'The session has ended.' } };
    const organizationId = body.organization_id ?? session.organizationId;
    if (organizationId !== undefined && !this.hasActiveMembership(session.user, organizationId)) {
      return { status: 400, body: { error: 'organization_membership_not_found', error_description: 'No membership.' } };
    }
    session.organizationId = organizationId;
    return this.sessionAnswer(session);
  }

  private hasActiveMembership(user: FakeUser, organizationId: string): boolean {
    return this.memberships.some((m) => m.userId === user.id && m.organizationId === organizationId && (m.status ?? 'active') === 'active');
  }

  private async sessionAnswer(session: FakeSession): Promise<FakeAnswer> {
    const refreshToken = `refresh_${(this.#counter += 1)}`;
    this.#sessions.set(refreshToken, session);
    const accessToken = await this.browserToken(session.user, session.organizationId);
    return {
      status: 200,
      body: {
        user: userJson(session.user),
        ...(session.organizationId === undefined ? {} : { organization_id: session.organizationId }),
        access_token: accessToken,
        refresh_token: refreshToken,
        authentication_method: this.authenticationMethod,
      },
    };
  }
}
