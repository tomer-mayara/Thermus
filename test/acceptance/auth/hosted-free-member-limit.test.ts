import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import { BillingFree } from '../../../src/accounts/billing/billing-free.ts';
import { AuditLog, type AuditEvent } from '../../../src/logs/audit/audit-log.ts';
import { TeamBillingStub } from '../../support/doubles/billing/team-billing-stub.ts';
import type { InvitationSeed, MemberSeed } from '../../support/doubles/organizations/directory-double-records.ts';
import type { FakeUser } from '../../support/doubles/workos/workos-fake.ts';
import { formLabelled, type BrowserAnswer, type HostedBrowser } from '../../support/drivers/browser/hosted-browser.ts';
import { pendingInvitationsIn } from '../../support/drivers/browser/pending-invitations-page.ts';
import { recordLines, seatUsageIn, serveAdministrationSite, shownPage } from '../../support/dsl/hosted-administration.ts';
import { signInThroughServer } from '../../support/dsl/workos-sign-in.ts';
import { hostedConfig } from '../../support/fixtures/hosted-config.ts';
import { userOf } from '../../support/fixtures/hosted-members.ts';
import { adminGrant, memberRole, userGrant } from '../../support/fixtures/hosted-roles.ts';
import { serveWorkOSSite } from '../../support/in-process/workos-site.ts';

// The 5-member rule of a free workspace (plan section 4.4): the active members with product access and the pending
// invitations stay at or under 5. Invitation send refuses an invitation beyond the limit, because the invited person
// accepts in the directory, where the application cannot refuse it. The answers of 27 October 2026 give the words.

const membersPage = 'https://thermus.example/team/members';
const limitNotice = 'This free workspace has 5 of 5 seats. Upgrade to Team to add more members.';
const failurePage = /The request failed\. Try again later\./;

type Site = Awaited<ReturnType<typeof serveAdministrationSite>>;

interface Workspace {
  readonly admins: readonly string[];
  readonly users?: readonly string[];
  // Memberships that hold no seat: a default role, an inactive or a pending membership.
  readonly others?: readonly Omit<MemberSeed, 'organizationId'>[];
  readonly invitations?: readonly Omit<InvitationSeed, 'organizationId'>[];
}

// The administration site with BillingFree, the billing of the hosted composition, and one more workspace in the
// directory doubles. Each subject "user-<name>" has the address <name>@example.com.
async function serveFree(t: TestContext): Promise<Site> {
  return serveAdministrationSite(t, { billing: new BillingFree() });
}

function addWorkspace(site: Site, organizationId: string, workspace: Workspace): void {
  const seed = (subject: string, grants: MemberSeed['grants']): MemberSeed => ({ subject, organizationId, organizationName: 'Initech', grants });
  site.directory.addMembers(
    ...workspace.admins.map((subject) => seed(subject, [adminGrant])),
    ...(workspace.users ?? []).map((subject) => seed(subject, [userGrant])),
    ...(workspace.others ?? []).map((other) => ({ organizationName: 'Initech', ...other, organizationId })),
  );
  site.directory.addInvitations(...(workspace.invitations ?? []).map((invitation) => ({ ...invitation, organizationId })));
}

function adminOf(site: Site, subject: string, organizationId: string): HostedBrowser {
  return site.browserOf(userOf(subject, organizationId));
}

// Opens Members, as a person does, and sends the invitation form with this address and the User role.
async function invite(browser: HostedBrowser, email: string): Promise<BrowserAnswer> {
  const { answer, forms } = await shownPage(browser, 'members');
  assert.equal(answer.status, 200, answer.body);
  const form = formLabelled(forms, 'Send invitation');
  return browser.submit({ ...form, fields: { ...form.fields, email } });
}

async function seatsShownTo(browser: HostedBrowser): Promise<string | undefined> {
  return seatUsageIn((await browser.open('members')).body);
}

function assertLimitNotice(answer: BrowserAnswer): void {
  assert.equal(answer.status, 409, answer.body);
  assert.ok(answer.body.includes(`<p>${limitNotice}</p>`), answer.body);
  assert.doesNotMatch(answer.body, /<a\b/, 'The refusal has no link in Slice 2; the Upgrade button comes with SO-13');
}

