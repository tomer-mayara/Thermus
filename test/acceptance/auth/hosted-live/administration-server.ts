import { pendingInvitationsIn } from '../../../support/drivers/browser/pending-invitations-page.ts';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { Invitation, OrganizationMembership } from '@workos-inc/node';
import type { Page } from 'playwright';
import { WorkOSOrganizations, workosMembershipReads } from '../../../../src/accounts/providers/workos/workos-organizations.ts';
import { workosAuthority } from '../../../../src/accounts/providers/workos/workos-settings.ts';
import type { ChangeRecord } from '../../../../src/accounts/organizations/change-records.ts';
import { labelsOf, seatsIn } from '../../../support/dsl/hosted-administration.ts';
import { formLabelled, formsIn, type PageForm } from '../../../support/drivers/browser/hosted-browser.ts';
import { once, type LiveRun } from '../../../support/hosted-live/live-run.ts';
import { rolesOf } from '../../../support/hosted-live/operator-runbook.ts';
import {
  acceptInvitationThroughPortal,
  serverGet,
  serverPost,
  sessionJson,
  signInThroughPortal,
  type ServerAnswer,
} from '../../../support/hosted-live/portal-visit.ts';
import { localOrigin, mcpResource } from '../../../support/hosted-live/settings.ts';
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

async function organizationState(run: LiveRun, organizationId: string) {
  const memberships = await (await run.workos.userManagement.listOrganizationMemberships({ organizationId, statuses: ['active', 'inactive', 'pending'], limit: 100 })).autoPagination();
  const invitations = await (await run.workos.userManagement.listInvitations({ organizationId, limit: 100 })).autoPagination();
  return {
    memberships: memberships.map((membership) => ({ id: membership.id, ...stateOf(membership) })).toSorted((a, b) => a.id.localeCompare(b.id)),
    invitations: invitations.map(({ id, state, updatedAt }) => ({ id, state, updatedAt })).toSorted((a, b) => a.id.localeCompare(b.id)),
  };
}

function assertAdministrationRefusal(answer: ServerAnswer): void {
  assert.equal(answer.status, 403, answer.body);
  assert.doesNotMatch(answer.body, /<form/);
}

