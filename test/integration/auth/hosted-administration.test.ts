import assert from 'node:assert/strict';
import '../../support/processes/use-hosted-portal-fixture.ts';
import { describe, test, type TestContext } from 'node:test';
import { accountChangeRecorder, accountFailureReporter, createApplication } from '../../../src/application.ts';
import { loadDeploymentConfig } from '../../../src/config/deployment-config.ts';
import { BillingFree } from '../../../src/billing/billing-free.ts';
import type { ChangeRecord } from '../../../src/organizations/change-records.ts';
import {
  OrganizationAdministration,
  type Actor,
  type GrantChangeRequest,
} from '../../../src/organizations/organization-administration.ts';
import { BrowserSessionStore } from '../../support/doubles/auth/browser-session-store.ts';
import { administrationMembers, recordLines, rolesOf, shownPage, submitOnPage, toolOutcome } from '../../support/dsl/hosted-administration.ts';
import { formsIn, HostedBrowser } from '../../support/drivers/browser/hosted-browser.ts';
import { hostedFetchSettings, hostedStartupLine, workOSSettingsFor } from '../../support/fixtures/hosted-placeholder.ts';
import { formFor, openOrganizationSite, userOf, type OrganizationSite } from '../../support/in-process/hosted-organization-site.ts';

class RecordingLogger {
  readonly lines: string[] = [];
  readonly info = (message: string): void => { this.lines.push(`INFO ${message}`); };
  readonly error = (message: string): void => { this.lines.push(`ERROR ${message}`); };
}

function open(t: TestContext, logger = new RecordingLogger()) {
  const site = openOrganizationSite(t, {
    reportFailure: accountFailureReporter(logger),
    memberships: administrationMembers,
    mcpUsers: ['user-sam', 'user-cy', 'user-una'].map((subject) => userOf(subject, 'org-a')),
  });
  return { ...site, logger };
}

// The session selected Globex, so that only the organization of each call decides.
function actorOf(subject: string): Actor {
  return { user: userOf(subject, 'org-b'), mfaCompleted: true };
}

function changeIn(site: OrganizationSite, target: string, change: { readonly role: string; readonly action: string }): GrantChangeRequest {
  const membership = site.directory.membershipIn(target, 'org-a');
  assert.ok(membership, `no membership of ${target}`);
  return { organizationId: 'org-a', membershipId: membership.membershipId, revision: membership.revision, ...change };
}

