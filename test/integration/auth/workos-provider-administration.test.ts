import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import { GenericServerException } from '@workos-inc/node';
import { WorkOSAuthProvider } from '../../../src/accounts/providers/workos/workos-auth-provider.ts';
import { WorkOSOrganizations } from '../../../src/accounts/providers/workos/workos-organizations.ts';
import { workosMembershipReads } from '../../../src/accounts/providers/workos/workos-membership-reads.ts';
import { workosAuthority } from '../../../src/accounts/providers/workos/workos-settings.ts';
import { UnconfirmedChangeError, type ChangeOutcome, type ChangeRecord, type ChangeResult } from '../../../src/accounts/organizations/change-records.ts';
import {
  OrganizationAdministration,
  type Actor,
  type AdministrationRefusal,
  type InvitationChangeRequest,
  type InvitationSendRequest,
} from '../../../src/accounts/organizations/organization-administration.ts';
import { BillingRecorder } from '../../support/doubles/billing/billing-recorder.ts';
import { TeamBillingStub } from '../../support/doubles/billing/team-billing-stub.ts';
import { fakeClientId, type FakeAnswer } from '../../support/doubles/workos/workos-fake-api.ts';
import { WorkOSFake, type FakeInvitation, type FakeMembership, type FakeUser } from '../../support/doubles/workos/workos-fake.ts';

const authority = workosAuthority(fakeClientId);
const publicBaseUrl = 'https://thermus.example/team/';
const acme = 'org_01ACME';
const globex = 'org_01GLOBEX';
// Acme has an external ID, as each customer organization of the operator runbook has one. Globex has none.
const acmeExternalId = 'customer-acme';
const recordTime = '2026-10-14T09:00:00.000Z';
const internalError: FakeAnswer = { status: 500, body: { message: 'Internal error' } };

function person(name: string): FakeUser {
  return { id: `user_01${name.toUpperCase()}`, email: `${name}@example.com`, firstName: `${name.charAt(0).toUpperCase()}${name.slice(1)}` };
}

const sam = person('sam');
const dan = person('dan');
const cal = person('cal');
const ada = person('ada');
const bea = person('bea');
const hal = person('hal');
const eve = person('eve');
const gus = person('gus');
const pia = person('pia');

// Acme has six active product members: Sam, Dan, Cal, Ada, Bea, and Hal.
// Eve is inactive; Gus has the default role. Globex has Bea and Pia as Users. Six members are above the 5 seats of a free
// organization, so these cases use the team plan, which has no member limit.
const memberships: readonly FakeMembership[] = [
  { userId: sam.id, organizationId: acme, roles: ['admin'] },
  { userId: dan.id, organizationId: acme, roles: ['admin'] },
  { userId: cal.id, organizationId: acme, roles: ['admin'] },
  { userId: ada.id, organizationId: acme, roles: ['user', 'admin'] },
  { userId: bea.id, organizationId: acme, roles: ['user'] },
  { userId: hal.id, organizationId: acme, roles: ['user', 'admin'] },
  { userId: eve.id, organizationId: acme, roles: ['user', 'admin'], status: 'inactive' },
  { userId: gus.id, organizationId: acme, roles: [] },
  { userId: bea.id, organizationId: globex, roles: ['user'] },
  { userId: pia.id, organizationId: globex, roles: ['user'] },
];

function actorOf(user: FakeUser): Actor {
  return { user: { authority, subject: user.id, selectedOrganizationId: acme } };
}

const bySam = actorOf(sam);
const byDan = actorOf(dan);
const byCal = actorOf(cal);

function pendingInvitation(id: string, organizationId: string): FakeInvitation {
  return { id, email: 'guest@example.com', organizationId, roleSlug: 'user', state: 'pending', expiresAt: '2099-01-01T00:00:00.000Z' };
}

