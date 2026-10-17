import type { TestContext } from 'node:test';
import { createRemoteJWKSet } from 'jose';
import type { WorkOSConnection } from '../../../../src/hosted-workos-application.ts';
import type { WorkOSSettings, WorkOSMfaPolicy } from '../../../../src/auth/hosted-auth/workos/workos-settings.ts';
import { nowInSeconds, SigningKey } from './jwt-signing-key.ts';
import { cookiePassword, fakeApiKey, fakeClientId, WorkOSFakeApi, workosClientFor, type FakeAnswer, type RecordedRequest } from './workos-fake-api.ts';
import { answerDirectoryRoutes, changeMembership, currentStatus, effectiveRoles, grantState, indexOfUser, membershipIdAt, type DirectoryView } from './workos-fake-directory.ts';
import { WorkOSFakeInvitations, type InvitationView } from './workos-fake-invitations.ts';
import { invalidGrant, organizationJson as organizationShape, organizationMembershipNotFound, userJson } from './workos-fake-wire.ts';

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

export type MembershipStatus = NonNullable<FakeMembership['status']>;

interface FakeSession {
  readonly user: FakeUser;
  organizationId: string | undefined;
  ended: boolean;
}

const authenticateRoute = 'POST /user_management/authenticate';
const mcpClientId = 'client_01MCPCLIENT';

// A local WorkOS environment for the offline tests of the hosted WorkOS composition: a fake WorkOS API with
// organizations, users, memberships, the hosted roles, role assignments, invitations, browser sign-ins and refreshes,
// and AuthKit-signed Connect tokens. The membership at index i of memberships has the ID om_i. The fake knows the
// organizations of start() and of organizationNames. The answers follow what WorkOS staging showed; the design document
// gives these findings.
export class WorkOSFake implements DirectoryView, InvitationView {
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
  // The authentication method of each new sign-in. Only the explicit Required profile treats Password as MFA evidence.
  authenticationMethod = 'Password';
  // Set to an answer, such as a 500, to make reads fail: each membership read, only the membership pages after the
  // first, each invitation read, or the refreshes.
  membershipOutage: FakeAnswer | undefined;
  laterMembershipPageOutage: FakeAnswer | undefined;
  invitationOutage: FakeAnswer | undefined;
  refreshOutage: FakeAnswer | undefined;
  #memberships: readonly FakeMembership[] = [];
  // The number of changes of the roles or the status of each membership, by index. The update times come from them.
  readonly #membershipChanges: number[] = [];
  readonly #invitationRoutes: WorkOSFakeInvitations;
  readonly #sessions = new Map<string, FakeSession>();
  readonly #codes = new Map<string, FakeSession>();
  #accessTokenLifetime = 300;
  #counter = 0;

  private constructor(parts: { fake: WorkOSFakeApi; browserKey: SigningKey; authkitKey: SigningKey; publicBaseUrl: string; organizations: readonly string[] }) {
    this.fake = parts.fake;
    this.browserKey = parts.browserKey;
    this.authkitKey = parts.authkitKey;
    this.mcpResourceUrl = new URL('mcp', parts.publicBaseUrl).href;
    this.settings = Object.freeze({
      mfaPolicy: 'optional',
      apiKey: fakeApiKey,
      clientId: fakeClientId,
      authkitIssuer: parts.fake.authkitIssuer,
      redirectUri: new URL('callback', parts.publicBaseUrl).href,
      cookiePassword,
    });
    answerDirectoryRoutes(this.fake, this, parts.organizations);
    this.fake.answer(authenticateRoute, (request) => this.authenticateAnswer(request));
    this.#invitationRoutes = new WorkOSFakeInvitations(this);
  }

