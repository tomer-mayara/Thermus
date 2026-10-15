import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { Invitation, OrganizationMembership } from '@workos-inc/node';
import type { Page } from 'playwright';
import { workosAuthority } from '../../../../src/auth/hosted-auth/workos/workos-settings.ts';
import type { ChangeRecord } from '../../../../src/organizations/change-records.ts';
import { mcpRequest } from '../../../support/drivers/mcp/mcp-http-request.ts';
import { labelsOf, seatsIn } from '../../../support/hosted-administration.ts';
import { formsIn, type PageForm } from '../../../support/drivers/browser/hosted-browser.ts';
import { authorizeWithConnect } from '../../../support/hosted-live/connect-grant.ts';
import { once, type LiveRun } from '../../../support/hosted-live/live-run.ts';
import { rolesOf } from '../../../support/hosted-live/operator-runbook.ts';
import {
  acceptInvitationThroughPortal,
  formNamed,
  serverGet,
  serverPost,
  sessionJson,
  signInThroughPortal,
  type ServerAnswer,
} from '../../../support/hosted-live/portal-visit.ts';
import { localOrigin } from '../../../support/hosted-live/settings.ts';
import type { LiveUser } from '../../../support/hosted-live/staging-fixtures.ts';

interface ShownPage {
  readonly body: string;
  readonly forms: readonly PageForm[];
}

interface MembershipState {
  readonly status: string;
  readonly roles: readonly string[];
  readonly updatedAt: string;
}

const signInOptions = { timeout: 240_000 };
const recordPrefix = 'INFO Account change record: ';
const recordFields = ['action', 'actor', 'organizationId', 'outcome', 'role', 'target', 'time'];
const isoTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
// An API key, a bearer token, a JWT, or a cookie of the server.
const credentialPattern = /sk_(?:test|live)_|Bearer |eyJ[\w-]+\.|__Host-/;
const userChange = / User (?:to|from) /;
const adminChange = / Admin (?:to|from) /;
const changeDenied = /Your account cannot make this change in the selected organization\. Nothing changed\./;
const changeStale = /changed after the page was shown\. Nothing changed\./;
const addressInUse = /This email address already belongs to a member of the organization, or it has a pending invitation\. Nothing changed\./;
const invitationActions: ReadonlySet<string> = new Set(['invite', 'resend-invitation', 'revoke-invitation']);

function stateOf(membership: OrganizationMembership): MembershipState {
  return { status: membership.status, roles: rolesOf(membership), updatedAt: membership.updatedAt };
}

// A page that fails names the last operator reports of the server. A report names the path and the failure, never a
// credential.
async function shownPage(run: LiveRun, page: Page, path: string): Promise<ShownPage> {
  const answer = await serverGet(page, path);
  if (answer.status !== 200) {
    const reports = (await run.site()).log.lines.filter((line) => line.startsWith('ERROR ')).slice(-3);
    assert.fail(`GET /${path} gave ${answer.status}. The last operator reports:\n${reports.join('\n')}`);
  }
  return { body: answer.body, forms: formsIn(answer.body) };
}

function submit(page: Page, form: PageForm, changes: Readonly<Record<string, string>> = {}): Promise<ServerAnswer> {
  return serverPost(page, form.action, { fields: { ...form.fields, ...changes } });
}


function seatCount(members: ShownPage): number {
  const seats = seatsIn(members.body);
  assert.ok(seats !== undefined, 'The members page shows no seat count.');
  return seats;
}

function assertSeeOther(answer: ServerAnswer, path: string): void {
  assert.equal(answer.status, 303, answer.body);
  assert.equal(answer.location, `${localOrigin}/${path}`);
}

function assertNotice(answer: ServerAnswer, status: number, text: RegExp): void {
  assert.equal(answer.status, status, answer.body);
  assert.match(answer.body, text);
}

function recordLine(record: ChangeRecord): string {
  return `${record.action} ${record.role ?? '-'} for ${Object.values(record.target).join()}: ${record.outcome}`;
}