async function openSite(t: TestContext) {
  const world = await WorkOSFake.start(t, publicBaseUrl, [acme, globex]);
  world.memberships = memberships;
  world.organizationNames = { [acme]: 'Acme', [globex]: 'Globex' };
  world.organizationExternalIds = { [acme]: acmeExternalId };
  world.users = [sam, dan, cal, ada, bea, hal, eve, gus, pia];
  const { settings, workos, authkitKeySet } = world.connection();
  const organizations = new WorkOSOrganizations({ authority, memberships: workosMembershipReads(workos), userManagement: workos.userManagement, authorization: workos.authorization });
  const provider = new WorkOSAuthProvider({ authority, authkitIssuer: settings.authkitIssuer, mcpResourceUrl: world.mcpResourceUrl, keySet: authkitKeySet, grants: organizations });
  const records: ChangeRecord[] = [];
  const billing = new BillingRecorder(new TeamBillingStub());
  const service = new OrganizationAdministration({ directory: organizations, records: { record: (entry) => records.push(entry) }, billing, clock: () => new Date(recordTime) });
  return { world, organizations, provider, service, records, billing };
}

type Site = Awaited<ReturnType<typeof openSite>>;

interface Access {
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
}

async function accessWith(site: Site, token: string): Promise<Access | string> {
  const decision = await site.provider.resolve((await site.provider.verifyAccessToken(token)).user);
  return decision.allowed ? { roles: decision.context.grants.map(({ role }) => role), permissions: decision.context.permissions } : decision.reason;
}

function overviewOf<T extends object>(answer: T | AdministrationRefusal): T {
  if (typeof answer === 'string') assert.fail(`The service refused the overview: ${answer}`);
  return answer;
}

function invitedUser(site: Site, email: string): FakeUser {
  const user = site.world.users.find((candidate) => candidate.email === email);
  assert.ok(user, `WorkOS has no user with the address ${email}.`);
  return user;
}

interface WorkOSChange {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
}

function changesIn(site: Site): WorkOSChange[] {
  return site.world.fake.takeRequests().filter(({ method }) => method !== 'GET').map(({ method, path, body }) => ({ method, path, body }));
}

// The member page reads since the last call. A read of the memberships of one user names that user, so it is not a
// member page read.
function memberPageReads(site: Site): string[] {
  return site.world.fake.takeRequests()
    .map(({ path }) => decodeURIComponent(path))
    .filter((path) => path.startsWith('/user_management/organization_memberships?') && !path.includes('user_id='));
}

function invitationSend(email: string, role: string): WorkOSChange {
  return { method: 'POST', path: '/user_management/invitations', body: { email, organization_id: acme, role_slug: role } };
}

function actorRecord(actor: Actor): ChangeRecord['actor'] {
  return { authority: actor.user.authority, subject: actor.user.subject };
}

function sendRecord(actor: Actor, request: InvitationSendRequest, outcome: ChangeOutcome): ChangeRecord {
  const { organizationId, email, role } = request;
  return { time: recordTime, actor: actorRecord(actor), organizationId, target: { email }, action: 'invite', role, outcome };
}

// A resend or revoke record has the role of the invitation only when the invitation belongs to the organization of the
// request.
interface InvitationChangeEntry extends InvitationChangeRequest {
  readonly action: 'resend-invitation' | 'revoke-invitation';
  readonly role?: string;
}

function invitationRecord(actor: Actor, entry: InvitationChangeEntry, outcome: ChangeOutcome): ChangeRecord {
  const { organizationId, invitationId, action, role } = entry;
  return { time: recordTime, actor: actorRecord(actor), organizationId, target: { invitationId }, action, ...(role === undefined ? {} : { role }), outcome };
}

