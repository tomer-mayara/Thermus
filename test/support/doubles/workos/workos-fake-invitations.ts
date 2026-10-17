import type { FakeAnswer, RecordedRequest, WorkOSFakeApi } from './workos-fake-api.ts';
import type { FakeInvitation, FakeMembership, FakeUser } from './workos-fake.ts';
import { changeMembership, currentStatus, effectiveRoles, indexOfUser, isKnownRole, matches, queryOf } from './workos-fake-directory.ts';
import { invitationJson, listAnswer, notFound, refusal, type ShownInvitation } from './workos-fake-wire.ts';

// What the invitation routes read and change in the fake.
export interface InvitationView {
  readonly fake: WorkOSFakeApi;
  invitations: readonly FakeInvitation[];
  users: readonly FakeUser[];
  memberships: readonly FakeMembership[];
  readonly invitationPageSize: number;
  readonly invitationOutage: FakeAnswer | undefined;
  nextNumber(): number;
}

interface InvitationBody {
  readonly email?: string;
  readonly organization_id?: string;
  readonly role_slug?: string;
}

const invitationsPath = '/user_management/invitations';
const invitationLifetimeMs = 7 * 24 * 60 * 60 * 1_000;
const invitationNotFound = notFound('Invite not found');
const resendRefusals: Readonly<Record<FakeInvitation['state'], FakeAnswer | undefined>> = {
  pending: undefined,
  accepted: refusal('invite_accepted', 'Invite has already been accepted.'),
  revoked: refusal('invite_revoked', 'Invite has been revoked.'),
  expired: refusal('invite_expired', 'Invite has expired.'),
};

// A pending invitation whose expiry time has passed is expired, also when WorkOS still gives the state pending.
function currentState(invitation: FakeInvitation): FakeInvitation['state'] {
  return invitation.state === 'pending' && Date.parse(invitation.expiresAt) <= Date.now() ? 'expired' : invitation.state;
}

function sameAddress(first: string, second: string): boolean {
  return first.toLowerCase() === second.toLowerCase();
}

// The routes of the invitations of the organization administration.
export class WorkOSFakeInvitations {
  readonly #view: InvitationView;
  // The number of changes of each invitation, by ID. The update times come from them.
  readonly #changes = new Map<string, number>();

  constructor(view: InvitationView) {
    this.#view = view;
    const { fake } = view;
    fake.answer(`GET ${invitationsPath}`, (request) => this.invitationsAnswer(request));
    fake.answer(`POST ${invitationsPath}`, (request) => this.sendAnswer(request));
    fake.answerEach(`GET ${invitationsPath}/:id`, (_request, id) => this.invitationAnswer(id));
    fake.answerEach(`POST ${invitationsPath}/:id/resend`, (_request, id) => this.resendAnswer(id));
    fake.answerEach(`POST ${invitationsPath}/:id/revoke`, (_request, id) => this.revokeAnswer(id));
  }

  acceptInvitation(invitationId: string): void {
    const invitation = this.requiredInvitation(invitationId);
    if (currentState(invitation) !== 'pending') throw new Error(`The invitation ${invitationId} is not pending`);
    this.putMembershipOf(invitation, { roles: [this.roleSlugOf(invitation)], status: 'active' });
    this.changeInvitation(invitation, { state: 'accepted' });
  }

  expireInvitation(invitationId: string): void {
    const invitation = this.requiredInvitation(invitationId);
    const expired = { ...invitation, expiresAt: new Date(Date.now() - 60_000).toISOString() };
    this.#view.invitations = this.#view.invitations.map((each) => (each === invitation ? expired : each));
  }