export function describeAdministrationServerCases(run: LiveRun): void {
  const { settings, workos } = run;
  // The administrator keeps its session from one case to the next.
  const administrator = once(async () => signInThroughPortal(run, (await run.administrationFixtures()).users['c-administrator']));

  // A person opens the page and submits the form with this button.
  async function submitFrom(page: Page, path: string, label: string): Promise<ServerAnswer> {
    return submit(page, formLabelled((await shownPage(run, page, path)).forms, label));
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

  async function activeProductMembersInWorkOS(organizationId: string): Promise<number> {
    const active = await (await workos.userManagement.listOrganizationMemberships({ organizationId, statuses: ['active'], limit: 100 })).autoPagination();
    return active.filter((membership) => rolesOf(membership).some((role) => role === 'user' || role === 'admin')).length;
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

  describe('Hosted live gate (AUTH-08W): retired grant route', () => {
    test('Given a password-signed-in Admin and a valid current grant form, when it opens administration and product access and posts to the retired grant route, then the reads succeed and the post gets 404 with no grant controls, provider change, or grant record', signInOptions, async () => {
      const { users, memberships, organizationC } = await run.administrationFixtures();
      const { page, pages } = await signInThroughPortal(run, users['c-admin-only']);
      const session = await sessionJson(page);
      const directory = new WorkOSOrganizations({ authority: workosAuthority(settings.clientId), memberships: workosMembershipReads(workos), userManagement: workos.userManagement, authorization: workos.authorization });
      const target = await directory.member(memberships.targetInC);
      assert.ok(target);
      const before = await membershipState(target.membershipId);

      const answer = await serverPost(page, 'members/grants', { fields: {
        csrf_token: String(session.csrfToken), organization_id: organizationC.id,
        membership_id: target.membershipId, revision: target.revision, role: 'user', action: 'revoke',
      } });
      const members = await shownPage(run, page, 'members');
      await shownPage(run, page, 'billing');

      assert.ok(pages.some((path) => path.startsWith('/password')), 'The Admin did not complete a password page.');
      assert.equal(pages.some((path) => path.startsWith('/mfa/')), false);
      assert.equal(session.mfaCompleted, false);
      assert.equal((await serverGet(page, 'portal/access')).status, 200);
      assert.ok(labelsOf(members.forms).includes('Send invitation'));
      assert.match(members.body, /type="radio" name="role" value="admin"/);
      assert.equal(answer.status, 404, answer.body);
      const allowedActions = new Set(['/invitations/send', '/invitations/resend', '/invitations/revoke', '/members/remove']);
      assert.ok(members.forms.every(({ action }) => allowedActions.has(action)));
      for (const form of members.forms.filter(({ action }) => action === '/members/remove')) {
        assert.deepEqual(Object.keys(form.fields).sort(), ['csrf_token', 'membership_id', 'organization_id', 'revision']);
        assert.ok(form.fields.csrf_token === String(session.csrfToken), 'The removal form must use the current CSRF token.');
        assert.equal(form.fields.organization_id, organizationC.id);
        assert.ok(form.fields.membership_id && form.fields.revision);
      }
      assert.deepEqual(await membershipState(target.membershipId), before);
      assert.deepEqual(await changeRecordsOf(users['c-admin-only']), []);
      await page.context().close();
    });
  });

  describe(`Hosted live gate (AUTH-08W): invitations of organization C at ${localOrigin}/ with WorkOS and AuthKit`, () => {
    test('Given the administrator of C, when it invites an identity without a membership as User and an identity whose inactive membership had User and Admin as Admin, repeats the User invitation, invites the pending address as Admin and an active member, resends the User invitation, and sends and revokes a third invitation, then the sends, the repeat, the resend, and the revoke get 303, the other two sends get 409 address in use, WorkOS has one invitation to each address and the pending membership of the Admin invitation has only admin, Members shows only pending invitations with current actions, each change has its record, and no page or log line holds an invitation token or link', signInOptions, async (t) => {
      const { organizationC, users, memberships } = await run.administrationFixtures();
      const actor = users['c-administrator'];
      const [inviteeUser, inviteeAdmin, inviteeRevoked] = [users['c-invitee-user'], users['c-invitee-admin'], users['c-invitee-revoked']];
      const { page } = await administrator();
      const first = await shownPage(run, page, 'members');
      const invite = (role: 'User' | 'Admin', email: string) => submit(page, formLabelled(first.forms, 'Send invitation'), { email, role: role.toLowerCase() });

      const sent = [await invite('User', inviteeUser.email), await invite('Admin', inviteeAdmin.email), await invite('User', inviteeUser.email)];
      const refused = [await invite('Admin', inviteeUser.email), await invite('User', actor.email)];
      const pending = await shownPage(run, page, 'members');
      const resent = await submit(page, formLabelled(pending.forms, `Resend the invitation to ${inviteeUser.email}`));
      const third = await invite('User', inviteeRevoked.email);
      assertSeeOther(third, 'members');
      const revoked = await submitFrom(page, 'members', `Revoke the invitation to ${inviteeRevoked.email}`);
      const after = await shownPage(run, page, 'members');
      const invitations = await invitationsInWorkOS(organizationC.id);
      const idOf = (invitee: LiveUser) => invitations.find(({ email }) => email === invitee.email)?.id ?? 'absent';
      const adminInvitee = await membershipState(memberships.inviteeAdminInC);
      const records = (await changeRecordsOf(actor)).filter(({ action }) => invitationActions.has(action)).map(recordLine);
      const credentials = await credentialsOf(invitations);
      const log = (await run.site()).log.lines;
      const pendingChanges = [inviteeUser, inviteeAdmin].flatMap(({ email }) => [`Resend the invitation to ${email}`, `Revoke the invitation to ${email}`]);
      t.diagnostic(`sends ${JSON.stringify(sent.map(({ status }) => status))}; refused sends ${JSON.stringify(refused.map(({ status }) => status))}; resend ${resent.status}; third send ${third.status}; revoke ${revoked.status}`);
      t.diagnostic(`WorkOS invitations: ${JSON.stringify(invitations.map(({ roleSlug, state }) => `${String(roleSlug)} ${state}`))}; membership of the Admin invitee: ${adminInvitee.status} ${JSON.stringify(adminInvitee.roles)}`);

      for (const answer of [...sent, resent, revoked]) assertSeeOther(answer, 'members');
      for (const answer of refused) assertNotice(answer, 409, addressInUse);
      assert.ok(pendingInvitationsIn(pending.body).some(entry => entry.email === inviteeUser.email && entry.role === 'User'), 'The invitations page does not show the pending User invitation.');
      assert.ok(pendingInvitationsIn(pending.body).some(entry => entry.email === inviteeAdmin.email && entry.role === 'Admin'), 'The invitations page does not show the pending Admin invitation.');
      assert.ok(pendingChanges.every((label) => labelsOf(pending.forms).includes(label)), `A pending invitation has no resend or revoke form: ${JSON.stringify(labelsOf(pending.forms))}`);
      assert.deepEqual([inviteeUser, inviteeAdmin, inviteeRevoked].map(({ email }) => invitations.filter((invitation) => invitation.email === email).length), [1, 1, 1]);
      assert.deepEqual([adminInvitee.status, adminInvitee.roles], ['pending', ['admin']]);
      assert.ok(!pendingInvitationsIn(after.body).some(entry => entry.email === inviteeRevoked.email), 'Members still shows the revoked invitation.');
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

    test('Given a User in C and a pending invitation, when the User opens administration and submits valid send, resend, and revoke forms, then each request is refused without a form and WorkOS memberships and invitations stay unchanged', signInOptions, async () => {
      const { users, organizationC } = await run.administrationFixtures();
      const pending = (await invitationsInWorkOS(organizationC.id)).find(({ email, state }) => email === users['c-invitee-user'].email && state === 'pending');
      assert.ok(pending, 'The invitation lifecycle case must leave the User invitation pending.');
      const before = await organizationState(run, organizationC.id);
      const { page } = await signInThroughPortal(run, users['c-target']);
      const session = await sessionJson(page);
      assert.equal(session.mfaCompleted, false);
      assert.equal((await serverGet(page, 'portal/access')).status, 200);
      for (const path of ['members', 'invitations', 'billing']) assertAdministrationRefusal(await serverGet(page, path));
      const fields = { csrf_token: String(session.csrfToken), organization_id: organizationC.id };
      assertAdministrationRefusal(await serverPost(page, 'invitations/send', { fields: { ...fields, email: users['c-invitee-revoked'].email, role: 'admin' } }));
      for (const path of ['invitations/resend', 'invitations/revoke']) {
        assertAdministrationRefusal(await serverPost(page, path, { fields: { ...fields, invitation_id: pending.id } }));
      }
      assert.deepEqual(await organizationState(run, organizationC.id), before, 'A refused User request changed WorkOS data.');
      assert.deepEqual((await changeRecordsOf(users['c-target'])).map(({ outcome }) => outcome), ['denied', 'denied', 'denied']);
      await page.context().close();
    });

    test('Given the pending User invitation and the pending Admin invitation of C, when each invitee opens its invitation link and completes password sign-in without MFA, then WorkOS gives only the invited role and both can open the product; only Admin opens administration, the earlier User grant does not return, both invitations are accepted, the product member count matches WorkOS, and no page or log holds an invitation token or link', signInOptions, async (t) => {
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
      const membersPage = await shownPage(run, page, 'members');
      const seats = await activeProductMembersInWorkOS(organizationC.id);
      const log = (await run.site()).log.lines;
      t.diagnostic(`AuthKit pages of the acceptances: ${userVisit.pages.join(' > ')}; ${adminVisit.pages.join(' > ')}`);
      t.diagnostic(`User invitee: ${userMembership.status} ${JSON.stringify(userMembership.roles)}, portal ${userPortal.status}; Admin invitee: ${adminMembership.status} ${JSON.stringify(adminMembership.roles)}, portal ${adminPortal.status}, members page ${adminMembers.status}; product members ${seatCount(membersPage)}, in WorkOS ${seats}`);

      for (const visit of [userVisit, adminVisit]) {
        assert.ok(visit.pages.some((path) => path.startsWith('/password')), 'The invitation acceptance did not complete a password page.');
        assert.equal(visit.pages.some((path) => path.startsWith('/mfa/')), false);
        assert.equal((await sessionJson(visit.page)).mfaCompleted, false);
      }
      assert.deepEqual([userMembership.status, userMembership.roles], ['active', ['user']]);
      assert.equal(userPortal.status, 200, userPortal.body);
      assert.deepEqual(JSON.parse(userPortal.body), { organizationId: organizationC.id, organizationName: organizationC.name, roles: ['user'], plan: 'free', mcpUrl: mcpResource });
      assert.deepEqual([adminMembership.status, adminMembership.roles], ['active', ['admin']]);
      assert.equal(adminPortal.status, 200, adminPortal.body);
      assert.deepEqual(JSON.parse(adminPortal.body), { organizationId: organizationC.id, organizationName: organizationC.name, roles: ['admin'], plan: 'free', mcpUrl: mcpResource });
      assert.equal(adminMembers.status, 200, 'The Admin invitee cannot open the members page.');
      for (const path of ['members', 'invitations', 'billing']) assertAdministrationRefusal(await serverGet(userVisit.page, path));
      assert.ok(!membersPage.body.includes(`${inviteeUser.email}: User invitation`), 'Members still shows the accepted User invitation.');
      assert.ok(!membersPage.body.includes(`${inviteeAdmin.email}: Admin invitation`), 'Members still shows the accepted Admin invitation.');
      assert.equal(seatCount(membersPage), seats);
      assert.ok(!holdsAny([membersPage.body, adminMembers.body, ...log], credentials), 'An invitation token or link reached a page or the operator log.');
      await userVisit.page.context().close();
      await adminVisit.page.context().close();
    });
  });
}