describe('Forged and foreign targets and actors without authority', () => {
  test('Given a foreign invitation and unsupported invitation roles, when an Admin attempts native changes, then each is denied without changing memberships or invitations', async (t) => {
    const site = await openSite(t);
    const globexInvitation = pendingInvitation('invitation_01GLOBEX', globex);
    site.world.invitations = [globexInvitation];
    const before = { memberships: site.world.memberships, invitations: site.world.invitations };
    const foreign = { organizationId: acme, invitationId: globexInvitation.id };
    const forged = ['super-admin', 'owner'].map((role) => ({ organizationId: acme, email: 'guest@example.com', role }));

    const outcomes = await Promise.all([
      ...forged.map((request) => site.service.sendInvitation(byDan, request)),
      site.service.resendInvitation(byDan, foreign),
      site.service.revokeInvitation(byDan, foreign),
    ]);

    assert.deepEqual(outcomes, ['denied', 'denied', 'denied', 'denied']);
    assert.deepEqual(changesIn(site), []);
    assert.deepEqual({ memberships: site.world.memberships, invitations: site.world.invitations }, before);
    assert.deepEqual(site.records.map(({ outcome }) => outcome), outcomes);
  });

  test('Given an actor of another authority with the subject of an Admin, when it asks for administration in Acme, then each operation is denied with change records before any WorkOS read', async (t) => {
    const site = await openSite(t);
    const acmeInvitation = pendingInvitation('invitation_01ACME', acme);
    site.world.invitations = [acmeInvitation];
    const send = { organizationId: acme, email: 'newcomer@example.com', role: 'user' };
    const invitation = { organizationId: acme, invitationId: acmeInvitation.id };
    const refusals = [
      { actor: { user: { authority: 'local:installation-1', subject: dan.id, selectedOrganizationId: acme } }, refusal: 'denied' as const },
    ];
    site.world.fake.takeRequests();

    const answers = [];
    for (const { actor } of refusals) {
      answers.push([
        await site.service.memberOverview(actor, acme),
        await site.service.invitationOverview(actor, acme),
        await site.service.sendInvitation(actor, send),
        await site.service.resendInvitation(actor, invitation),
        await site.service.revokeInvitation(actor, invitation),
      ]);
    }

    assert.deepEqual(answers, refusals.map(({ refusal }) => Array.from({ length: 5 }, () => refusal)));
    assert.deepEqual(site.world.fake.takeRequests(), []);
    assert.deepEqual(site.records, refusals.flatMap(({ actor, refusal }) => [
      sendRecord(actor, send, refusal),
      invitationRecord(actor, { ...invitation, action: 'resend-invitation' }, refusal),
      invitationRecord(actor, { ...invitation, action: 'revoke-invitation' }, refusal),
    ]));
  });
});

