import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import { GenericServerException } from '@workos-inc/node';
import { WorkOSAuthProvider } from '../../../src/auth/hosted-auth/workos/workos-auth-provider.ts';
import { WorkOSOrganizations } from '../../../src/auth/hosted-auth/workos/workos-organizations.ts';
import { workosAuthority } from '../../../src/auth/hosted-auth/workos/workos-settings.ts';
import type { MemberEntry, MemberOverview } from '../../../src/organizations/administration-overviews.ts';
import type { ChangeOutcome, ChangeRecord, ChangeResult } from '../../../src/organizations/change-records.ts';
import {
  OrganizationAdministration,
  type Actor,
  type AdministrationRefusal,
  type GrantChangeRequest,
  type InvitationChangeRequest,
  type InvitationSendRequest,
} from '../../../src/organizations/organization-administration.ts';
import { BillingRecorder } from '../../support/billing-recorder.ts';
import { fakeClientId, type FakeAnswer } from '../../support/workos-fake-api.ts';
import { WorkOSWorld, type WorldInvitation, type WorldMembership, type WorldUser } from '../../support/workos-world.ts';

// The real WorkOSOrganizations and WorkOSAuthProvider with the pinned SDK against a local fake of the WorkOS API,
// together with the real OrganizationAdministration, called directly as a service, and the real access resolution of
// Connect tokens. The fake keeps the roles of each membership as single-role assignments, the invitations, and the
// users, as the probes of WorkOS staging showed. Each test checks the result, the change records, and the WorkOS
// requests that change something. These tests do not show what the WorkOS service sends; the hosted live gate does.

const authority = workosAuthority(fakeClientId);
const publicBaseUrl = 'https://thermus.example/team/';
const acme = 'org_01ACME';
const globex = 'org_01GLOBEX';
// Acme has an external ID, as each customer organization of the operator runbook has one. Globex has none.
const acmeExternalId = 'customer-acme';
const recordTime = '2026-10-14T09:00:00.000Z';
const internalError: FakeAnswer = { status: 500, body: { message: 'Internal error' } };

