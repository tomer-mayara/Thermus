import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import type { Invitation, OrganizationMembership, WorkOS } from '@workos-inc/node';
import { WorkOSOrganizations } from '../../../../src/auth/hosted-auth/workos/workos-organizations.ts';
import { workosAuthority } from '../../../../src/auth/hosted-auth/workos/workos-settings.ts';
import { activeUserSeatCount } from '../../../../src/organizations/administration-overviews.ts';
import { invitationsOf } from '../../../../src/organizations/directory-reads.ts';
import type {
  DirectoryGrantChange,
  InvitationState,
  MembershipStatus,
  OrganizationDirectory,
  OrganizationInvitation,
  OrganizationMember,
} from '../../../../src/organizations/organization-directory.ts';
import type { AdministrationMembershipName } from '../../../support/hosted-live/administration-fixtures.ts';
import type { LiveRun } from '../../../support/hosted-live/live-run.ts';
import { rolesOf } from '../../../support/hosted-live/operator-runbook.ts';

type UserManagement = WorkOS['userManagement'];

interface MembershipState {
  readonly status: string;
  readonly roles: readonly string[];
  readonly updatedAt: string;
}

// One membership list read of WorkOS: the statuses that it named and the number of memberships on its page.
interface MembershipListRead {
  readonly statuses: readonly string[];
  readonly size: number;
}

interface PagedMemberRead {
  readonly members: readonly OrganizationMember[];
  readonly reads: readonly MembershipListRead[];
}

const proofOptions = { timeout: 120_000 };
const pageLimit = 2;
const maxPages = 50;
const singleStatuses: readonly (readonly MembershipStatus[])[] = [['active'], ['inactive'], ['pending']];
const everyStatus: readonly MembershipStatus[] = ['active', 'inactive', 'pending'];
const invitationStates: readonly InvitationState[] = ['pending', 'accepted', 'revoked', 'expired'];
// The memberships of the seat proof, with the status and the roles that the fixtures gave them.
const seatMemberships: readonly (readonly [AdministrationMembershipName, string])[] = [
  ['seatUserAdminInD', 'active admin,user'],
  ['seatAdminInD', 'active admin'],
  ['seatSuperAdminInD', 'active super-admin'],
  ['seatDefaultInD', 'active member'],
  ['seatInactiveInD', 'inactive user'],
  ['seatPendingInD', 'pending user'],
];

function stateOf(membership: OrganizationMembership): MembershipState {
  return { status: membership.status, roles: rolesOf(membership), updatedAt: membership.updatedAt };
}

// The single-role write of the directory: one role on the authorization resource of an organization without an external
// ID, such as D or B. WorkOS names the resource of such an organization by its organization ID.
function organizationRole(organizationId: string, membershipId: string, roleSlug: string) {
  return { organizationMembershipId: membershipId, roleSlug, resourceTypeSlug: 'organization', resourceExternalId: organizationId };
}

function sameStatuses(read: readonly string[], statuses: readonly string[]): boolean {
  return read.length === statuses.length && statuses.every((status) => read.includes(status));
}

function memberSummary(member: OrganizationMember | undefined): string {
  if (member === undefined) return 'absent';
  return `${member.status} ${member.grants.map(({ role }) => role).toSorted().join()}`;
}

// The SDK client of the run, but each membership list asks WorkOS for pages of two, so that a member read gets several
// pages. Each other call goes to the SDK client unchanged.
function withPagesOfTwo(userManagement: UserManagement, reads: MembershipListRead[]): UserManagement {
  const paged: UserManagement = Object.create(userManagement);
  paged.listOrganizationMemberships = async (options) => {
    const page = await userManagement.listOrganizationMemberships({ ...options, limit: pageLimit });
    reads.push({ statuses: options.statuses ?? [], size: page.data.length });
    return page;
  };
  return paged;
}

// Every page of one member read of the directory, in order.
async function everyMemberPage(directory: OrganizationDirectory, organizationId: string, statuses: readonly MembershipStatus[]): Promise<OrganizationMember[]> {
  const members: OrganizationMember[] = [];
  let cursor: string | undefined;
  for (let count = 0; count < maxPages; count += 1) {
    const page = await directory.memberPage({ organizationId, statuses, cursor });
    members.push(...page.items);
    cursor = page.next;
    if (cursor === undefined) return members;
  }
  assert.fail(`The member pages did not end after ${maxPages} reads.`);
}