describe('Inactive memberships and invitations with the real WorkOS directory', () => {
  test('Given Eve with an inactive membership in Acme that had User and Admin, when Dan invites Eve as Admin and Eve accepts in the provider fake, then the invitation makes the membership pending with only Admin, and the acceptance makes it active with only Admin, so that no User returns; WorkOS gets only the send, and no membership create, update, deactivation, reactivation, or deletion', async (t) => {
    const site = await openSite(t);
    const eveId = site.world.membershipId(eve, acme);
    const invite = { organizationId: acme, email: eve.email, role: 'admin' };

    const outcome = await site.service.sendInvitation(byDan, invite);
    const pending = await site.organizations.member(eveId);
    const invitation = site.world.invitations.find(({ email }) => email === eve.email);
    assert.ok(invitation, 'WorkOS has no invitation for Eve.');
    site.world.acceptInvitation(invitation.id);
    const active = await site.organizations.member(eveId);
    const access = await accessWith(site, await site.world.connectToken(eve, { org_id: acme }));
    const invitations = overviewOf(await site.service.invitationOverview(byDan, acme));

    assert.equal(outcome, 'applied');
    assert.deepEqual([pending?.status, pending?.grants.map(({ role }) => role)], ['pending', ['admin']]);
    assert.deepEqual([active?.status, active?.grants.map(({ role }) => role)], ['active', ['admin']]);
    assert.deepEqual(access, { roles: ['admin'], permissions: ['product:access', 'user-grants:manage', 'admin-grants:manage', 'billing:manage'] });
    assert.deepEqual(invitations.invitations, [{ invitationId: invitation.id, email: eve.email, role: 'admin', state: 'accepted', expiresAt: invitation.expiresAt, changes: [] }]);
    assert.deepEqual(changesIn(site), [invitationSend(eve.email, 'admin')]);
    assert.deepEqual(site.records, [sendRecord(byDan, invite, 'applied')]);
  });

  test('Given Cal and Sam with Admin alone, when each sends invitations, then both manage either invitation role, duplicates change nothing, and invited addresses and active members give address-in-use', async (t) => {
    const site = await openSite(t);
    const invite = (email: string, role: string): InvitationSendRequest => ({ organizationId: acme, email, role });
    const sends: (readonly [Actor, InvitationSendRequest])[] = [
      [byCal, invite('lee@example.com', 'owner')],
      [bySam, invite('lee@example.com', 'super-admin')],
      [bySam, invite('lee@example.com', 'admin')],
      [bySam, invite('LEE@Example.COM', 'admin')],
      [byCal, invite('lee@example.com', 'user')],
      [byCal, invite(bea.email, 'user')],
      [byCal, invite('kim@example.com', 'user')],
    ];

    const outcomes: ChangeResult[] = [];
    for (const [actor, request] of sends) outcomes.push(await site.service.sendInvitation(actor, request));
    const lee = await site.organizations.member(site.world.membershipId(invitedUser(site, 'lee@example.com'), acme));
    const overviews = [overviewOf(await site.service.invitationOverview(byCal, acme)), overviewOf(await site.service.invitationOverview(bySam, acme))];

    assert.deepEqual(outcomes, ['denied', 'denied', 'applied', 'unchanged', 'address-in-use', 'address-in-use', 'applied']);
    assert.deepEqual(changesIn(site), [
      invitationSend('lee@example.com', 'admin'),
      invitationSend('lee@example.com', 'user'),
      invitationSend(bea.email, 'user'),
      invitationSend('kim@example.com', 'user'),
    ]);
    assert.deepEqual([lee?.status, lee?.grants.map(({ role }) => role)], ['pending', ['admin']]);
    assert.deepEqual(overviews.map(({ invitableRoles, identityPolicy, invitations }) => ({
      invitableRoles,
      identityPolicy,
      invitations: invitations.map(({ email, role, state, changes }) => `${email}: ${role} ${state}, ${changes.join(' ') || 'no change'}`),
    })), [
      { invitableRoles: ['user', 'admin'], identityPolicy: 'provider-rules', invitations: ['lee@example.com: admin pending, resend revoke', 'kim@example.com: user pending, resend revoke'] },
      { invitableRoles: ['user', 'admin'], identityPolicy: 'provider-rules', invitations: ['lee@example.com: admin pending, resend revoke', 'kim@example.com: user pending, resend revoke'] },
    ]);
    assert.deepEqual(site.records, sends.map(([actor, request], index) => sendRecord(actor, request, outcomes[index])));
  });

  test('Given User invitations of Dan that WorkOS shows as accepted, revoked, expired, and pending, when Dan reads the invitation overview and then resends and revokes each, then the overview shows the WorkOS state of each without a token or link, only the pending invitation changes, and each other change is not-pending with its record and without a WorkOS change', async (t) => {
    const site = await openSite(t);
    const sends = ['one', 'two', 'three', 'four'].map((name) => ({ organizationId: acme, email: `${name}@example.com`, role: 'user' }));
    for (const send of sends) assert.equal(await site.service.sendInvitation(byDan, send), 'applied');
    const [accepted, revoked, expired, pending] = site.world.invitations.map(({ id }) => id);
    site.world.acceptInvitation(accepted);
    const revokedBefore = { organizationId: acme, invitationId: revoked };
    assert.equal(await site.service.revokeInvitation(byDan, revokedBefore), 'applied');
    site.world.expireInvitation(expired);
    changesIn(site);

    const overview = overviewOf(await site.service.invitationOverview(byDan, acme));
    const expiryTimes = site.world.invitations.map(({ expiresAt }) => expiresAt);
    const outcomes: ChangeResult[] = [];
    for (const invitationId of [accepted, revoked, expired, pending]) {
      outcomes.push(await site.service.resendInvitation(byDan, { organizationId: acme, invitationId }));
      outcomes.push(await site.service.revokeInvitation(byDan, { organizationId: acme, invitationId }));
    }

    const changeRecords = (invitationId: string, outcome: ChangeOutcome) => (['resend-invitation', 'revoke-invitation'] as const)
      .map((action) => invitationRecord(byDan, { organizationId: acme, invitationId, action, role: 'user' }, outcome));
    assert.deepEqual(overview.invitations.map(({ expiresAt: _expiresAt, ...invitation }) => invitation), [
      { invitationId: accepted, email: 'one@example.com', role: 'user', state: 'accepted', changes: [] },
      { invitationId: revoked, email: 'two@example.com', role: 'user', state: 'revoked', changes: [] },
      { invitationId: expired, email: 'three@example.com', role: 'user', state: 'expired', changes: [] },
      { invitationId: pending, email: 'four@example.com', role: 'user', state: 'pending', changes: ['resend', 'revoke'] },
    ]);
    assert.deepEqual(overview.invitations.map(({ expiresAt }) => expiresAt), expiryTimes);
    assert.deepEqual([overview.invitableRoles, overview.identityPolicy], [['user', 'admin'], 'provider-rules']);
    assert.doesNotMatch(JSON.stringify(overview), /invitation-token|authkit\.fake\.example/);
    assert.deepEqual(outcomes, ['not-pending', 'not-pending', 'not-pending', 'not-pending', 'not-pending', 'not-pending', 'applied', 'applied']);
    assert.deepEqual(changesIn(site), [
      { method: 'POST', path: `/user_management/invitations/${pending}/resend`, body: {} },
      { method: 'POST', path: `/user_management/invitations/${pending}/revoke`, body: undefined },
    ]);
    assert.deepEqual(site.records, [
      ...sends.map((send) => sendRecord(byDan, send, 'applied')),
      invitationRecord(byDan, { ...revokedBefore, action: 'revoke-invitation', role: 'user' }, 'applied'),
      ...changeRecords(accepted, 'not-pending'),
      ...changeRecords(revoked, 'not-pending'),
      ...changeRecords(expired, 'not-pending'),
      ...changeRecords(pending, 'applied'),
    ]);
  });
});