// True when a text holds one of the secrets. The result gives no secret.
function holdsAny(texts: readonly string[], secrets: readonly string[]): boolean {
  const values = secrets.filter((secret) => secret !== '');
  return texts.some((text) => values.some((secret) => text.includes(secret)));
}

export function describeAdministrationServerCases(run: LiveRun): void {
  const { settings, workos } = run;
  // The two administrators keep their sessions from one case to the next.
  const superAdmin = once(async () => signInThroughPortal(run, (await run.administrationFixtures()).users['c-super-admin']));
  const administrator = once(async () => signInThroughPortal(run, (await run.administrationFixtures()).users['c-administrator']));

  // A person opens the page and submits the form with this button.
  async function submitFrom(page: Page, path: string, label: string): Promise<ServerAnswer> {
    return submit(page, formNamed((await shownPage(run, page, path)).forms, label));
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

  async function activeUserSeatsInWorkOS(organizationId: string): Promise<number> {
    const active = await (await workos.userManagement.listOrganizationMemberships({ organizationId, statuses: ['active'], limit: 100 })).autoPagination();
    return active.filter((membership) => rolesOf(membership).includes('user')).length;
  }

  async function invitationsInWorkOS(organizationId: string): Promise<Invitation[]> {
    return (await workos.userManagement.listInvitations({ organizationId, limit: 100 })).autoPagination();
  }

  // The token and the link of each invitation: the credentials of the invited persons. Only the test reads them.
  async function credentialsOf(invitations: readonly Invitation[]): Promise<string[]> {
    const read = await Promise.all(invitations.map(({ id }) => workos.userManagement.getInvitation(id)));
    return read.flatMap(({ token, acceptInvitationUrl }) => [token, acceptInvitationUrl]);
  }

  async function invitationLinkOf(invitations: readonly Invitation[], invitee: LiveUser): Promise<string> {
    const invitation = invitations.find(({ email, state }) => email === invitee.email && state === 'pending');
    assert.ok(invitation, 'WorkOS has no pending invitation to the address of the invitee.');
    return (await workos.userManagement.getInvitation(invitation.id)).acceptInvitationUrl;
  }

  async function changeRecordsOf(actor: LiveUser): Promise<ChangeRecord[]> {
    const { log } = await run.site();
    return log.lines.filter((line) => line.startsWith(recordPrefix))
      .map((line) => JSON.parse(line.slice(recordPrefix.length)) as ChangeRecord)
      .filter((record) => record.actor.subject === actor.id);
  }

  // The MCP client sends its token to the MCP endpoint of the server, as in the AUTH-06 cases.
  async function mcpStatus(token: string): Promise<number> {
    const site = await run.site();
    const response = await fetch(mcpRequest({ url: new URL('mcp', site.thermusUrl).href, method: 'server/discover', token }));
    await response.body?.cancel();
    return response.status;
  }

  describe('Hosted live gate (AUTH-08W): grant changes in organization C at https://localhost:46443/ with WorkOS', () => {
    test('Given an Admin-only member and an identity with only Super Admin in C, when the Admin-only member posts a forged Admin grant for the Super Admin, then it gets 403 with a denied change record, its members page offers no Admin change, and WorkOS keeps only super-admin for the target', signInOptions, async (t) => {
      const { users, memberships } = await run.administrationFixtures();
      const actor = users['c-admin-only'];
      const { page } = await signInThroughPortal(run, actor);
      const shown = await shownPage(run, page, 'members');
      const before = await membershipState(memberships.superAdminInC);

      const forged = await submit(page, formNamed(shown.forms, `Grant User to ${users['c-super-admin'].email}`), { role: 'admin' });
      const after = await membershipState(memberships.superAdminInC);
      const records = (await changeRecordsOf(actor)).map(recordLine);
      t.diagnostic(`forged Admin grant: ${forged.status}; records of the Admin-only member: ${JSON.stringify(records)}`);

      assert.ok(labelsOf(shown.forms).every((label) => !adminChange.test(label)), `Admin alone may not change Admin: ${JSON.stringify(labelsOf(shown.forms))}`);
      assertNotice(forged, 403, changeDenied);
      assert.deepEqual(before.roles, ['super-admin']);
      assert.deepEqual(after, before);
      assert.deepEqual(records, [`grant admin for ${memberships.superAdminInC}: denied`]);
      await page.context().close();
    });

    test('Given an identity with only Super Admin in C, when it signs in with MFA and grants Admin to itself and then User to itself, then its members page first offers no User change, each grant gets 303, WorkOS has super-admin, admin, and user, the User seats grow by one, and the operator log has an applied record of each grant with the actor, the organization, the membership, the action, the role, and the time, and no credential', signInOptions, async (t) => {
      const { organizationC, users, memberships } = await run.administrationFixtures();
      const user = users['c-super-admin'];
      const membershipId = memberships.superAdminInC;
      const { page, pages } = await superAdmin();
      const session = await sessionJson(page);

      const first = await shownPage(run, page, 'members');
      const adminGrant = await submit(page, formNamed(first.forms, `Grant Admin to ${user.email}`));
      const second = await shownPage(run, page, 'members');
      const userGrant = await submit(page, formNamed(second.forms, `Grant User to ${user.email}`));
      const third = await shownPage(run, page, 'members');
      const { roles } = await membershipState(membershipId);
      const records = await changeRecordsOf(user);
      const log = (await run.site()).log.lines.join('\n');
      const secrets = [settings.apiKey, String(session.csrfToken), ...(await page.context().cookies(localOrigin)).map(({ value }) => value)];
      t.diagnostic(`AuthKit pages: ${pages.join(' > ')}; User seats ${seatCount(first)} > ${seatCount(third)}; roles ${JSON.stringify(roles)}; records ${JSON.stringify(records.map(recordLine))}`);

      assert.ok(pages.some((path) => path.startsWith('/mfa/')), 'AuthKit did not ask for the MFA step.');
      assert.deepEqual([session.mfaCompleted, session.organizationId], [true, organizationC.id]);
      assert.ok(labelsOf(first.forms).every((label) => !userChange.test(label)), `Super Admin alone may not change User: ${JSON.stringify(labelsOf(first.forms))}`);
      assertSeeOther(adminGrant, 'members');
      assertSeeOther(userGrant, 'members');
      assert.deepEqual(roles, ['admin', 'super-admin', 'user']);
      assert.equal(seatCount(third), seatCount(first) + 1);
      assert.deepEqual(records.map(recordLine), [`grant admin for ${membershipId}: applied`, `grant user for ${membershipId}: applied`]);
      for (const record of records) {
        assert.deepEqual(Object.keys(record).toSorted(), recordFields);
        assert.deepEqual([record.actor, record.organizationId], [{ authority: workosAuthority(settings.clientId), subject: user.id }, organizationC.id]);
        assert.match(record.time, isoTime);
      }
      assert.ok(!holdsAny([log], secrets), 'The operator log holds the API key, a cookie, or the form token of the session.');
      assert.ok(!credentialPattern.test(log), 'The operator log holds an API key, a bearer token, a JWT, or a cookie.');
    });

    test('Given that Super Admin with Admin and User, when it revokes Admin from itself and grants Admin again with the Super Admin that it kept, then both get 303, its members page offers no User change between them and offers it again after the grant, and WorkOS has super-admin, admin, and user at the end', signInOptions, async (t) => {
      const { users, memberships } = await run.administrationFixtures();
      const user = users['c-super-admin'];
      const { page } = await superAdmin();

      const revoked = await submitFrom(page, 'members', `Revoke Admin from ${user.email}`);
      const between = await shownPage(run, page, 'members');
      const rolesBetween = (await membershipState(memberships.superAdminInC)).roles;
      const regranted = await submit(page, formNamed(between.forms, `Grant Admin to ${user.email}`));
      const after = await shownPage(run, page, 'members');
      const rolesAfter = (await membershipState(memberships.superAdminInC)).roles;
      t.diagnostic(`roles ${JSON.stringify(rolesBetween)} > ${JSON.stringify(rolesAfter)}`);

      assertSeeOther(revoked, 'members');
      assert.deepEqual(rolesBetween, ['super-admin', 'user']);
      assert.ok(labelsOf(between.forms).every((label) => !userChange.test(label)), `Without Admin, the Super Admin may not change User: ${JSON.stringify(labelsOf(between.forms))}`);
      assertSeeOther(regranted, 'members');
      assert.ok(labelsOf(after.forms).includes(`Revoke User from ${user.email}`), 'After the Admin grant, the members page offers no User change.');
      assert.deepEqual(rolesAfter, ['admin', 'super-admin', 'user']);
      await page.context().close();
    });

    test('Given a member with User and Admin in C with a browser session and the MCP token of a Connect grant for C, when the administrator revokes its Admin, then its next members page gets 403 and the MCP token still works; when the administrator grants Admin again and revokes User, then the MCP token gets 403 and the members page opens', signInOptions, async (t) => {
      const { oauthApplication } = await run.fixtures();
      const { organizationC, users, memberships } = await run.administrationFixtures();
      const member = users['c-selective'];
      // The administrator signs in first, so that the 300-second MCP token is new when the changes start.
      const { page } = await administrator();
      const visit = await signInThroughPortal(run, member);
      const { tokens } = await authorizeWithConnect(run, { user: member, organizationName: organizationC.name, clientId: oauthApplication.clientId });
      const access = async () => [(await serverGet(visit.page, 'members')).status, await mcpStatus(tokens.accessToken)];
      const before = await access();

      const adminRevoked = await submitFrom(page, 'members', `Revoke Admin from ${member.email}`);
      const withoutAdmin = await access();
      const adminGranted = await submitFrom(page, 'members', `Grant Admin to ${member.email}`);
      const userRevoked = await submitFrom(page, 'members', `Revoke User from ${member.email}`);
      const withoutUser = await access();
      const { roles } = await membershipState(memberships.selectiveInC);
      t.diagnostic(`members page and MCP: ${JSON.stringify(before)} > ${JSON.stringify(withoutAdmin)} > ${JSON.stringify(withoutUser)}; roles ${JSON.stringify(roles)}`);

      assert.deepEqual(before, [200, 200]);
      assertSeeOther(adminRevoked, 'members');
      assert.deepEqual(withoutAdmin, [403, 200]);
      assertSeeOther(adminGranted, 'members');
      assertSeeOther(userRevoked, 'members');
      assert.deepEqual(withoutUser, [200, 403]);
      assert.deepEqual(roles, ['admin']);
      await visit.page.context().close();
    });

    test('Given a member with only User in C and User in B, signed in to C, when the administrator revokes its User in C, then its next portal request is refused, its organization page offers only B, the members page shows it active without a role, and WorkOS keeps its membership in C active with only member and its membership in B with user', signInOptions, async (t) => {
      const { organizationB } = await run.fixtures();
      const { organizationC, users, memberships } = await run.administrationFixtures();
      const member = users['c-last-user'];
      const visit = await signInThroughPortal(run, member, organizationC.name);
      const portalBefore = await serverGet(visit.page, 'portal/access');
      const { page } = await administrator();

      const revoked = await submitFrom(page, 'members', `Revoke User from ${member.email}`);
      const portalAfter = await serverGet(visit.page, 'portal/access');
      const offered = labelsOf(formsIn((await serverGet(visit.page, 'organizations')).body));
      const members = await shownPage(run, page, 'members');
      const inC = await membershipState(memberships.lastUserInC);
      const inB = await membershipState(memberships.lastUserInB);
      t.diagnostic(`portal ${portalBefore.status} > ${portalAfter.status}; offered ${JSON.stringify(offered)}; C: ${inC.status} ${JSON.stringify(inC.roles)}; B: ${inB.status} ${JSON.stringify(inB.roles)}`);

      assert.equal(portalBefore.status, 200, portalBefore.body);
      assert.deepEqual(JSON.parse(portalBefore.body), { organizationId: organizationC.id, roles: ['user'] });
      assertSeeOther(revoked, 'members');
      assert.equal(portalAfter.status, 403);
      assert.deepEqual(offered, [organizationB.name]);
      assert.ok(members.body.includes(`${member.email}: active. Roles: none.`), 'The members page does not show the member active without a role.');
      assert.deepEqual([inC.status, inC.roles], ['active', ['member']]);
      assert.deepEqual([inB.status, inB.roles], ['active', ['user']]);
      await visit.page.context().close();
    });

    test('Given the administrator of C, when it posts a grant form with a membership of organization A, an inactive membership of C, the role super-admin, or the actions disable, deactivate, and reset-password, then each gets 403 and no membership changes in WorkOS; and a post with the revision of a page after another administrator changed the membership in WorkOS gets 409 without a write', signInOptions, async (t) => {
      const { memberships: staging } = await run.fixtures();
      const { organizationC, users, memberships } = await run.administrationFixtures();
      const { page } = await administrator();
      const shown = await shownPage(run, page, 'members');
      const template = formNamed(shown.forms, `Grant Admin to ${users['c-target'].email}`);
      const watched = [memberships.targetInC, memberships.inactiveInC, staging.userAndAdminInA];
      const before = await Promise.all(watched.map((id) => membershipState(id)));
      const forgedFields: readonly Readonly<Record<string, string>>[] = [
        { membership_id: staging.userAndAdminInA },
        { membership_id: memberships.inactiveInC },
        { role: 'super-admin' },
        { action: 'disable' },
        { action: 'deactivate' },
        { action: 'reset-password' },
      ];

      const forged: ServerAnswer[] = [];
      for (const fields of forgedFields) forged.push(await submit(page, template, fields));
      const after = await Promise.all(watched.map((id) => membershipState(id)));
      const shownBeforeChange = formNamed((await shownPage(run, page, 'members')).forms, `Revoke User from ${users['c-target'].email}`);
      // Another administrator changes the membership in WorkOS after the page was shown. WorkOS names the authorization
      // resource of C by the external ID of C.
      const resourceOfC = organizationC.externalId;
      assert.ok(resourceOfC !== null, 'Organization C has no external ID.');
      await workos.authorization.assignRole({ organizationMembershipId: memberships.targetInC, roleSlug: 'admin', resourceTypeSlug: 'organization', resourceExternalId: resourceOfC });
      const changed = await membershipState(memberships.targetInC);
      const stale = await submit(page, shownBeforeChange);
      const afterStale = await membershipState(memberships.targetInC);
      t.diagnostic(`forged posts: ${JSON.stringify(forged.map(({ status }) => status))}; post on the old revision: ${stale.status}; target roles ${JSON.stringify(changed.roles)} > ${JSON.stringify(afterStale.roles)}`);

      assert.ok(shown.body.includes(`${users['c-inactive'].email}: inactive.`), 'The members page does not show the inactive membership.');
      assert.ok(labelsOf(shown.forms).every((label) => !label.endsWith(users['c-inactive'].email)), 'The inactive membership has a change form.');
      for (const answer of forged) assertNotice(answer, 403, changeDenied);
      assert.deepEqual(after, before);
      assertNotice(stale, 409, changeStale);
      assert.deepEqual(changed.roles, ['admin', 'user']);
      assert.deepEqual(afterStale, changed);
    });
  });

  describe('Hosted live gate (AUTH-08W): invitations of organization C at https://localhost:46443/ with WorkOS and AuthKit', () => {
    test('Given the administrator of C, when it invites an identity without a membership as User and an identity whose inactive membership had User and Admin as Admin, repeats the User invitation, invites the pending address as Admin and an active member, resends the User invitation, and sends and revokes a third invitation, then the sends, the repeat, the resend, and the revoke get 303, the other two sends get 409 address in use, WorkOS has one invitation to each address and the pending membership of the Admin invitation has only admin, the invitations page shows each state with forms only for pending invitations, each change has its record, and no page or log line holds an invitation token or link', signInOptions, async (t) => {
      const { organizationC, users, memberships } = await run.administrationFixtures();
      const actor = users['c-administrator'];
      const [inviteeUser, inviteeAdmin, inviteeRevoked] = [users['c-invitee-user'], users['c-invitee-admin'], users['c-invitee-revoked']];
      const { page } = await administrator();
      const first = await shownPage(run, page, 'invitations');
      const invite = (role: 'User' | 'Admin', email: string) => submit(page, formNamed(first.forms, `Invite as ${role}`), { email });

      const sent = [await invite('User', inviteeUser.email), await invite('Admin', inviteeAdmin.email), await invite('User', inviteeUser.email)];
      const refused = [await invite('Admin', inviteeUser.email), await invite('User', actor.email)];
      const pending = await shownPage(run, page, 'invitations');
      const resent = await submit(page, formNamed(pending.forms, `Resend the invitation to ${inviteeUser.email}`));
      const third = await invite('User', inviteeRevoked.email);
      const revoked = await submitFrom(page, 'invitations', `Revoke the invitation to ${inviteeRevoked.email}`);
      const after = await shownPage(run, page, 'invitations');
      const invitations = await invitationsInWorkOS(organizationC.id);
      const idOf = (invitee: LiveUser) => invitations.find(({ email }) => email === invitee.email)?.id ?? 'absent';
      const adminInvitee = await membershipState(memberships.inviteeAdminInC);
      const records = (await changeRecordsOf(actor)).filter(({ action }) => invitationActions.has(action)).map(recordLine);
      const credentials = await credentialsOf(invitations);
      const log = (await run.site()).log.lines;
      const pendingChanges = [inviteeUser, inviteeAdmin].flatMap(({ email }) => [`Resend the invitation to ${email}`, `Revoke the invitation to ${email}`]);
      t.diagnostic(`sends ${JSON.stringify(sent.map(({ status }) => status))}; refused sends ${JSON.stringify(refused.map(({ status }) => status))}; resend ${resent.status}; third send ${third.status}; revoke ${revoked.status}`);
      t.diagnostic(`WorkOS invitations: ${JSON.stringify(invitations.map(({ roleSlug, state }) => `${String(roleSlug)} ${state}`))}; membership of the Admin invitee: ${adminInvitee.status} ${JSON.stringify(adminInvitee.roles)}`);

      for (const answer of [...sent, resent, third, revoked]) assertSeeOther(answer, 'invitations');
      for (const answer of refused) assertNotice(answer, 409, addressInUse);
      assert.ok(pending.body.includes(`${inviteeUser.email}: User invitation, pending.`), 'The invitations page does not show the pending User invitation.');
      assert.ok(pending.body.includes(`${inviteeAdmin.email}: Admin invitation, pending.`), 'The invitations page does not show the pending Admin invitation.');
      assert.ok(pendingChanges.every((label) => labelsOf(pending.forms).includes(label)), `A pending invitation has no resend or revoke form: ${JSON.stringify(labelsOf(pending.forms))}`);
      assert.deepEqual([inviteeUser, inviteeAdmin, inviteeRevoked].map(({ email }) => invitations.filter((invitation) => invitation.email === email).length), [1, 1, 1]);
      assert.deepEqual([adminInvitee.status, adminInvitee.roles], ['pending', ['admin']]);
      assert.ok(after.body.includes(`${inviteeRevoked.email}: User invitation, revoked.`), 'The invitations page does not show the revoked invitation.');
      assert.ok(labelsOf(after.forms).every((label) => !label.endsWith(inviteeRevoked.email)), 'The revoked invitation has a change form.');
      assert.deepEqual(records, [
        `invite user for ${inviteeUser.email}: applied`,
        `invite admin for ${inviteeAdmin.email}: applied`,
        `invite user for ${inviteeUser.email}: unchanged`,
        `invite admin for ${inviteeUser.email}: address-in-use`,
        `invite user for ${actor.email}: address-in-use`,
        `resend-invitation user for ${idOf(inviteeUser)}: applied`,
        `invite user for ${inviteeRevoked.email}: applied`,
        `revoke-invitation user for ${idOf(inviteeRevoked)}: applied`,
      ]);
      assert.ok(!holdsAny([first.body, pending.body, after.body, ...log], credentials), 'An invitation token or link reached a page or the operator log.');
    });

    test('Given the pending User invitation and the pending Admin invitation of C, when each invitee opens its invitation link and completes the AuthKit sign-in with MFA, then WorkOS makes the first active with only user, which opens the portal, and the second active with only admin — the earlier User grant does not return —, which opens the members page but not the portal; the invitations page shows both accepted, the members page shows the User seats of WorkOS, and no page or log line holds an invitation token or link', signInOptions, async (t) => {
      const { organizationC, users, memberships } = await run.administrationFixtures();
      const [inviteeUser, inviteeAdmin] = [users['c-invitee-user'], users['c-invitee-admin']];
      const invitations = await invitationsInWorkOS(organizationC.id);
      const credentials = await credentialsOf(invitations);

      const userVisit = await acceptInvitationThroughPortal(run, inviteeUser, await invitationLinkOf(invitations, inviteeUser));
      const adminVisit = await acceptInvitationThroughPortal(run, inviteeAdmin, await invitationLinkOf(invitations, inviteeAdmin));
      const userPortal = await serverGet(userVisit.page, 'portal/access');
      const adminPortal = await serverGet(adminVisit.page, 'portal/access');
      const adminMembers = await serverGet(adminVisit.page, 'members');
      const userMembership = await membershipStateOfUser(inviteeUser.id, organizationC.id);
      const adminMembership = await membershipState(memberships.inviteeAdminInC);
      const { page } = await administrator();
      const invitationsPage = await shownPage(run, page, 'invitations');
      const membersPage = await shownPage(run, page, 'members');
      const seats = await activeUserSeatsInWorkOS(organizationC.id);
      const log = (await run.site()).log.lines;
      t.diagnostic(`AuthKit pages of the acceptances: ${userVisit.pages.join(' > ')}; ${adminVisit.pages.join(' > ')}`);
      t.diagnostic(`User invitee: ${userMembership.status} ${JSON.stringify(userMembership.roles)}, portal ${userPortal.status}; Admin invitee: ${adminMembership.status} ${JSON.stringify(adminMembership.roles)}, portal ${adminPortal.status}, members page ${adminMembers.status}; User seats ${seatCount(membersPage)}, in WorkOS ${seats}`);

      assert.ok([userVisit, adminVisit].every(({ pages }) => pages.some((path) => path.startsWith('/mfa/'))), 'AuthKit did not ask for the MFA step in an acceptance.');
      assert.deepEqual([userMembership.status, userMembership.roles], ['active', ['user']]);
      assert.equal(userPortal.status, 200, userPortal.body);
      assert.deepEqual(JSON.parse(userPortal.body), { organizationId: organizationC.id, roles: ['user'] });
      assert.deepEqual([adminMembership.status, adminMembership.roles], ['active', ['admin']]);
      assert.equal(adminPortal.status, 403);
      assert.equal(adminMembers.status, 200, 'The Admin invitee cannot open the members page.');
      assert.ok(invitationsPage.body.includes(`${inviteeUser.email}: User invitation, accepted.`), 'The invitations page does not show the accepted User invitation.');
      assert.ok(invitationsPage.body.includes(`${inviteeAdmin.email}: Admin invitation, accepted.`), 'The invitations page does not show the accepted Admin invitation.');
      assert.equal(seatCount(membersPage), seats);
      assert.ok(!holdsAny([invitationsPage.body, membersPage.body, adminMembers.body, ...log], credentials), 'An invitation token or link reached a page or the operator log.');
      await userVisit.page.context().close();
      await adminVisit.page.context().close();
    });
  });
}