function assertSentToMembers(answer: BrowserAnswer): void {
  assert.deepEqual([answer.status, answer.location?.href], [303, membersPage], answer.body);
}

// Waits until the condition holds, or gives false after the time.
async function within(milliseconds: number, condition: () => boolean): Promise<boolean> {
  const end = Date.now() + milliseconds;
  while (!condition()) {
    if (Date.now() > end) return false;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  return true;
}

describe('The free member limit at invitation send, through the public routes with session and directory doubles', () => {
  test('Given a free workspace with 3 active members and 1 pending invitation, 4 of 5 seats, when two Admins invite at the same time, then one invitation is sent and the other is refused with limit-reached and the fixed words without a link', { timeout: 20_000 }, async (t) => {
    const site = await serveFree(t);
    addWorkspace(site, 'org-c', { admins: ['user-ada', 'user-bob'], users: ['user-cid'], invitations: [{ email: 'dee@example.com', role: 'user' }] });
    const [ada, bob] = [adminOf(site, 'user-ada', 'org-c'), adminOf(site, 'user-bob', 'org-c')];
    const [adaForm, bobForm] = await Promise.all([ada, bob].map(async (browser) => formLabelled((await shownPage(browser, 'members')).forms, 'Send invitation')));
    const release = site.directory.holdChanges();

    const sends = Promise.all([
      ada.submit({ ...adaForm, fields: { ...adaForm.fields, email: 'eli@example.com' } }),
      bob.submit({ ...bobForm, fields: { ...bobForm.fields, email: 'fay@example.com' } }),
    ]);
    assert.ok(await within(5_000, () => site.directory.invitationChanges.length > 0), 'No invitation send reached the directory.');
    // Without the serialization, the other send would reach the held directory in this time.
    await within(300, () => site.directory.invitationChanges.length > 1);
    release();
    const answers = await sends;
    const shown = await seatsShownTo(ada);

    const sent = answers.filter(({ status }) => status === 303);
    const refused = answers.filter(({ status }) => status !== 303);
    assert.equal(sent.length, 1, answers.map(({ status }) => status).join());
    for (const answer of sent) assertSentToMembers(answer);
    for (const answer of refused) assertLimitNotice(answer);
    assert.equal(site.directory.invitationChanges.length, 1);
    assert.equal(shown, '5 of 5 seats used');
    assert.deepEqual(recordLines(site.records).map((line) => line.replace(/^.*: /, '')).sort(), ['applied', 'limit-reached']);
  });

  test('Given 4 active members and 1 pending invitation, 5 of 5 seats, when an Admin invites, then the invitation is refused with limit-reached, nothing is sent, and the change record keeps limit-reached', { timeout: 20_000 }, async (t) => {
    const site = await serveFree(t);
    addWorkspace(site, 'org-c', { admins: ['user-ada'], users: ['user-bob', 'user-cid', 'user-dee'], invitations: [{ email: 'eli@example.com', role: 'user' }] });
    const ada = adminOf(site, 'user-ada', 'org-c');

    const before = await seatsShownTo(ada);
    const answer = await invite(ada, 'fay@example.com');

    assert.equal(before, '5 of 5 seats used');
    assertLimitNotice(answer);
    assert.deepEqual(site.directory.invitationChanges, []);
    assert.deepEqual(recordLines(site.records), ['user-ada in org-c: invite user for fay@example.com: limit-reached']);
    assert.deepEqual(site.failures, []);
  });

  test('Given 4 active members and 1 expired invitation, 4 of 5 seats, when an Admin invites, then the invitation is sent and the workspace uses 5 of 5 seats', { timeout: 20_000 }, async (t) => {
    const site = await serveFree(t);
    addWorkspace(site, 'org-c', { admins: ['user-ada'], users: ['user-bob', 'user-cid', 'user-dee'], invitations: [{ email: 'eli@example.com', role: 'user', state: 'expired' }] });
    const ada = adminOf(site, 'user-ada', 'org-c');

    const before = await seatsShownTo(ada);
    const answer = await invite(ada, 'fay@example.com');
    const after = await seatsShownTo(ada);

    assertSentToMembers(answer);
    assert.deepEqual([before, after], ['4 of 5 seats used', '5 of 5 seats used']);
    assert.deepEqual(site.directory.invitationChanges, ['send org-c user fay@example.com']);
  });

  test('Given a membership with only the default role, an inactive and a pending membership beside 3 active members with product access, when the seats are counted, then only the 3 count, so two invitations are sent and the third is refused', { timeout: 20_000 }, async (t) => {
    const site = await serveFree(t);
    addWorkspace(site, 'org-c', {
      admins: ['user-ada'],
      users: ['user-bob', 'user-cid'],
      others: [
        { subject: 'user-dora', grants: [memberRole] },
        { subject: 'user-ivy', grants: [userGrant, adminGrant], status: 'inactive' },
        { subject: 'user-pia', grants: [userGrant], status: 'pending' },
      ],
    });
    const ada = adminOf(site, 'user-ada', 'org-c');

    const before = await seatsShownTo(ada);
    const answers = [await invite(ada, 'eli@example.com'), await invite(ada, 'fay@example.com'), await invite(ada, 'gus@example.com')];

    assert.equal(before, '3 of 5 seats used');
    assertSentToMembers(answers[0]!);
    assertSentToMembers(answers[1]!);
    assertLimitNotice(answers[2]!);
    assert.deepEqual(site.directory.invitationChanges, ['send org-c user eli@example.com', 'send org-c user fay@example.com']);
  });

  test('Given a member page or an invitation page that fails to load, when an Admin invites, then no invitation is sent, the Admin gets the failure page, the record keeps failed, and the operator gets the cause', { timeout: 20_000 }, async (t) => {
    const site = await serveFree(t);
    addWorkspace(site, 'org-c', { admins: ['user-ada'], users: ['user-bob', 'user-cid'] });
    const ada = adminOf(site, 'user-ada', 'org-c');
    const { forms } = await shownPage(ada, 'members');
    const form = formLabelled(forms, 'Send invitation');
    const send = () => ada.submit({ ...form, fields: { ...form.fields, email: 'eli@example.com' } });

    const failingMembers = <T>(records: readonly T[]) => [records.slice(0, 2), new Error('member page 2 timed out')];
    site.directory.memberPageLayout = failingMembers;
    site.directory.memberFactsPageLayout = failingMembers;
    const memberFailure = await send();
    site.directory.memberPageLayout = undefined;
    site.directory.memberFactsPageLayout = undefined;
    site.directory.invitationPageLayout = () => [new Error('invitation page 1 timed out')];
    const invitationFailure = await send();

    for (const answer of [memberFailure, invitationFailure]) {
      assert.equal(answer.status, 500, answer.body);
      assert.match(answer.body, failurePage);
    }
    assert.deepEqual(site.directory.invitationChanges, []);
    assert.deepEqual(recordLines(site.records), ['user-ada in org-c: invite user for eli@example.com: failed', 'user-ada in org-c: invite user for eli@example.com: failed']);
    assert.deepEqual(site.failures.map(({ path, cause }) => `${path}: ${String(cause)}`), [
      '/team/invitations/send: Error: member page 2 timed out',
      '/team/invitations/send: Error: invitation page 1 timed out',
    ]);
  });

  test('Given two free workspaces, when one is at 5 of 5 seats, then its Admin is refused and an Admin of the other can still invite', { timeout: 20_000 }, async (t) => {
    const site = await serveFree(t);
    addWorkspace(site, 'org-c', { admins: ['user-ada'], users: ['user-bob', 'user-cid', 'user-dee', 'user-eli'] });
    addWorkspace(site, 'org-d', { admins: ['user-ida'], users: ['user-jon', 'user-kim'] });

    const full = await invite(adminOf(site, 'user-ada', 'org-c'), 'new.c@example.com');
    const open = await invite(adminOf(site, 'user-ida', 'org-d'), 'new.d@example.com');

    assertLimitNotice(full);
    assertSentToMembers(open);
    assert.deepEqual(site.directory.invitationChanges, ['send org-d user new.d@example.com']);
    assert.deepEqual(recordLines(site.records), ['user-ada in org-c: invite user for new.c@example.com: limit-reached', 'user-ida in org-d: invite user for new.d@example.com: applied']);
  });

  test('Given a free workspace with active members, a default-role member, pending, and expired invitations, when an Admin opens Members, then the page shows N of 5 seats used beside the unchanged pending list, and a team workspace shows no seat line', { timeout: 20_000 }, async (t) => {
    const free = await serveFree(t);
    const team = await serveAdministrationSite(t, { billing: new TeamBillingStub() });
    for (const site of [free, team]) {
      addWorkspace(site, 'org-c', {
        admins: ['user-ada'],
        users: ['user-bob'],
        others: [{ subject: 'user-dora', grants: [memberRole] }],
        invitations: [{ email: 'cid@example.com', role: 'user' }, { email: 'dee@example.com', role: 'admin' }, { email: 'old@example.com', role: 'user', state: 'expired' }],
      });
    }

    const [freePage, teamPage] = await Promise.all([free, team].map(async (site) => (await adminOf(site, 'user-ada', 'org-c').open('members')).body));

    assert.equal(seatUsageIn(freePage), '4 of 5 seats used');
    assert.equal(seatUsageIn(teamPage), undefined);
    for (const page of [freePage, teamPage]) {
      assert.deepEqual(pendingInvitationsIn(page), [{ email: 'cid@example.com', role: 'User' }, { email: 'dee@example.com', role: 'Admin' }]);
      assert.match(page, /Active product members: 2/);
    }
  });
});

describe('The free member limit in the WorkOS composition, with a fake of the WorkOS API', () => {
  const workspace = 'org_01FREE';
  const person = (name: string): FakeUser => ({ id: `user_01${name.toUpperCase()}`, email: `${name}@example.com`, firstName: name });
  const [ada, bea, cal, dan] = ['ada', 'bea', 'cal', 'dan'].map(person) as [FakeUser, FakeUser, FakeUser, FakeUser];

  // The production composition with BillingFree: Ada is the Admin of a free workspace with 4 active members and 1
  // pending invitation, 5 of 5 seats.
  async function serveFullWorkspace(t: TestContext, events: AuditEvent[]) {
    const site = await serveWorkOSSite(t, {
      organizations: [workspace],
      audit: new AuditLog({ writeAuditEvent: (event) => { events.push(event); } }),
      setUp: (world) => {
        world.users = [ada, bea, cal, dan];
        world.organizationNames = { [workspace]: 'Initech' };
        world.memberships = [
          { userId: ada.id, organizationId: workspace, roles: ['admin'] },
          ...[bea, cal, dan].map((member) => ({ userId: member.id, organizationId: workspace, roles: ['user'] })),
        ];
        world.invitations = [{ id: 'invitation_01EVE', email: 'eve@example.com', organizationId: workspace, roleSlug: 'user', state: 'pending', expiresAt: '2099-01-01T00:00:00.000Z' }];
      },
    });
    const { browser } = await signInThroughServer(site, ada, workspace);
    return { site, browser };
  }

  test('Given a refused invitation at 5 of 5 seats, when the change is recorded, then the change record and the audit event have the outcome limit-reached and WorkOS gets no invitation write', { timeout: 20_000 }, async (t) => {
    const events: AuditEvent[] = [];
    const { site, browser } = await serveFullWorkspace(t, events);

    const answer = await invite(browser, 'fay@example.com');

    assertLimitNotice(answer);
    const writes = site.world.fake.takeRequests().filter((request) => request.method === 'POST' && request.path === '/user_management/invitations');
    assert.deepEqual(writes, []);
    assert.deepEqual(events.map((event) => event.eventName === 'organization.changed' ? [event.action, event.target, event.role, event.outcome] : event.eventName), [
      ['invite', { email: 'fay@example.com' }, 'user', 'limit-reached'],
    ]);
    const records = site.log.lines.filter((line) => line.startsWith('INFO Account change record: ')).map((line) => JSON.parse(line.slice('INFO Account change record: '.length)) as { action: string; outcome: string });
    assert.deepEqual(records.map(({ action, outcome }) => `${action}: ${outcome}`), ['invite: limit-reached']);
  });

  test('Given a free workspace, when a member reads the portal access, then the JSON has the plan free and the member limit 5', { timeout: 20_000 }, async (t) => {
    const { browser } = await serveFullWorkspace(t, []);

    const access = await browser.open('portal/access', { Accept: 'application/json' });

    assert.equal(access.status, 200, access.body);
    assert.deepEqual(JSON.parse(access.body), { organizationId: workspace, organizationName: 'Initech', roles: ['admin'], plan: 'free', memberLimit: 5, mcpUrl: hostedConfig.mcpResourceUrl });
  });
});