describe('Member pages and WorkOS outages', () => {
  test('Given WorkOS member pages of two that repeat one membership on the next page, when Dan reads the member overview, then each membership of Acme shows once with its status and application roles, the count includes each active product member once, including Admin alone, while default-role, pending, and inactive memberships count zero', async (t) => {
    const site = await openSite(t);
    site.world.membershipPageSize = 2;
    site.world.membershipPageOverlap = 1;
    const invited = { organizationId: acme, email: 'newcomer@example.com', role: 'user' };
    assert.equal(await site.service.sendInvitation(byDan, invited), 'applied');
    changesIn(site);

    const overview = overviewOf(await site.service.memberOverview(byDan, acme));
    const pageReads = memberPageReads(site);

    assert.deepEqual(overview.members.map(({ email, status, roles }) => `${email}: ${status}, ${roles.join(' ') || 'no role'}`), [
      'sam@example.com: active, admin',
      'dan@example.com: active, admin',
      'cal@example.com: active, admin',
      'ada@example.com: active, user admin',
      'bea@example.com: active, user',
      'hal@example.com: active, user admin',
      'eve@example.com: inactive, user admin',
      'gus@example.com: active, no role',
      'newcomer@example.com: pending, user',
    ]);
    assert.equal(overview.activeUserSeats, 6);
    assert.equal(overview.members.find(({ email }) => email === dan.email)?.subject, dan.id);
    assert.ok(pageReads.length >= 5, `WorkOS gave the members on ${pageReads.length} pages.`);
    for (const path of pageReads) {
      assert.match(path, new RegExp(`organization_id=${acme}&`));
      assert.match(path, /statuses=active,inactive,pending/);
    }
    assert.deepEqual(site.billing.updates, []);
    assert.deepEqual(changesIn(site), []);
    assert.deepEqual(site.records, [sendRecord(byDan, invited, 'applied')]);
  });

  test('Given a WorkOS outage on the later member pages and then on the invitation reads, when Dan reads the overviews and sends an invitation, then each overview rejects without a partial result, billing gets no count, and the send fails with a failed record before any WorkOS send', async (t) => {
    const site = await openSite(t);
    site.world.membershipPageSize = 3;
    const send = { organizationId: acme, email: 'newcomer@example.com', role: 'user' };

    site.world.laterMembershipPageOutage = internalError;
    await assert.rejects(site.service.memberOverview(byDan, acme), GenericServerException);
    site.world.laterMembershipPageOutage = undefined;
    site.world.invitationOutage = internalError;
    await assert.rejects(site.service.invitationOverview(byDan, acme), GenericServerException);
    await assert.rejects(site.service.sendInvitation(byDan, send), GenericServerException);

    assert.deepEqual(site.world.rolesOf(gus, acme), ['member']);
    assert.deepEqual(changesIn(site), []);
    assert.deepEqual(site.billing.updates, []);
    assert.deepEqual(site.records, [sendRecord(byDan, send, 'failed')]);
  });
});