describe('Hosted grant management with the real composition, routes, service, and MCPServer, and provider doubles', () => {
  test('Given direct calls of the service on the directory of the site, when a Super Admin grants Admin and then User to itself, an Admin asks to grant Admin, and an Admin revokes the User grant of a User plus Admin member, then the calls follow the rules of the forms, and the next MCP and account requests use the current grants', async (t) => {
    const site = open(t);
    const records: ChangeRecord[] = [];
    const administration = new OrganizationAdministration({ directory: site.directory, records: { record: (entry) => records.push(entry) }, billing: new BillingFree() });
    const before = { sam: await toolOutcome(site, 'user-sam-token'), cy: await toolOutcome(site, 'user-cy-token') };

    const outcomes = [];
    outcomes.push(await administration.changeGrant(actorOf('user-sam'), changeIn(site, 'user-sam', { role: 'admin', action: 'grant' })));
    outcomes.push(await administration.changeGrant(actorOf('user-sam'), changeIn(site, 'user-sam', { role: 'user', action: 'grant' })));
    outcomes.push(await administration.changeGrant(actorOf('user-cy'), changeIn(site, 'user-una', { role: 'admin', action: 'grant' })));
    outcomes.push(await administration.changeGrant(actorOf('user-cy'), changeIn(site, 'user-cy', { role: 'user', action: 'revoke' })));
    const after = { sam: await toolOutcome(site, 'user-sam-token'), cy: await toolOutcome(site, 'user-cy-token') };
    const cyMembers = await site.browserOf(userOf('user-cy', 'org-a')).open('members');

    assert.deepEqual(before, { sam: 'refused', cy: 'done' });
    assert.deepEqual(outcomes, ['applied', 'applied', 'denied', 'applied']);
    assert.deepEqual(after, { sam: 'done', cy: 'refused' });
    assert.equal(cyMembers.status, 200, 'the Admin grant of cy stays');
    assert.deepEqual([rolesOf(site, 'user-una', 'org-a'), rolesOf(site, 'user-cy', 'org-b')], [['user'], ['user']]);
    assert.deepEqual(records.map(({ outcome }) => outcome), outcomes);
  });

  test('Given an Admin and a Super Admin that post changes of the same member from pages that show the same revision, when the directory runs both at the same time, then one is applied, the other gets 409 out of date, and the grant that the second actor wanted to change stays', async (t) => {
    const site = open(t);
    const eve = site.browserOf(userOf('user-eve', 'org-a'));
    const sam = site.browserOf(userOf('user-sam', 'org-a'));
    const eveForm = formFor((await shownPage(eve, 'members')).forms, 'Revoke User from cy@example.com');
    const samForm = formFor((await shownPage(sam, 'members')).forms, 'Revoke Admin from cy@example.com');

    const release = site.directory.holdChanges();
    const answers = Promise.all([eve.submit(eveForm), sam.submit(samForm)]);
    while (site.directory.grantChanges.length < 2) await new Promise((resolve) => setImmediate(resolve));
    release();
    const [eveAnswer, samAnswer] = await answers;

    assert.deepEqual([eveAnswer.status, samAnswer.status], [303, 409]);
    assert.match(samAnswer.body, /changed after the page was shown/);
    assert.deepEqual(rolesOf(site, 'user-cy', 'org-a'), ['admin']);
    assert.deepEqual(recordLines(site.records), [
      'user-eve in org-a: revoke user for membership-user-cy-org-a: applied',
      'user-sam in org-a: revoke admin for membership-user-cy-org-a: stale',
    ]);
  });

  test('Given a directory change that fails after its effect, when an Admin posts a grant after the provider refreshed the session, then the browser gets the failure page with the refreshed cookie, the operator log names the path and the cause, the record says unknown, and a retry of the same form is out of date and changes nothing again', async (t) => {
    const site = open(t);
    const eve = site.browserOf(userOf('user-eve', 'org-a'));
    const form = formFor((await shownPage(eve, 'members')).forms, 'Grant User to dora@example.com');
    site.directory.queue('changeGrant', { error: new Error('directory change timed out'), afterChange: true });

    site.sessions.expireAccessToken(eve.cookieHeader);
    const failed = await eve.submit(form);
    const retry = await eve.submit(form);
    const page = await shownPage(eve, 'members');

    assert.deepEqual([failed.status, failed.cookies.length], [500, 1]);
    assert.match(failed.body, /The request failed\. Try again later\./);
    assert.equal(retry.status, 409);
    assert.ok(page.forms.some(({ label }) => label === 'Revoke User from dora@example.com'), 'the page shows the current grant');
    assert.deepEqual([rolesOf(site, 'user-dora', 'org-a'), site.directory.grantChanges.length], [['user'], 1]);
    assert.deepEqual(site.logger.lines, ['ERROR An account request failed unexpectedly for /team/members/grants: Error: directory change timed out']);
    assert.deepEqual(recordLines(site.records), [
      'user-eve in org-a: grant user for membership-user-dora-org-a: unknown',
      'user-eve in org-a: grant user for membership-user-dora-org-a: stale',
    ]);
  });

  test('Given a directory that cannot make a change safely, when an Admin posts a grant change and an invitation, then each gets 503 with the notice, nothing changes, and each record says unsupported', async (t) => {
    const site = open(t);
    const eve = site.browserOf(userOf('user-eve', 'org-a'));
    site.directory.queue('changeGrant', { result: 'unsupported' });
    site.directory.queue('sendInvitation', { result: 'unsupported' });

    const answers = [
      await submitOnPage(eve, 'members', 'Grant User to dora@example.com'),
      await submitOnPage(eve, 'invitations', { label: 'Invite as User', filled: { email: 'new@example.com' } }),
    ];

    for (const answer of answers) {
      assert.equal(answer.status, 503);
      assert.match(answer.body, /The account directory cannot make this change safely now\. Nothing changed\./);
    }
    assert.deepEqual(rolesOf(site, 'user-dora', 'org-a'), ['member']);
    assert.equal(site.directory.invitationTo('new@example.com'), undefined);
    assert.deepEqual(site.records.map(({ outcome }) => outcome), ['unsupported', 'unsupported']);
  });

  test('Given the change recorder of the hosted edition, when an Admin changes a grant and sends an invitation, then the operator log gets one info line with each record, and no line holds the form token, the session cookie, or an invitation token', async (t) => {
    const logger = new RecordingLogger();
    const site = openOrganizationSite(t, { reportFailure: accountFailureReporter(logger), memberships: administrationMembers, changeRecords: accountChangeRecorder(logger) });
    const eve = site.browserOf(userOf('user-eve', 'org-a'));
    const token = formsIn((await eve.open('members')).body)[0]?.fields.csrf_token ?? '';

    await submitOnPage(eve, 'members', 'Grant User to dora@example.com');
    await submitOnPage(eve, 'invitations', { label: 'Invite as User', filled: { email: 'new@example.com' } });

    assert.deepEqual(logger.lines, site.records.map((record) => `INFO Account change record: ${JSON.stringify(record)}`));
    assert.equal(logger.lines.length, 2);
    const secrets = [token, eve.cookieHeader?.split('=')[1] ?? '', site.directory.invitationTo('new@example.com')?.token ?? ''];
    for (const secret of secrets) {
      assert.notEqual(secret, '');
      assert.ok(logger.lines.every((line) => !line.includes(secret)), `a log line holds ${secret}`);
    }
  });

  test('Given an outage of the member pages after the provider refreshed the session, when the members page opens, then it gets the failure page with the refreshed session cookie and no partial count, and the operator log gets one line', async (t) => {
    const site = open(t);
    const otto = site.browserOf(userOf('user-otto', 'org-a'));
    site.directory.memberPageLayout = (members) => [members.slice(0, 2), new Error('member page 2 timed out')];

    site.sessions.expireAccessToken(otto.cookieHeader);
    const answer = await otto.open('members');

    assert.deepEqual([answer.status, answer.cookies.length], [500, 1]);
    assert.doesNotMatch(answer.body, /Active User seats/);
    assert.deepEqual(site.logger.lines, ['ERROR An account request failed unexpectedly for /team/members: Error: member page 2 timed out']);
  });

  test('Given the production hosted application with the WorkOS provider, when the member and invitation pages and their changes arrive with the session cookie, form token, and values of the doubles, then each asks for a sign-in without a cookie or a form, and nothing is recorded', async () => {
    const logger = new RecordingLogger();
    const config = loadDeploymentConfig({ DEPLOYMENT: 'hosted', PUBLIC_BASE_URL: 'https://thermus.example/' }, 'http');
    const application = await createApplication(config, logger, { ...workOSSettingsFor(config.publicBaseUrl), ...hostedFetchSettings });
    const browser = new HostedBrowser(application.handle, config.publicBaseUrl, new BrowserSessionStore().signIn(userOf('user-eve', 'org-a')));
    const form = { csrf_token: 'forged-token', organization_id: 'org-a' };

    const answers = [
      await browser.open('members'),
      await browser.open('invitations'),
      await browser.post('members/grants', { ...form, membership_id: 'membership-user-dora-org-a', revision: 'r1', role: 'admin', action: 'grant' }),
      await browser.post('invitations/send', { ...form, role: 'admin', email: 'new@example.com' }),
      await browser.post('invitations/resend', { ...form, invitation_id: 'invitation-1' }),
      await browser.post('invitations/revoke', { ...form, invitation_id: 'invitation-1' }),
    ];
    await application.close();

    for (const answer of answers) {
      assert.equal(answer.status, 401);
      assert.match(answer.body, /Sign-in required/);
      assert.deepEqual(answer.cookies, []);
      assert.doesNotMatch(answer.body, /<form/);
    }
    assert.deepEqual(logger.lines, [`INFO ${hostedStartupLine}`]);
  });
});