  static async start(t: TestContext, publicBaseUrl: string, organizations: readonly string[]): Promise<WorkOSFake> {
    const fake = await WorkOSFakeApi.start(t);
    const [browserKey, authkitKey] = await Promise.all([SigningKey.generate('browser-key-1'), SigningKey.generate('authkit-key-1')]);
    fake.browserKeySet.publish(browserKey);
    fake.authkitKeySet.publish(authkitKey);
    return new WorkOSFake({ fake, browserKey, authkitKey, publicBaseUrl, organizations });
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

  connection(mfaPolicy: WorkOSMfaPolicy = this.settings.mfaPolicy): WorkOSConnection {
    return { settings: { ...this.settings, mfaPolicy }, workos: workosClientFor(this.fake), authkitKeySet: createRemoteJWKSet(this.fake.authkitKeySetUrl) };
  }

  // Makes an authorization code as AuthKit gives it after sign-in, any required MFA step, and the organization choice.
  codeFor(user: FakeUser, organizationId?: string): string {
    const code = `code_${this.nextNumber()}`;
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
    return this.authkitKey.sign({ sub: user.id, client_id: mcpClientId, sid: `app_consent_${user.id}`, scope: 'email offline_access openid profile', jti: `jti_${this.nextNumber()}`, ...claims }, {
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
    changeMembership(this, this.requiredIndex(user, organizationId), { roles });
  }

  setStatus(user: FakeUser, organizationId: string, status: MembershipStatus): void {
    changeMembership(this, this.requiredIndex(user, organizationId), { status });
  }

  // Accepts an invitation as AuthKit does: the membership of its address in its organization becomes active with only
  // the role of the invitation, and the invitation becomes accepted.
  acceptInvitation(invitationId: string): void {
    this.#invitationRoutes.acceptInvitation(invitationId);
  }

  // Moves the expiry time of an invitation into the past and keeps the state pending, so that a reader must compare
  // the expiry time.
  expireInvitation(invitationId: string): void {
    this.#invitationRoutes.expireInvitation(invitationId);
  }

  // The JSON of an organization, as the pinned SDK reads it.
  organizationJson(organizationId: string) {
    return organizationShape(organizationId, this.organizationNames[organizationId] ?? organizationId, this.organizationExternalIds[organizationId] ?? null);
  }

  // One counter gives the numbers of the codes, refresh tokens, invitations, invited users, and Connect tokens.
  nextNumber(): number {
    return (this.#counter += 1);
  }

  changesOf(index: number): number {
    return this.#membershipChanges[index] ?? 0;
  }

  private requiredIndex(user: FakeUser, organizationId: string): number {
    const index = indexOfUser(this.#memberships, user.id, organizationId);
    if (index === -1) throw new Error(`The world has no membership of ${user.id} in ${organizationId}`);
    return index;
  }

  private async authenticateAnswer(request: RecordedRequest): Promise<FakeAnswer> {
    const body = request.body as Readonly<Record<string, string | undefined>>;
    return body.grant_type === 'authorization_code' ? this.codeAnswer(body.code ?? '') : this.refreshAnswer(body);
  }

  private async codeAnswer(code: string): Promise<FakeAnswer> {
    const session = this.#codes.get(code);
    if (session === undefined) return invalidGrant('The code is not valid.');
    this.#codes.delete(code);
    return this.sessionAnswer(session);
  }

  private async refreshAnswer(body: Readonly<Record<string, string | undefined>>): Promise<FakeAnswer> {
    if (this.refreshOutage) return this.refreshOutage;
    const session = this.#sessions.get(body.refresh_token ?? '');
    if (session === undefined || session.ended) return invalidGrant('The session has ended.');
    const organizationId = body.organization_id ?? session.organizationId;
    if (organizationId !== undefined && !this.hasActiveMembership(session.user, organizationId)) return organizationMembershipNotFound;
    session.organizationId = organizationId;
    return this.sessionAnswer(session);
  }

  private hasActiveMembership(user: FakeUser, organizationId: string): boolean {
    return this.memberships.some((m) => m.userId === user.id && m.organizationId === organizationId && (m.status ?? 'active') === 'active');
  }

  private async sessionAnswer(session: FakeSession): Promise<FakeAnswer> {
    const refreshToken = `refresh_${this.nextNumber()}`;
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
