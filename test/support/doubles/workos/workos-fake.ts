import type { TestContext } from 'node:test';
import { createRemoteJWKSet } from 'jose';
import type { WorkOSConnection } from '../../../../src/app/hosted-workos-application.ts';
import type { WorkOSSettings } from '../../../../src/accounts/providers/workos/workos-settings.ts';
import { SigningKey } from './jwt-signing-key.ts';
import { cookiePassword, fakeApiKey, fakeClientId, WorkOSFakeApi, workosClientFor, type FakeAnswer } from './workos-fake-api.ts';
import { answerDirectoryRoutes, changeMembership, currentStatus, effectiveRoles, grantState, indexOfUser, membershipIdAt, type DirectoryView } from './workos-fake-directory.ts';
import { WorkOSFakeInvitations, type InvitationView } from './workos-fake-invitations.ts';
import { answerOrganizationRoutes, type OrganizationView } from './workos-fake-organizations.ts';
import { WorkOSFakeSessions, type SessionView } from './workos-fake-sessions.ts';
import { organizationJson as organizationShape } from './workos-fake-wire.ts';

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

// A local WorkOS environment for the offline tests of the hosted WorkOS composition: a fake WorkOS API with
// organizations, users, memberships, the hosted roles, role assignments, invitations, browser sign-ins and refreshes,
// and AuthKit-signed Connect tokens. The membership at index i of memberships has the ID om_i. The fake knows the
// organizations of start() and of organizationNames. The answers follow what WorkOS staging showed; the design document
// gives these findings.
export class WorkOSFake implements DirectoryView, OrganizationView, InvitationView, SessionView {
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
  // The authentication method of each new sign-in.
  authenticationMethod = 'Password';
  // Set to an answer, such as a 500, to make reads fail: each membership read, only the membership pages after the
  // first, each invitation read, or the refreshes.
  membershipOutage: FakeAnswer | undefined;
  laterMembershipPageOutage: FakeAnswer | undefined;
  invitationOutage: FakeAnswer | undefined;
  refreshOutage: FakeAnswer | undefined;
  // The organization list: the most organizations on one page, and answers, such as a 500, for each page or only the
  // pages after the first.
  organizationPageSize = 100;
  organizationListOutage: FakeAnswer | undefined;
  laterOrganizationPageOutage: FakeAnswer | undefined;
  // The organizations that WorkOS no longer has: the list leaves them out, and a read by ID answers 404.
  readonly removedOrganizationIds = new Set<string>();
  // The organizations that the list leaves out while a read by ID still finds them: the lag of the lists after a delete.
  readonly unlistedOrganizationIds = new Set<string>();
  readonly deletedMembershipIds = new Set<string>();
  #memberships: readonly FakeMembership[] = [];
  // The number of changes of the roles or the status of each membership, by index. The update times come from them.
  readonly #membershipChanges: number[] = [];
  readonly #sessions: WorkOSFakeSessions;
  readonly #invitationRoutes: WorkOSFakeInvitations;
  #counter = 0;

  private constructor(parts: { fake: WorkOSFakeApi; browserKey: SigningKey; authkitKey: SigningKey; publicBaseUrl: string; organizations: readonly string[] }) {
    this.fake = parts.fake;
    this.browserKey = parts.browserKey;
    this.authkitKey = parts.authkitKey;
    this.mcpResourceUrl = new URL('mcp', parts.publicBaseUrl).href;
    this.settings = Object.freeze({
      apiKey: fakeApiKey, clientId: fakeClientId, authkitIssuer: parts.fake.authkitIssuer,
      redirectUri: new URL('callback', parts.publicBaseUrl).href, cookiePassword,
    });
    answerDirectoryRoutes(this.fake, this, parts.organizations);
    answerOrganizationRoutes(this.fake, this, parts.organizations);
    this.#sessions = new WorkOSFakeSessions(this);
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

  connection(): WorkOSConnection {
    return { settings: this.settings, workos: workosClientFor(this.fake), authkitKeySet: createRemoteJWKSet(this.fake.authkitKeySetUrl) };
  }

  // Makes an authorization code as AuthKit gives it after sign-in and the organization choice.
  codeFor(user: FakeUser, organizationId?: string): string {
    return this.#sessions.codeFor(user, organizationId);
  }

  // Lets each next access token expire at once, so the next request needs a refresh.
  expireAccessTokens(): void {
    this.#sessions.expireAccessTokens();
  }

  endSessionsOf(user: FakeUser): void {
    this.#sessions.endSessionsOf(user);
  }

  connectToken(user: FakeUser, claims: Readonly<Record<string, unknown>> = {}): Promise<string> {
    return this.#sessions.connectToken(user, claims);
  }

  browserToken(user: FakeUser, organizationId?: string): Promise<string> {
    return this.#sessions.browserToken(user, organizationId);
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
}