describe('Unconfirmed native invitation writes', () => {
  test('Given WorkOS creates the invitation but closes the connection before its response, when an Admin sends and then checks current invitations, then the outcome stays unconfirmed and the SDK sends only once', async (t) => {
    const site = await openSite(t);
    const request = { organizationId: acme, email: 'lost-answer@example.com', role: 'admin' };
    site.world.fake.intercept('POST /user_management/invitations', async (_request, respond) => {
      await respond();
      return 'close' as const;
    });

    await assert.rejects(site.service.sendInvitation(byDan, request), UnconfirmedChangeError);
    const current = overviewOf(await site.service.invitationOverview(byDan, acme));

    assert.equal(current.invitations[0]?.state, 'pending');
    assert.equal(current.invitations[0]?.role, 'admin');
    assert.deepEqual(changesIn(site), [invitationSend(request.email, request.role)]);
    assert.deepEqual(site.records, [sendRecord(byDan, request, 'unknown')]);
  });

  for (const [operation, action] of [['resendInvitation', 'resend'], ['revokeInvitation', 'revoke']] as const) {
    test(`Given a native ${action} response has no invitation data, when an Admin checks the pending invitation, then the write remains unconfirmed and no SDK write repeats`, async (t) => {
      const site = await openSite(t);
      const invitation = pendingInvitation('invitation_01ACME', acme);
      site.world.invitations = [invitation];
      const path = `/user_management/invitations/${invitation.id}/${action}`;
      site.world.fake.answer(`POST ${path}`, { status: 200, body: {} });

      await assert.rejects(site.service[operation](byDan, { organizationId: acme, invitationId: invitation.id }), UnconfirmedChangeError);
      const current = overviewOf(await site.service.invitationOverview(byDan, acme));

      assert.equal(current.invitations[0]?.state, 'pending');
      assert.deepEqual(changesIn(site).map(({ method, path }) => ({ method, path })), [{ method: 'POST', path }]);
      assert.deepEqual(site.records.map(({ outcome }) => outcome), ['unknown']);
    });
  }
});