  // WorkOS has no state filter for invitations. The after cursor is the ID of the last invitation of the page before.
  private invitationsAnswer(request: RecordedRequest): FakeAnswer {
    if (this.#view.invitationOutage) return this.#view.invitationOutage;
    const query = queryOf(request);
    const fitting = this.#view.invitations.filter(({ organizationId }) => matches(query.get('organization_id'), organizationId));
    const start = fitting.findIndex(({ id }) => id === query.get('after')) + 1;
    const end = start + Math.min(Number(query.get('limit') ?? 10), this.#view.invitationPageSize);
    const next = end < fitting.length ? fitting[end - 1].id : null;
    return listAnswer(fitting.slice(start, end).map((invitation) => invitationJson(this.shown(invitation))), next);
  }

  private invitationAnswer(invitationId: string): FakeAnswer {
    if (this.#view.invitationOutage) return this.#view.invitationOutage;
    const invitation = this.invitationWithId(invitationId);
    return invitation === undefined ? invitationNotFound : { status: 200, body: invitationJson(this.shown(invitation)) };
  }

  // A send makes a pending membership with only the invited role: for a new address with a new unverified user, and
  // for a known address from its inactive or pending membership, whose earlier roles go.
  private sendAnswer(request: RecordedRequest): FakeAnswer {
    const { email = '', organization_id: organizationId = '', role_slug: roleSlug = 'member' } = (request.body ?? {}) as InvitationBody;
    const expiresAt = new Date(Date.now() + invitationLifetimeMs).toISOString();
    const invitation: FakeInvitation = { id: `invitation_${this.#view.nextNumber()}`, email, organizationId, roleSlug, state: 'pending', expiresAt };
    const refused = this.sendRefusal(invitation);
    if (refused) return refused;
    this.putMembershipOf(invitation, { roles: [roleSlug], status: 'pending' });
    this.#view.invitations = [...this.#view.invitations, invitation];
    return { status: 201, body: invitationJson(this.shown(invitation)) };
  }

  // WorkOS refuses an unknown role, an address with a pending invitation of the organization in any letter case and
  // for any role, and the address of an active member.
  private sendRefusal(invitation: FakeInvitation): FakeAnswer | undefined {
    if (!isKnownRole(invitation.roleSlug)) return refusal('invalid_role', 'The role is invalid.');
    const invited = this.#view.invitations.some((other) => other.organizationId === invitation.organizationId && sameAddress(other.email, invitation.email) && currentState(other) === 'pending');
    if (invited) return refusal('email_already_invited_to_organization', 'Email already invited to organization.');
    const index = this.indexOfAddress(invitation);
    if (index !== -1 && currentStatus(this.#view.memberships[index]) === 'active') return refusal('user_already_organization_member', 'User already a member of organization.');
    return undefined;
  }

  // A resend changes only the update time of a pending invitation.
  private resendAnswer(invitationId: string): FakeAnswer {
    const invitation = this.invitationWithId(invitationId);
    if (invitation === undefined) return invitationNotFound;
    const refused = resendRefusals[currentState(invitation)];
    if (refused) return refused;
    return { status: 200, body: invitationJson(this.shown(this.changeInvitation(invitation, {}))) };
  }

  // A revoke leaves the pending membership of the invitation pending.
  private revokeAnswer(invitationId: string): FakeAnswer {
    const invitation = this.invitationWithId(invitationId);
    if (invitation === undefined) return invitationNotFound;
    if (currentState(invitation) !== 'pending') return refusal('invite_not_pending', 'Invite is not pending.');
    return { status: 200, body: invitationJson(this.shown(this.changeInvitation(invitation, { state: 'revoked' }))) };
  }

  private shown(invitation: FakeInvitation): ShownInvitation {
    const userId = this.userWithAddress(invitation.email)?.id ?? null;
    return { ...invitation, roleSlug: this.roleSlugOf(invitation), userId, changes: this.#changes.get(invitation.id) ?? 0 };
  }

  // WorkOS gives the role of an invitation from the current role of its membership. Thus only the role of a pending
  // invitation is the role that its acceptance gives.
  private roleSlugOf(invitation: FakeInvitation): string {
    const index = this.indexOfAddress(invitation);
    return index === -1 ? invitation.roleSlug : effectiveRoles(this.#view.memberships[index])[0];
  }

  // Gives the membership of the address of an invitation in its organization these roles and this status. A new
  // address gets a new unverified user, and a user without a membership there gets a new membership.
  private putMembershipOf(invitation: FakeInvitation, grant: Pick<FakeMembership, 'roles' | 'status'>): void {
    const user = this.userWithAddress(invitation.email) ?? this.addInvitedUser(invitation.email);
    const index = indexOfUser(this.#view.memberships, user.id, invitation.organizationId);
    if (index === -1) this.#view.memberships = [...this.#view.memberships, { userId: user.id, organizationId: invitation.organizationId, ...grant }];
    else changeMembership(this.#view, index, grant);
  }

  private addInvitedUser(email: string): FakeUser {
    const user: FakeUser = { id: `user_invited_${this.#view.nextNumber()}`, email, firstName: '', emailVerified: false };
    this.#view.users = [...this.#view.users, user];
    return user;
  }

  // Replaces an invitation after a change in WorkOS, which gives it a later update time.
  private changeInvitation(invitation: FakeInvitation, change: Partial<FakeInvitation>): FakeInvitation {
    const changed = { ...invitation, ...change };
    this.#view.invitations = this.#view.invitations.map((each) => (each === invitation ? changed : each));
    this.#changes.set(invitation.id, (this.#changes.get(invitation.id) ?? 0) + 1);
    return changed;
  }

  private userWithAddress(email: string): FakeUser | undefined {
    return this.#view.users.find((user) => sameAddress(user.email, email));
  }

  private indexOfAddress(invitation: FakeInvitation): number {
    const user = this.userWithAddress(invitation.email);
    return user === undefined ? -1 : indexOfUser(this.#view.memberships, user.id, invitation.organizationId);
  }

  private invitationWithId(invitationId: string): FakeInvitation | undefined {
    return this.#view.invitations.find(({ id }) => id === invitationId);
  }

  private requiredInvitation(invitationId: string): FakeInvitation {
    const invitation = this.invitationWithId(invitationId);
    if (invitation === undefined) throw new Error(`The world has no invitation ${invitationId}`);
    return invitation;
  }
}