function person(name: string): WorldUser {
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

// Acme: Sam has only Super Admin, Dan Super Admin and Admin, Cal only Admin, Ada and Hal User and Admin, Bea only
// User, Eve an inactive membership that had User and Admin, and Gus only the default role. Globex: Bea and Pia have
// User. Thus Acme has three active User seats: Ada, Bea, and Hal.
const memberships: readonly WorldMembership[] = [
  { userId: sam.id, organizationId: acme, roles: ['super-admin'] },
  { userId: dan.id, organizationId: acme, roles: ['super-admin', 'admin'] },
  { userId: cal.id, organizationId: acme, roles: ['admin'] },
  { userId: ada.id, organizationId: acme, roles: ['user', 'admin'] },
  { userId: bea.id, organizationId: acme, roles: ['user'] },
  { userId: hal.id, organizationId: acme, roles: ['user', 'admin'] },
  { userId: eve.id, organizationId: acme, roles: ['user', 'admin'], status: 'inactive' },
  { userId: gus.id, organizationId: acme, roles: [] },
  { userId: bea.id, organizationId: globex, roles: ['user'] },
  { userId: pia.id, organizationId: globex, roles: ['user'] },
];

function actorOf(user: WorldUser): Actor {
  return { user: { authority, subject: user.id, selectedOrganizationId: acme }, mfaCompleted: true };
}

const bySam = actorOf(sam);
const byDan = actorOf(dan);
const byCal = actorOf(cal);

function pendingInvitation(id: string, organizationId: string): WorldInvitation {
  return { id, email: 'guest@example.com', organizationId, roleSlug: 'user', state: 'pending', expiresAt: '2099-01-01T00:00:00.000Z' };
}

async function openSite(t: TestContext) {
  const world = await WorkOSWorld.start(t, publicBaseUrl, [acme, globex]);
  world.memberships = memberships;
  world.organizationNames = { [acme]: 'Acme', [globex]: 'Globex' };
  world.organizationExternalIds = { [acme]: acmeExternalId };
  world.users = [sam, dan, cal, ada, bea, hal, eve, gus, pia];
  const { settings, workos, authkitKeySet } = world.connection();
  const organizations = new WorkOSOrganizations({ authority, userManagement: workos.userManagement, authorization: workos.authorization, organizations: workos.organizations });
  const provider = new WorkOSAuthProvider({ authority, authkitIssuer: settings.authkitIssuer, mcpResourceUrl: world.mcpResourceUrl, keySet: authkitKeySet, grants: organizations });
  const records: ChangeRecord[] = [];
  const billing = new BillingRecorder();
  const service = new OrganizationAdministration({ directory: organizations, records: { record: (entry) => records.push(entry) }, billing, clock: () => new Date(recordTime) });
  return { world, organizations, provider, service, records, billing };
}

type Site = Awaited<ReturnType<typeof openSite>>;

// A grant change such as 'grant user' in Acme, at the revision that WorkOS gives now, as a members page shows it.
async function changeAt(site: Site, membershipId: string, change: string): Promise<GrantChangeRequest> {
  const [action = '', role = ''] = change.split(' ');
  const member = await site.organizations.member(membershipId);
  assert.ok(member, `WorkOS has no membership ${membershipId}.`);
  return { organizationId: acme, membershipId, role, action, revision: member.revision };
}

interface Access {
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
}

// The access that a Connect token gives now: the provider verifies the token and resolves the current WorkOS grants.
async function accessWith(site: Site, token: string): Promise<Access | string> {
  const decision = await site.provider.resolve((await site.provider.verifyAccessToken(token)).user);
  return decision.allowed ? { roles: decision.context.grants.map(({ role }) => role), permissions: decision.context.permissions } : decision.reason;
}

function overviewOf<T extends object>(answer: T | AdministrationRefusal): T {
  if (typeof answer === 'string') assert.fail(`The service refused the overview: ${answer}`);
  return answer;
}

function entryOf(overview: MemberOverview, membershipId: string): MemberEntry {
  const entry = overview.members.find((member) => member.membershipId === membershipId);
  assert.ok(entry, `The member overview has no membership ${membershipId}.`);
  return entry;
}

function invitedUser(site: Site, email: string): WorldUser {
  const user = site.world.users.find((candidate) => candidate.email === email);
  assert.ok(user, `WorkOS has no user with the address ${email}.`);
  return user;
}

interface WorkOSChange {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
}

// The WorkOS requests since the last call, without the reads: only the requests that change something.
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

// A single-role write on the authorization resource of Acme. WorkOS names that resource by the external ID of Acme,
// not by its organization ID.
function roleWrite(method: 'POST' | 'DELETE', membershipId: string, role: string): WorkOSChange {
  return {
    method,
    path: `/authorization/organization_memberships/${membershipId}/role_assignments`,
    body: { role_slug: role, resource_type_slug: 'organization', resource_external_id: acmeExternalId },
  };
}

function invitationSend(email: string, role: string): WorkOSChange {
  return { method: 'POST', path: '/user_management/invitations', body: { email, organization_id: acme, role_slug: role } };
}

// The memberships of WorkOS other than those of these users in Acme.
function otherMemberships(all: readonly WorldMembership[], changed: readonly WorldUser[]): WorldMembership[] {
  return all.filter(({ userId, organizationId }) => organizationId !== acme || !changed.some(({ id }) => id === userId));
}

// The roles after these single-role changes, one after the other.
function rolesAfter(start: readonly string[], changes: readonly GrantChangeRequest[]): string[] {
  return changes.reduce<string[]>((roles, { action, role }) => (action === 'grant' ? [...roles, role] : roles.filter((slug) => slug !== role)), [...start]);
}

// Concurrent work can finish in any order, so a comparison sorts both lists first.
function inAnyOrder<T>(items: readonly T[]): T[] {
  return items.toSorted((first, second) => JSON.stringify(first).localeCompare(JSON.stringify(second)));
}

// Lets another administrator change a membership in WorkOS while the service reads the user of a member: after the
// service read the revision and before the directory reads the membership again for its write. The user read still
// gets the answer that the world gave before.
async function changeDuringUserRead(site: Site, user: WorldUser, change: () => void): Promise<void> {
  const path = `/user_management/users/${user.id}`;
  const answer: FakeAnswer = { status: 200, body: await (await fetch(new URL(path, site.world.fake.origin))).json() };
  site.world.fake.answer(`GET ${path}`, () => {
    change();
    return answer;
  });
}

function actorRecord(actor: Actor): ChangeRecord['actor'] {
  return { authority: actor.user.authority, subject: actor.user.subject };
}

// A grant change record has the target, the action, and the role as requested.
function grantRecord(actor: Actor, request: GrantChangeRequest, outcome: ChangeOutcome): ChangeRecord {
  const { organizationId, membershipId, action, role } = request;
  return { time: recordTime, actor: actorRecord(actor), organizationId, target: { membershipId }, action, role, outcome };
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

describe('WorkOS grant changes by direct calls of the organization service', () => {
  test('Given Sam with only Super Admin, Cal with only Admin, and Dan with both in Acme, when each asks the service for grant changes, then Sam alone cannot change User, grants Admin and then User to itself, and regrants Admin after it revoked it; Cal cannot grant Admin, and Dan grants Admin to Bea; each applied change is one single-role WorkOS write on Acme, and no other membership changes', async (t) => {
    const site = await openSite(t);
    const samId = site.world.membershipId(sam, acme);
    const beaId = site.world.membershipId(bea, acme);

    const samAlone = await changeAt(site, samId, 'grant user');
    const outcomes = [await site.service.changeGrant(bySam, samAlone)];
    const samAdmin = await changeAt(site, samId, 'grant admin');
    outcomes.push(await site.service.changeGrant(bySam, samAdmin));
    const samUser = await changeAt(site, samId, 'grant user');
    outcomes.push(await site.service.changeGrant(bySam, samUser));
    const calAdmin = await changeAt(site, beaId, 'grant admin');
    outcomes.push(await site.service.changeGrant(byCal, calAdmin));
    const danAdmin = await changeAt(site, beaId, 'grant admin');
    outcomes.push(await site.service.changeGrant(byDan, danAdmin));
    const samRevoke = await changeAt(site, samId, 'revoke admin');
    outcomes.push(await site.service.changeGrant(bySam, samRevoke));
    const samRegrant = await changeAt(site, samId, 'grant admin');
    outcomes.push(await site.service.changeGrant(bySam, samRegrant));

    assert.deepEqual(outcomes, ['denied', 'applied', 'applied', 'denied', 'applied', 'applied', 'applied']);
    assert.deepEqual(changesIn(site), [
      roleWrite('POST', samId, 'admin'),
      roleWrite('POST', samId, 'user'),
      roleWrite('POST', beaId, 'admin'),
      roleWrite('DELETE', samId, 'admin'),
      roleWrite('POST', samId, 'admin'),
    ]);
    assert.deepEqual([site.world.rolesOf(sam, acme), site.world.rolesOf(bea, acme)], [['super-admin', 'user', 'admin'], ['user', 'admin']]);
    assert.deepEqual(otherMemberships(site.world.memberships, [sam, bea]), otherMemberships(memberships, [sam, bea]));
    assert.deepEqual(site.records, [
      grantRecord(bySam, samAlone, 'denied'),
      grantRecord(bySam, samAdmin, 'applied'),
      grantRecord(bySam, samUser, 'applied'),
      grantRecord(byCal, calAdmin, 'denied'),
      grantRecord(byDan, danAdmin, 'applied'),
      grantRecord(bySam, samRevoke, 'applied'),
      grantRecord(bySam, samRegrant, 'applied'),
    ]);
    assert.deepEqual(site.billing.updates, [`${acme}: 4`]);
  });

  test('Given Ada and Hal with User and Admin in Acme and their Connect tokens from before any change, when Dan revokes Admin from Ada and Cal revokes User from Hal, then the token of Ada keeps product access while each administration operation of Ada is denied, and the token of Hal gives no product access while Hal still manages User and grants it to itself again', async (t) => {
    const site = await openSite(t);
    const [adaId, halId, gusId] = [ada, hal, gus].map((user) => site.world.membershipId(user, acme));
    const [byAda, byHal] = [ada, hal].map(actorOf);
    const adaToken = await site.world.connectToken(ada, { org_id: acme });
    const halToken = await site.world.connectToken(hal, { org_id: acme });
    const before = [await accessWith(site, adaToken), await accessWith(site, halToken)];

    const adaAdmin = await changeAt(site, adaId, 'revoke admin');
    const outcomes = [await site.service.changeGrant(byDan, adaAdmin)];
    const adaAccess = await accessWith(site, adaToken);
    const adaGrant = await changeAt(site, gusId, 'grant user');
    const adaInvitation = { organizationId: acme, email: 'friend@example.com', role: 'user' };
    const adaAnswers = [
      await site.service.memberOverview(byAda, acme),
      await site.service.invitationOverview(byAda, acme),
      await site.service.changeGrant(byAda, adaGrant),
      await site.service.sendInvitation(byAda, adaInvitation),
    ];
    const halUser = await changeAt(site, halId, 'revoke user');
    outcomes.push(await site.service.changeGrant(byCal, halUser));
    const halAccess = await accessWith(site, halToken);
    const halMembers = overviewOf(await site.service.memberOverview(byHal, acme));
    const halRegrant = await changeAt(site, halId, 'grant user');
    outcomes.push(await site.service.changeGrant(byHal, halRegrant));
    const halAccessAgain = await accessWith(site, halToken);

    const userAndAdmin = { roles: ['user', 'admin'], permissions: ['product:access', 'user-grants:manage'] };
    assert.deepEqual(before, [userAndAdmin, userAndAdmin]);
    assert.deepEqual(outcomes, ['applied', 'applied', 'applied']);
    assert.deepEqual(adaAccess, { roles: ['user'], permissions: ['product:access'] });
    assert.deepEqual(adaAnswers, ['denied', 'denied', 'denied', 'denied']);
    assert.deepEqual(halAccess, { roles: ['admin'], permissions: ['user-grants:manage'] });
    assert.deepEqual([entryOf(halMembers, halId).changes, entryOf(halMembers, adaId).changes], [[{ role: 'user', action: 'grant' }], [{ role: 'user', action: 'revoke' }]]);
    assert.deepEqual(halAccessAgain, { roles: ['admin', 'user'], permissions: ['user-grants:manage', 'product:access'] });
    assert.deepEqual(changesIn(site), [roleWrite('DELETE', adaId, 'admin'), roleWrite('DELETE', halId, 'user'), roleWrite('POST', halId, 'user')]);
    assert.deepEqual(site.records, [
      grantRecord(byDan, adaAdmin, 'applied'),
      grantRecord(byAda, adaGrant, 'denied'),
      sendRecord(byAda, adaInvitation, 'denied'),
      grantRecord(byCal, halUser, 'applied'),
      grantRecord(byHal, halRegrant, 'applied'),
    ]);
    assert.deepEqual(site.billing.updates, [`${acme}: 2`, `${acme}: 3`]);
  });

  test('Given Bea with only User in Acme and User in Globex, when Cal revokes its last grant in Acme, then WorkOS keeps the membership active with only the default role, the service lists only Globex and refuses a selection of Acme, the Acme token of Bea resolves without any permission, and its Globex token keeps product access', async (t) => {
    const site = await openSite(t);
    const beaId = site.world.membershipId(bea, acme);
    const acmeToken = await site.world.connectToken(bea, { org_id: acme });
    const globexToken = await site.world.connectToken(bea, { org_id: globex });
    const beaUser = (await site.provider.verifyAccessToken(acmeToken)).user;
    const listedBefore = await site.service.listOrganizations(beaUser);

    const revoke = await changeAt(site, beaId, 'revoke user');
    const outcome = await site.service.changeGrant(byCal, revoke);
    const listed = await site.service.listOrganizations(beaUser);
    const selections = [await site.service.authorizeSelection(beaUser, acme), await site.service.authorizeSelection(beaUser, globex)];
    const access = [await accessWith(site, acmeToken), await accessWith(site, globexToken)];
    const members = overviewOf(await site.service.memberOverview(byCal, acme));

    const inGlobex = { organizationId: globex, organizationName: 'Globex', selected: false };
    assert.equal(outcome, 'applied');
    assert.deepEqual(listedBefore, [{ organizationId: acme, organizationName: 'Acme', selected: true }, inGlobex]);
    assert.deepEqual([site.world.statusOf(bea, acme), site.world.rolesOf(bea, acme)], ['active', ['member']]);
    assert.deepEqual(listed, [inGlobex]);
    assert.deepEqual(selections, [undefined, inGlobex]);
    assert.deepEqual(access, [{ roles: ['member'], permissions: [] }, { roles: ['user'], permissions: ['product:access'] }]);
    assert.deepEqual([entryOf(members, beaId).status, entryOf(members, beaId).roles, members.activeUserSeats], ['active', [], 2]);
    assert.deepEqual(changesIn(site), [roleWrite('DELETE', beaId, 'user')]);
    assert.deepEqual(site.records, [grantRecord(byCal, revoke, 'applied')]);
    assert.deepEqual(site.billing.updates, [`${acme}: 2`]);
  });

  test('Given Globex, which has no external ID, and Pia with User and Admin in Globex, when Pia revokes User from Bea in Globex, then the one single-role WorkOS write names the authorization resource of Globex by its organization ID, Bea keeps User in Acme, and billing gets the one User seat of Pia in Globex', async (t) => {
    const site = await openSite(t);
    site.world.setRoles(pia, globex, ['user', 'admin']);
    const beaInGlobex = site.world.membershipId(bea, globex);
    const byPia: Actor = { user: { authority, subject: pia.id, selectedOrganizationId: globex }, mfaCompleted: true };
    const revoke = { ...await changeAt(site, beaInGlobex, 'revoke user'), organizationId: globex };
    changesIn(site);

    const outcome = await site.service.changeGrant(byPia, revoke);

    assert.equal(outcome, 'applied');
    assert.deepEqual(changesIn(site), [{
      method: 'DELETE',
      path: `/authorization/organization_memberships/${beaInGlobex}/role_assignments`,
      body: { role_slug: 'user', resource_type_slug: 'organization', resource_external_id: globex },
    }]);
    assert.deepEqual([site.world.rolesOf(bea, globex), site.world.rolesOf(bea, acme)], [['member'], ['user']]);
    assert.deepEqual(site.records, [grantRecord(byPia, revoke, 'applied')]);
    assert.deepEqual(site.billing.updates, [`${globex}: 1`]);
  });
});

describe('Forged and foreign targets and actors without authority', () => {
  test('Given Dan with Admin and Super Admin in Acme, when direct service calls name memberships of Globex, the inactive Eve, a pending membership from an invitation, Super Admin, an unknown role, the actions disable, deactivate, reset-password, and delete, and a resend and a revoke of a Globex invitation, then each is denied with its record, WorkOS gets no write, and no membership or invitation changes', async (t) => {
    const site = await openSite(t);
    const globexInvitation = pendingInvitation('invitation_01GLOBEX', globex);
    site.world.invitations = [globexInvitation];
    const invited = { organizationId: acme, email: 'newcomer@example.com', role: 'user' };
    assert.equal(await site.service.sendInvitation(byDan, invited), 'applied');
    const newcomer = invitedUser(site, invited.email);
    assert.equal(site.world.statusOf(newcomer, acme), 'pending');
    const beaId = site.world.membershipId(bea, acme);
    const forged = [
      await changeAt(site, site.world.membershipId(pia, globex), 'grant admin'),
      await changeAt(site, site.world.membershipId(bea, globex), 'grant admin'),
      await changeAt(site, site.world.membershipId(eve, acme), 'revoke admin'),
      await changeAt(site, site.world.membershipId(newcomer, acme), 'grant admin'),
      await changeAt(site, beaId, 'grant super-admin'),
      await changeAt(site, beaId, 'grant owner'),
    ];
    for (const action of ['disable', 'deactivate', 'reset-password', 'delete']) forged.push(await changeAt(site, beaId, `${action} user`));
    const foreignInvitation = { organizationId: acme, invitationId: globexInvitation.id };
    const before = { memberships: site.world.memberships, invitations: site.world.invitations };
    changesIn(site);

    const outcomes: ChangeResult[] = [];
    for (const request of forged) outcomes.push(await site.service.changeGrant(byDan, request));
    outcomes.push(await site.service.resendInvitation(byDan, foreignInvitation), await site.service.revokeInvitation(byDan, foreignInvitation));

    assert.deepEqual(outcomes, Array.from({ length: forged.length + 2 }, () => 'denied'));
    assert.deepEqual(changesIn(site), []);
    assert.deepEqual({ memberships: site.world.memberships, invitations: site.world.invitations }, before);
    assert.deepEqual(site.records, [
      sendRecord(byDan, invited, 'applied'),
      ...forged.map((request) => grantRecord(byDan, request, 'denied')),
      invitationRecord(byDan, { ...foreignInvitation, action: 'resend-invitation' }, 'denied'),
      invitationRecord(byDan, { ...foreignInvitation, action: 'revoke-invitation' }, 'denied'),
    ]);
  });

  test('Given Dan without a completed MFA step and an actor of another authority with the subject of Dan, when each asks for each administration operation in Acme, then the first gets mfa-required and the second denied, each change has its record, and WorkOS gets no request at all: no member, invitation, or role read, and no read of that subject', async (t) => {
    const site = await openSite(t);
    const acmeInvitation = pendingInvitation('invitation_01ACME', acme);
    site.world.invitations = [acmeInvitation];
    const change = await changeAt(site, site.world.membershipId(bea, acme), 'grant admin');
    const send = { organizationId: acme, email: 'newcomer@example.com', role: 'user' };
    const invitation = { organizationId: acme, invitationId: acmeInvitation.id };
    const refusals = [
      { actor: { ...byDan, mfaCompleted: false }, refusal: 'mfa-required' as const },
      { actor: { user: { authority: 'local:installation-1', subject: dan.id, selectedOrganizationId: acme }, mfaCompleted: true }, refusal: 'denied' as const },
    ];
    site.world.fake.takeRequests();

    const answers = [];
    for (const { actor } of refusals) {
      answers.push([
        await site.service.memberOverview(actor, acme),
        await site.service.invitationOverview(actor, acme),
        await site.service.changeGrant(actor, change),
        await site.service.sendInvitation(actor, send),
        await site.service.resendInvitation(actor, invitation),
        await site.service.revokeInvitation(actor, invitation),
      ]);
    }

    assert.deepEqual(answers, refusals.map(({ refusal }) => Array.from({ length: 6 }, () => refusal)));
    assert.deepEqual(site.world.fake.takeRequests(), []);
    assert.deepEqual(site.records, refusals.flatMap(({ actor, refusal }) => [
      grantRecord(actor, change, refusal),
      sendRecord(actor, send, refusal),
      invitationRecord(actor, { ...invitation, action: 'resend-invitation' }, refusal),
      invitationRecord(actor, { ...invitation, action: 'revoke-invitation' }, refusal),
    ]));
  });
});

describe('Unknown outcomes, retries, and concurrent and stale grant changes', () => {
  for (const { label, target, change, failure, rejection, applied, later } of [
    { label: 'a grant of User to Gus whose WorkOS answer is HTTP 500', target: gus, change: 'grant user', failure: internalError, rejection: GenericServerException, applied: ['member', 'user'], later: ['member'] },
    { label: 'a revoke of Admin from Ada whose WorkOS connection closes before the answer', target: ada, change: 'revoke admin', failure: 'close' as const, rejection: /fetch failed/, applied: ['user'], later: ['user', 'admin'] },
  ]) {
    test(`Given ${label} after WorkOS applied it, when Dan asks for it, then the change fails after one write with an unknown record, a retry of the same request is stale without a write, and after another administrator undoes the change in WorkOS, the old request stays stale, so that it never takes effect again`, async (t) => {
      const site = await openSite(t);
      const membershipId = site.world.membershipId(target, acme);
      const request = await changeAt(site, membershipId, change);
      const method = request.action === 'grant' ? 'POST' : 'DELETE';
      site.world.fake.answer(`${method} /authorization/organization_memberships/${membershipId}/role_assignments`, () => {
        site.world.setRoles(target, acme, applied);
        return failure;
      });

      await assert.rejects(site.service.changeGrant(byDan, request), rejection);
      const rolesAfterFailure = site.world.rolesOf(target, acme);
      const writes = changesIn(site);
      const retry = await site.service.changeGrant(byDan, request);
      site.world.setRoles(target, acme, later);
      const retryAfterUndo = await site.service.changeGrant(byDan, request);

      assert.deepEqual(rolesAfterFailure, applied);
      assert.deepEqual(writes, [roleWrite(method, membershipId, request.role)]);
      assert.deepEqual([retry, retryAfterUndo], ['stale', 'stale']);
      assert.deepEqual(changesIn(site), []);
      assert.deepEqual(site.world.rolesOf(target, acme), later);
      assert.deepEqual(site.records, [grantRecord(byDan, request, 'unknown'), grantRecord(byDan, request, 'stale'), grantRecord(byDan, request, 'stale')]);
      assert.deepEqual(site.billing.updates, []);
    });
  }

  test('Given Cal and Dan who saw the same revision of the membership of Dan, when Cal grants User to Dan and Dan revokes its own Admin at the same time, then each change is applied or stale, each applied change is one single-role write, and the final roles of Dan are exactly its start roles with each applied change, so that no applied change is lost', async (t) => {
    const site = await openSite(t);
    const danId = site.world.membershipId(dan, acme);
    const grantUser = await changeAt(site, danId, 'grant user');
    const changes = [
      { actor: byCal, request: grantUser, write: roleWrite('POST', danId, 'user') },
      { actor: byDan, request: { ...grantUser, role: 'admin', action: 'revoke' }, write: roleWrite('DELETE', danId, 'admin') },
    ];

    const outcomes = await Promise.all(changes.map(({ actor, request }) => site.service.changeGrant(actor, request)));

    const applied = changes.filter((_change, index) => outcomes[index] === 'applied');
    assert.ok(outcomes.every((outcome) => outcome === 'applied' || outcome === 'stale'), `Outcomes: ${outcomes.join(', ')}`);
    assert.ok(applied.length > 0, 'The first change that reaches WorkOS finds the revision that both actors saw.');
    assert.deepEqual(site.world.rolesOf(dan, acme).toSorted(), rolesAfter(['super-admin', 'admin'], applied.map(({ request }) => request)).toSorted());
    assert.deepEqual(inAnyOrder(changesIn(site)), inAnyOrder(applied.map(({ write }) => write)));
    assert.deepEqual(inAnyOrder(site.records), inAnyOrder(changes.map(({ actor, request }, index) => grantRecord(actor, request, outcomes[index]))));
  });

  test('Given Dan saw the revisions of Bea and Gus, when another administrator changes Bea in WorkOS before Dan asks, and Gus between the check of the service and the write of the directory, then both changes are stale with their records, the directory reads Gus again just before its write, and WorkOS gets no write', async (t) => {
    const site = await openSite(t);
    const [beaId, gusId] = [bea, gus].map((user) => site.world.membershipId(user, acme));
    const beaAdmin = await changeAt(site, beaId, 'grant admin');
    const gusUser = await changeAt(site, gusId, 'grant user');
    await changeDuringUserRead(site, gus, () => site.world.setRoles(gus, acme, ['member', 'admin']));
    site.world.fake.takeRequests();

    site.world.setRoles(bea, acme, ['member']);
    const outcomes = [await site.service.changeGrant(byDan, beaAdmin)];
    const beaRequests = site.world.fake.takeRequests();
    outcomes.push(await site.service.changeGrant(byDan, gusUser));
    const gusRequests = site.world.fake.takeRequests();

    const gusReads = gusRequests.map(({ method, path }) => `${method} ${path}`).filter((line) => line.includes(gusId) || line.includes(gus.id));
    assert.deepEqual(outcomes, ['stale', 'stale']);
    assert.deepEqual([...beaRequests, ...gusRequests].filter(({ method }) => method !== 'GET'), []);
    assert.deepEqual(gusReads, [
      `GET /user_management/organization_memberships/${gusId}`,
      `GET /user_management/users/${gus.id}`,
      `GET /user_management/organization_memberships/${gusId}`,
    ]);
    assert.deepEqual([site.world.rolesOf(bea, acme), site.world.rolesOf(gus, acme)], [['member'], ['member', 'admin']]);
    assert.deepEqual(site.records, [grantRecord(byDan, beaAdmin, 'stale'), grantRecord(byDan, gusUser, 'stale')]);
  });
});

describe('Inactive memberships and invitations with the real WorkOS directory', () => {
  test('Given Eve with an inactive membership in Acme that had User and Admin, when Dan asks to revoke its Admin, the directory gets that change at the current revision, Dan invites Eve as Admin, and Eve accepts in AuthKit, then the service denies, the directory answers unsupported, the invitation makes the membership pending with only Admin, and the acceptance makes it active with only Admin, so that no User returns; WorkOS gets only the send, and no membership create, update, deactivation, reactivation, or deletion', async (t) => {
    const site = await openSite(t);
    const eveId = site.world.membershipId(eve, acme);
    const revoke = await changeAt(site, eveId, 'revoke admin');
    const invite = { organizationId: acme, email: eve.email, role: 'admin' };

    const outcomes = [await site.service.changeGrant(byDan, revoke)];
    const direct = await site.organizations.changeGrant({ membershipId: eveId, role: 'admin', action: 'revoke', revision: revoke.revision });
    outcomes.push(await site.service.sendInvitation(byDan, invite));
    const pending = await site.organizations.member(eveId);
    const invitation = site.world.invitations.find(({ email }) => email === eve.email);
    assert.ok(invitation, 'WorkOS has no invitation for Eve.');
    site.world.acceptInvitation(invitation.id);
    const active = await site.organizations.member(eveId);
    const access = await accessWith(site, await site.world.connectToken(eve, { org_id: acme }));
    const invitations = overviewOf(await site.service.invitationOverview(byDan, acme));

    assert.deepEqual([outcomes, direct], [['denied', 'applied'], { outcome: 'unsupported' }]);
    assert.deepEqual([pending?.status, pending?.grants.map(({ role }) => role)], ['pending', ['admin']]);
    assert.deepEqual([active?.status, active?.grants.map(({ role }) => role)], ['active', ['admin']]);
    assert.deepEqual(access, { roles: ['admin'], permissions: ['user-grants:manage'] });
    assert.deepEqual(invitations.invitations, [{ invitationId: invitation.id, email: eve.email, role: 'admin', state: 'accepted', changes: [] }]);
    assert.deepEqual(changesIn(site), [invitationSend(eve.email, 'admin')]);
    assert.deepEqual(site.records, [grantRecord(byDan, revoke, 'denied'), sendRecord(byDan, invite, 'applied')]);
  });

  test('Given Cal with only Admin and Sam with only Super Admin, when each sends invitations, then Cal invites only User and Sam only Admin, the Admin invitation gives no User, a repeated send of the same address and role in another letter case sends nothing, and the WorkOS refusals of an invited address and of an active member give address-in-use', async (t) => {
    const site = await openSite(t);
    const invite = (email: string, role: string): InvitationSendRequest => ({ organizationId: acme, email, role });
    const sends: (readonly [Actor, InvitationSendRequest])[] = [
      [byCal, invite('lee@example.com', 'admin')],
      [bySam, invite('lee@example.com', 'user')],
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
      { invitableRoles: ['user'], identityPolicy: 'provider-rules', invitations: ['lee@example.com: admin pending, no change', 'kim@example.com: user pending, resend revoke'] },
      { invitableRoles: ['admin'], identityPolicy: 'provider-rules', invitations: ['lee@example.com: admin pending, resend revoke', 'kim@example.com: user pending, no change'] },
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
    const outcomes: ChangeResult[] = [];
    for (const invitationId of [accepted, revoked, expired, pending]) {
      outcomes.push(await site.service.resendInvitation(byDan, { organizationId: acme, invitationId }));
      outcomes.push(await site.service.revokeInvitation(byDan, { organizationId: acme, invitationId }));
    }

    const changeRecords = (invitationId: string, outcome: ChangeOutcome) => (['resend-invitation', 'revoke-invitation'] as const)
      .map((action) => invitationRecord(byDan, { organizationId: acme, invitationId, action, role: 'user' }, outcome));
    assert.deepEqual(overview.invitations, [
      { invitationId: accepted, email: 'one@example.com', role: 'user', state: 'accepted', changes: [] },
      { invitationId: revoked, email: 'two@example.com', role: 'user', state: 'revoked', changes: [] },
      { invitationId: expired, email: 'three@example.com', role: 'user', state: 'expired', changes: [] },
      { invitationId: pending, email: 'four@example.com', role: 'user', state: 'pending', changes: ['resend', 'revoke'] },
    ]);
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
  test('Given WorkOS member pages of two that repeat one membership on the next page, when Dan reads the member overview and grants User to Cal, then each membership of Acme shows once with its status and application roles, the seats and the billing update count each active User membership once, and Admin-only, Super-Admin-only, default-role, pending, and inactive memberships count zero', async (t) => {
    const site = await openSite(t);
    site.world.membershipPageSize = 2;
    site.world.membershipPageOverlap = 1;
    const invited = { organizationId: acme, email: 'newcomer@example.com', role: 'user' };
    assert.equal(await site.service.sendInvitation(byDan, invited), 'applied');
    const calId = site.world.membershipId(cal, acme);
    changesIn(site);

    const overview = overviewOf(await site.service.memberOverview(byDan, acme));
    const pageReads = memberPageReads(site);
    const grant = await changeAt(site, calId, 'grant user');
    const outcome = await site.service.changeGrant(byDan, grant);

    assert.deepEqual(overview.members.map(({ email, status, roles }) => `${email}: ${status}, ${roles.join(' ') || 'no role'}`), [
      'sam@example.com: active, super-admin',
      'dan@example.com: active, super-admin admin',
      'cal@example.com: active, admin',
      'ada@example.com: active, user admin',
      'bea@example.com: active, user',
      'hal@example.com: active, user admin',
      'eve@example.com: inactive, user admin',
      'gus@example.com: active, no role',
      'newcomer@example.com: pending, user',
    ]);
    assert.equal(overview.activeUserSeats, 3);
    assert.ok(pageReads.length >= 5, `WorkOS gave the members on ${pageReads.length} pages.`);
    for (const path of pageReads) {
      assert.match(path, new RegExp(`organization_id=${acme}&`));
      assert.match(path, /statuses=active,inactive,pending/);
    }
    assert.equal(outcome, 'applied');
    assert.deepEqual(site.billing.updates, [`${acme}: 4`]);
    assert.deepEqual(changesIn(site), [roleWrite('POST', calId, 'user')]);
    assert.deepEqual(site.records, [sendRecord(byDan, invited, 'applied'), grantRecord(byDan, grant, 'applied')]);
  });

  test('Given a WorkOS outage on the later member pages and then on the invitation reads, when Dan reads the overviews, grants User to Gus, and sends an invitation, then each overview rejects without a partial result, the grant keeps its applied record while its seat update rejects and billing gets no count, and the send fails with a failed record before any WorkOS send', async (t) => {
    const site = await openSite(t);
    site.world.membershipPageSize = 3;
    const gusId = site.world.membershipId(gus, acme);
    const grant = await changeAt(site, gusId, 'grant user');
    const send = { organizationId: acme, email: 'newcomer@example.com', role: 'user' };

    site.world.laterMembershipPageOutage = internalError;
    await assert.rejects(site.service.memberOverview(byDan, acme), GenericServerException);
    await assert.rejects(site.service.changeGrant(byDan, grant), GenericServerException);
    const grantWrites = changesIn(site);
    site.world.laterMembershipPageOutage = undefined;
    site.world.invitationOutage = internalError;
    await assert.rejects(site.service.invitationOverview(byDan, acme), GenericServerException);
    await assert.rejects(site.service.sendInvitation(byDan, send), GenericServerException);

    assert.deepEqual(site.world.rolesOf(gus, acme), ['member', 'user']);
    assert.deepEqual(grantWrites, [roleWrite('POST', gusId, 'user')]);
    assert.deepEqual(changesIn(site), []);
    assert.deepEqual(site.billing.updates, []);
    assert.deepEqual(site.records, [grantRecord(byDan, grant, 'applied'), sendRecord(byDan, send, 'failed')]);
  });
});