export function describeAdministrationProofs(run: LiveRun): void {
  const { workos, settings } = run;
  const authority = workosAuthority(settings.clientId);
  // The directory of the hosted edition, as the composition makes it, against the staging environment.
  const directory = new WorkOSOrganizations({ authority, userManagement: workos.userManagement, authorization: workos.authorization, organizations: workos.organizations });

  function pagedDirectory(reads: MembershipListRead[]): WorkOSOrganizations {
    return new WorkOSOrganizations({ authority, userManagement: withPagesOfTwo(workos.userManagement, reads), authorization: workos.authorization, organizations: workos.organizations });
  }

  async function membershipState(membershipId: string): Promise<MembershipState> {
    return stateOf(await workos.userManagement.getOrganizationMembership(membershipId));
  }

  async function membershipStateOfUser(userId: string, organizationId: string): Promise<MembershipState> {
    const { data } = await workos.userManagement.listOrganizationMemberships({ userId, organizationId, statuses: ['active', 'inactive', 'pending'], limit: 10 });
    const [membership] = data;
    assert.ok(membership !== undefined && data.length === 1, `WorkOS has ${data.length} memberships of the user in the organization.`);
    return stateOf(membership);
  }

  async function membershipsInWorkOS(organizationId: string, statuses: readonly MembershipStatus[]): Promise<OrganizationMembership[]> {
    return (await workos.userManagement.listOrganizationMemberships({ organizationId, statuses: [...statuses], limit: 100 })).autoPagination();
  }

  async function invitationsInWorkOS(organizationId: string): Promise<Invitation[]> {
    return (await workos.userManagement.listInvitations({ organizationId, limit: 100 })).autoPagination();
  }

  // A member read in pages of two, which must give exactly the memberships of a direct WorkOS read with the same statuses.
  async function checkedPagedRead(t: TestContext, organizationId: string, statuses: readonly MembershipStatus[]): Promise<PagedMemberRead> {
    const reads: MembershipListRead[] = [];
    const members = await everyMemberPage(pagedDirectory(reads), organizationId, statuses);
    const direct = await membershipsInWorkOS(organizationId, statuses);
    t.diagnostic(`${statuses.join(', ')}: ${members.length} memberships on pages of ${JSON.stringify(reads.map(({ size }) => size))}`);

    assert.ok(members.every((member) => statuses.includes(member.status) && member.organizationId === organizationId), `The read of ${statuses.join(', ')} gave another status or organization.`);
    assert.deepEqual(members.map(({ membershipId }) => membershipId).toSorted(), direct.map(({ id }) => id).toSorted());
    assert.ok(reads.every((read) => read.size <= pageLimit && sameStatuses(read.statuses, statuses)), `A WorkOS read of ${statuses.join(', ')} named other statuses or gave a larger page.`);
    return { members, reads };
  }

  // A grant of Admin and a revoke of User, each on the current revision of the membership.
  async function grantAndRevokeOn(membershipId: string): Promise<string[]> {
    const member = await directory.member(membershipId);
    assert.ok(member, `The directory does not find the membership ${membershipId}.`);
    const outcomes: string[] = [];
    for (const change of [{ role: 'admin', action: 'grant' }, { role: 'user', action: 'revoke' }] as const) {
      outcomes.push((await directory.changeGrant({ membershipId, ...change, revision: member.revision })).outcome);
    }
    return outcomes;
  }

  async function pendingInvitationTo(organizationId: string, email: string): Promise<OrganizationInvitation> {
    const pending = (await invitationsOf(directory, organizationId, ['pending'])).filter((invitation) => invitation.email.toLowerCase() === email);
    const [invitation] = pending;
    assert.ok(invitation !== undefined && pending.length === 1, `The directory lists ${pending.length} pending invitations to the address.`);
    return invitation;
  }

  // The states under which a directory read of one state lists the invitation.
  async function statesListing(organizationId: string, invitationId: string): Promise<InvitationState[]> {
    const listed: InvitationState[] = [];
    for (const state of invitationStates) {
      const invitations = await invitationsOf(directory, organizationId, [state]);
      if (invitations.some((invitation) => invitation.invitationId === invitationId)) listed.push(state);
    }
    return listed;
  }

  describe('Hosted live proofs (AUTH-08W): single-role grant writes of WorkOS with the pinned SDK', () => {
    test('Given a membership with User in D, when WorkOS assigns Admin on the organization resource and then assigns Admin again, then the first assignment adds only Admin and changes the update time, and the repeated one gives the same role assignment and changes neither the roles nor the update time', proofOptions, async (t) => {
      const { organizationD, memberships } = await run.administrationFixtures();
      const id = memberships.repeatInD;
      const before = await membershipState(id);

      const first = await workos.authorization.assignRole(organizationRole(organizationD.id, id, 'admin'));
      const afterFirst = await membershipState(id);
      const repeated = await workos.authorization.assignRole(organizationRole(organizationD.id, id, 'admin'));
      const afterRepeat = await membershipState(id);
      t.diagnostic(`roles ${JSON.stringify(before.roles)} > ${JSON.stringify(afterFirst.roles)} > ${JSON.stringify(afterRepeat.roles)}; update time changed ${before.updatedAt !== afterFirst.updatedAt}, then ${afterFirst.updatedAt !== afterRepeat.updatedAt}; the same role assignment: ${first.id === repeated.id}`);

      assert.deepEqual(before.roles, ['user']);
      assert.deepEqual([first.organizationMembershipId, first.role.slug, first.resource.resourceTypeSlug, first.resource.externalId], [id, 'admin', 'organization', organizationD.id]);
      assert.deepEqual([afterFirst.status, afterFirst.roles], ['active', ['admin', 'user']]);
      assert.notEqual(afterFirst.updatedAt, before.updatedAt, 'The role change did not change the update time.');
      assert.equal(repeated.id, first.id, 'The repeated assignment gave another role assignment.');
      assert.deepEqual(afterRepeat, afterFirst);
    });

    test('Given a membership with User in D, when two single-role writes assign Admin and Super Admin at the same time, then both roles stay, and User stays', proofOptions, async (t) => {
      const { organizationD, memberships } = await run.administrationFixtures();
      const id = memberships.concurrentInD;
      const before = await membershipState(id);

      await Promise.all(['admin', 'super-admin'].map((role) => workos.authorization.assignRole(organizationRole(organizationD.id, id, role))));
      const after = await membershipState(id);
      t.diagnostic(`roles ${JSON.stringify(before.roles)} > ${JSON.stringify(after.roles)}`);

      assert.deepEqual(before.roles, ['user']);
      assert.deepEqual([after.status, after.roles], ['active', ['admin', 'super-admin', 'user']]);
    });

    test('Given a membership with User in D, when WorkOS removes Admin, which the membership does not have, then the removal succeeds and changes neither the roles nor the update time', proofOptions, async () => {
      const { organizationD, memberships } = await run.administrationFixtures();
      const id = memberships.absentInD;
      const before = await membershipState(id);

      await workos.authorization.removeRole(organizationRole(organizationD.id, id, 'admin'));
      const after = await membershipState(id);

      assert.deepEqual(before.roles, ['user']);
      assert.deepEqual(after, before);
    });

    test('Given a membership with User in D, when a single-role write names the organization resource of B, then WorkOS refuses it with 404 entity_not_found and changes neither the roles nor the update time', proofOptions, async (t) => {
      const { organizationB } = await run.fixtures();
      const { memberships } = await run.administrationFixtures();
      const id = memberships.absentInD;
      const before = await membershipState(id);

      const refusal = await workos.authorization.assignRole(organizationRole(organizationB.id, id, 'super-admin')).then(() => undefined, (error: unknown) => error);
      const after = await membershipState(id);
      const answer = typeof refusal === 'object' && refusal !== null ? { status: Reflect.get(refusal, 'status'), code: Reflect.get(refusal, 'code') } : undefined;
      t.diagnostic(`assignment on the resource of another organization: ${JSON.stringify(answer ?? 'accepted')}`);

      assert.deepEqual(answer, { status: 404, code: 'entity_not_found' });
      assert.deepEqual(after, before);
    });
  });

  describe('Hosted live proofs (AUTH-08W): grant changes of the directory against WorkOS', () => {
    test('Given a member with User in D and the revision of a page, when the directory grants Admin on it, the same request comes again, and after a later revoke of Admin the old request comes again, then the grant is applied and keeps User, each later request is stale without a write, and the revoked grant does not return', proofOptions, async (t) => {
      const { memberships } = await run.administrationFixtures();
      const id = memberships.retryInD;
      const shown = await directory.member(id);
      assert.ok(shown, 'The directory does not find the membership.');
      const grant: DirectoryGrantChange = { membershipId: id, role: 'admin', action: 'grant', revision: shown.revision };

      const granted = await directory.changeGrant(grant);
      const afterGrant = await membershipState(id);
      const retried = await directory.changeGrant(grant);
      const afterRetry = await membershipState(id);
      const current = await directory.member(id);
      assert.ok(current, 'The directory does not find the membership after the grant.');
      const revoked = await directory.changeGrant({ membershipId: id, role: 'admin', action: 'revoke', revision: current.revision });
      const afterRevoke = await membershipState(id);
      const lateRetry = await directory.changeGrant(grant);
      const afterLateRetry = await membershipState(id);
      const latest = await directory.member(id);
      t.diagnostic(`outcomes: ${JSON.stringify([granted, retried, revoked, lateRetry].map(({ outcome }) => outcome))}; roles ${JSON.stringify(afterGrant.roles)} > ${JSON.stringify(afterRevoke.roles)}`);

      assert.deepEqual([granted.outcome, retried.outcome, revoked.outcome, lateRetry.outcome], ['applied', 'stale', 'applied', 'stale']);
      assert.deepEqual(afterGrant.roles, ['admin', 'user']);
      assert.deepEqual(afterRetry, afterGrant, 'The retry changed the membership.');
      assert.deepEqual([afterRevoke.status, afterRevoke.roles], ['active', ['user']]);
      assert.deepEqual(afterLateRetry, afterRevoke, 'The old request changed the membership.');
      // The roles and the status are the same as on the first page, but the update time is not.
      assert.ok(latest !== undefined && latest.revision !== shown.revision, 'The membership has the revision of the first page again.');
    });

    test('Given a member whose only application role in D is User and who has User in B, when the directory revokes User in D, then the membership stays active with only the default role member, its grants in D give no permission, and its membership in B keeps User', proofOptions, async (t) => {
      const { organizationB } = await run.fixtures();
      const { organizationD, users, memberships } = await run.administrationFixtures();
      const user = users['d-last-role'];
      const inBBefore = await membershipState(memberships.lastRoleInB);
      const shown = await directory.member(memberships.lastRoleInD);
      assert.ok(shown, 'The directory does not find the membership.');

      const revoked = await directory.changeGrant({ membershipId: shown.membershipId, role: 'user', action: 'revoke', revision: shown.revision });
      const inD = await membershipState(memberships.lastRoleInD);
      const grantsInD = await directory.activeGrants(user.id, organizationD.id);
      const grantsInB = await directory.activeGrants(user.id, organizationB.id);
      const inBAfter = await membershipState(memberships.lastRoleInB);
      t.diagnostic(`revoke ${revoked.outcome}; D: ${inD.status} ${JSON.stringify(inD.roles)}; B: ${inBAfter.status} ${JSON.stringify(inBAfter.roles)}`);

      assert.equal(revoked.outcome, 'applied');
      assert.deepEqual([inD.status, inD.roles], ['active', ['member']]);
      assert.deepEqual(grantsInD, [{ role: 'member', permissions: [] }]);
      assert.deepEqual(grantsInB, [{ role: 'user', permissions: ['product:access'] }]);
      assert.deepEqual(inBAfter, inBBefore);
    });

    test('Given an inactive membership and a pending membership from an invitation in D, when the directory grants Admin to each and revokes User from each on their current revisions, then each change is unsupported, and WorkOS keeps the status, the roles, and the update time of each', proofOptions, async (t) => {
      const { memberships } = await run.administrationFixtures();
      const ids = [memberships.inactiveInD, memberships.pendingInD];
      const before = await Promise.all(ids.map((id) => membershipState(id)));

      const outcomes: string[] = [];
      for (const id of ids) outcomes.push(...await grantAndRevokeOn(id));
      const after = await Promise.all(ids.map((id) => membershipState(id)));
      t.diagnostic(`before: ${JSON.stringify(before.map(({ status, roles }) => [status, roles]))}; outcomes: ${JSON.stringify(outcomes)}`);

      assert.deepEqual(before.map(({ status, roles }) => [status, roles]), [['inactive', ['user']], ['pending', ['user']]]);
      assert.deepEqual(outcomes, ['unsupported', 'unsupported', 'unsupported', 'unsupported']);
      assert.deepEqual(after, before);
    });
  });

  describe('Hosted live proofs (AUTH-08W): member reads, User seats, and invitations of the directory against WorkOS', () => {
    test('Given memberships of D in the statuses active, inactive, and pending, when the directory reads them in pages of two, then each status filter gives exactly the memberships of a direct WorkOS read with that filter, and the User seat count counts each active membership with User once: User and Admin is one seat, and Admin only, Super Admin only, the default role, pending, and inactive count zero', proofOptions, async (t) => {
      const { organizationD, memberships } = await run.administrationFixtures();
      for (const statuses of singleStatuses) await checkedPagedRead(t, organizationD.id, statuses);
      const every = await checkedPagedRead(t, organizationD.id, everyStatus);

      const seatReads: MembershipListRead[] = [];
      const seats = await activeUserSeatCount(pagedDirectory(seatReads), organizationD.id);
      const seatHolders = (await membershipsInWorkOS(organizationD.id, ['active'])).filter((membership) => rolesOf(membership).includes('user'));
      const summaries = seatMemberships.map(([name]) => memberSummary(every.members.find(({ membershipId }) => membershipId === memberships[name])));
      t.diagnostic(`User seats: ${seats} from ${seatReads.length} pages; direct WorkOS read: ${seatHolders.length}; seat proof memberships: ${JSON.stringify(summaries)}`);

      assert.ok(every.reads.length > 2, `The read of every status had ${every.reads.length} pages.`);
      assert.deepEqual(summaries, seatMemberships.map(([, summary]) => summary));
      assert.equal(seats, seatHolders.length);
      assert.ok(seatReads.length > 2, `The seat count read ${seatReads.length} pages.`);
    });

    test('Given an identity without a membership in D, when the directory invites it as Admin, sends again to its address and to an active member, resends, revokes, and then resends and revokes again, then the send gives a pending Admin invitation and a pending membership with only admin; both other sends are address-in-use without a second invitation; the resend and the revoke are applied; the revoked invitation is listed only as revoked and its membership stays pending without access; the last two changes are not-pending; and no result holds the token or the link of the invitation', proofOptions, async (t) => {
      const { organizationD, users } = await run.administrationFixtures();
      const invitee = users['d-invitee'];
      const organizationId = organizationD.id;

      const sent = await directory.sendInvitation({ organizationId, email: invitee.email, role: 'admin' });
      const invitation = await pendingInvitationTo(organizationId, invitee.email);
      const afterSend = await membershipStateOfUser(invitee.id, organizationId);
      const refusals = [
        await directory.sendInvitation({ organizationId, email: invitee.email.toUpperCase(), role: 'user' }),
        await directory.sendInvitation({ organizationId, email: users['d-member'].email, role: 'admin' }),
      ];
      const toAddress = (await invitationsInWorkOS(organizationId)).filter(({ email }) => email.toLowerCase() === invitee.email);
      const { invitationId } = invitation;
      const resent = await directory.resendInvitation(invitationId);
      const afterResend = await directory.invitation(invitationId);
      const revoked = await directory.revokeInvitation(invitationId);
      const afterRevoke = await directory.invitation(invitationId);
      const listedUnder = await statesListing(organizationId, invitationId);
      const again = [await directory.resendInvitation(invitationId), await directory.revokeInvitation(invitationId)];
      const afterAll = await membershipStateOfUser(invitee.id, organizationId);
      const grants = await directory.activeGrants(invitee.id, organizationId);
      const { token, acceptInvitationUrl } = await workos.userManagement.getInvitation(invitationId);
      const results = JSON.stringify([sent, invitation, refusals, resent, afterResend, revoked, afterRevoke, again]);
      t.diagnostic(`send ${sent.outcome}; other sends ${JSON.stringify(refusals.map(({ outcome }) => outcome))}; invitations to the address: ${toAddress.length}; resend ${resent.outcome}; revoke ${revoked.outcome}; again ${JSON.stringify(again.map(({ outcome }) => outcome))}`);
      t.diagnostic(`invitation: ${invitation.role} ${invitation.state} > ${String(afterResend?.state)} > ${String(afterRevoke?.state)}, listed as ${JSON.stringify(listedUnder)}; membership ${afterSend.status} ${JSON.stringify(afterSend.roles)} > ${afterAll.status} ${JSON.stringify(afterAll.roles)}`);

      assert.equal(sent.outcome, 'applied');
      assert.deepEqual([invitation.organizationId, invitation.role, invitation.state], [organizationId, 'admin', 'pending']);
      assert.deepEqual([afterSend.status, afterSend.roles], ['pending', ['admin']]);
      assert.deepEqual(refusals.map(({ outcome }) => outcome), ['address-in-use', 'address-in-use']);
      assert.equal(toAddress.length, 1, 'WorkOS has more than one invitation to the address.');
      assert.deepEqual([resent.outcome, afterResend?.state], ['applied', 'pending']);
      assert.deepEqual([revoked.outcome, afterRevoke?.state], ['applied', 'revoked']);
      assert.deepEqual(listedUnder, ['revoked']);
      assert.deepEqual(again.map(({ outcome }) => outcome), ['not-pending', 'not-pending']);
      assert.deepEqual([afterAll.status, afterAll.roles], ['pending', ['admin']]);
      assert.equal(grants, undefined, 'The membership of the revoked invitation gives access.');
      assert.ok(!results.includes(token) && !results.includes(acceptInvitationUrl), 'A directory result holds the token or the link of the invitation.');
    });
  });
}
