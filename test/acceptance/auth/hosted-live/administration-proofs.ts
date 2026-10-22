import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import type { Invitation, OrganizationMembership, WorkOS } from '@workos-inc/node';
import { WorkOSOrganizations } from '../../../../src/accounts/providers/workos/workos-organizations.ts';
import { workosAuthority } from '../../../../src/accounts/providers/workos/workos-settings.ts';
import { activeUserSeatCount } from '../../../../src/accounts/organizations/administration-overviews.ts';
import { invitationsOf } from '../../../../src/accounts/organizations/directory-reads.ts';
import type {
  InvitationState,
  MembershipStatus,
  OrganizationDirectory,
  OrganizationInvitation,
  OrganizationMember,
} from '../../../../src/accounts/organizations/organization-directory.ts';
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
  ['seatUserInD', 'active user'],
  ['seatDefaultInD', 'active member'],
  ['seatInactiveInD', 'inactive user'],
  ['seatPendingInD', 'pending user'],
];

function stateOf(membership: OrganizationMembership): MembershipState {
  return { status: membership.status, roles: rolesOf(membership), updatedAt: membership.updatedAt };
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
  const directory = new WorkOSOrganizations({ authority, userManagement: workos.userManagement, authorization: workos.authorization });

  function pagedDirectory(reads: MembershipListRead[]): WorkOSOrganizations {
    return new WorkOSOrganizations({ authority, userManagement: withPagesOfTwo(workos.userManagement, reads), authorization: workos.authorization });
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

  describe('Hosted live proofs (AUTH-08W): member reads, product member count, and invitations of the directory against WorkOS', () => {
    test('Given memberships of D in the statuses active, inactive, and pending, when the directory reads them in pages of two, then each status filter gives exactly the memberships of a direct WorkOS read with that filter, and the product member count counts each active User or Admin once; the default role, pending, and inactive count zero', proofOptions, async (t) => {
      const { organizationD, memberships } = await run.administrationFixtures();
      for (const statuses of singleStatuses) await checkedPagedRead(t, organizationD.id, statuses);
      const every = await checkedPagedRead(t, organizationD.id, everyStatus);

      const seatReads: MembershipListRead[] = [];
      const seats = await activeUserSeatCount(pagedDirectory(seatReads), organizationD.id);
      const seatHolders = (await membershipsInWorkOS(organizationD.id, ['active'])).filter((membership) => rolesOf(membership).some((role) => role === 'user' || role === 'admin'));
      const summaries = seatMemberships.map(([name]) => memberSummary(every.members.find(({ membershipId }) => membershipId === memberships[name])));
      t.diagnostic(`Product members: ${seats} from ${seatReads.length} pages; direct WorkOS read: ${seatHolders.length}; fixture memberships: ${JSON.stringify(summaries)}`);

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
