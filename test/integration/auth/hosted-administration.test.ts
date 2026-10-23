import assert from 'node:assert/strict';
import '../../support/processes/use-hosted-portal-fixture.ts';
import { describe, test, type TestContext } from 'node:test';
import { accountChangeRecorder, accountFailureReporter, createApplication } from '../../../src/app/application.ts';
import { OperatorLogSpy } from '../../support/doubles/application/operator-log-spy.ts';
import { BrowserSessionStore } from '../../support/doubles/auth/browser-session-store.ts';
import { recordLines, rolesOf, shownPage, submitOnPage } from '../../support/dsl/hosted-administration.ts';
import { formLabelled, formsIn, HostedBrowser } from '../../support/drivers/browser/hosted-browser.ts';
import { hostedRootConfig } from '../../support/fixtures/hosted-config.ts';
import { administrationMembers, userOf } from '../../support/fixtures/hosted-members.ts';
import { hostedFetchSettings, hostedStartupLine, hostedStorageUnavailableLine, workOSSettingsFor } from '../../support/fixtures/hosted-placeholder.ts';
import { openOrganizationSite } from '../../support/in-process/hosted-organization-site.ts';

function open(t: TestContext, logger = new OperatorLogSpy()) {
  const site = openOrganizationSite(t, {
    reportFailure: accountFailureReporter(logger),
    memberships: administrationMembers,
    mcpUsers: ['user-sam', 'user-cy', 'user-una'].map((subject) => userOf(subject, 'org-a')),
  });
  return { ...site, logger };
}

describe('Hosted invitation management with the real composition, routes, service, and MCPServer, and provider doubles', () => {
  test('Given a directory change that fails after its effect, when an Admin sends an invitation after the provider refreshed the session, then the browser gets a safe unconfirmed notice with the refreshed cookie, a status read shows the pending invitation, and a fresh duplicate form sends nothing again', async (t) => {
    const site = open(t);
    const eve = site.browserOf(userOf('user-eve', 'org-a'));
    const invitation = formLabelled((await shownPage(eve, 'members')).forms, 'Invite');
    const form = { ...invitation, fields: { ...invitation.fields, email: 'new@example.com' } };
    site.directory.queue('sendInvitation', { error: new Error('directory change timed out'), afterChange: true });

    site.sessions.expireAccessToken(eve.cookieHeader);
    const failed = await eve.submit(form);
    const page = await shownPage(eve, 'members');
    const retry = await submitOnPage(eve, 'members', { label: 'Invite', filled: { email: 'new@example.com' } });

    assert.deepEqual([failed.status, failed.cookies.length], [503, 1]);
    assert.match(failed.body, /The invitation change is not confirmed/);
    assert.deepEqual(formsIn(failed.body), []);
    assert.equal(retry.status, 303);
    assert.match(page.answer.body, /new@example\.com: User invitation, pending/);
    assert.equal(site.directory.invitationChanges.length, 1);
    assert.deepEqual(site.logger.lines, []);
    assert.deepEqual(recordLines(site.records), [
      'user-eve in org-a: invite user for new@example.com: unknown',
      'user-eve in org-a: invite user for new@example.com: unchanged',
    ]);
  });

  test('Given a directory that cannot make a change safely, when an Admin sends an invitation, then it gets 503 with the notice, nothing changes, and each record says unsupported', async (t) => {
    const site = open(t);
    const eve = site.browserOf(userOf('user-eve', 'org-a'));
    site.directory.queue('sendInvitation', { result: 'unsupported' });

    const answers = [
      await submitOnPage(eve, 'members', { label: 'Invite', filled: { email: 'new@example.com' } }),
    ];

    for (const answer of answers) {
      assert.equal(answer.status, 503);
      assert.match(answer.body, /The account directory cannot make this change safely now\. Nothing changed\./);
    }
    assert.deepEqual(rolesOf(site, 'user-dora', 'org-a'), ['member']);
    assert.equal(site.directory.invitationTo('new@example.com'), undefined);
    assert.deepEqual(site.records.map(({ outcome }) => outcome), ['unsupported']);
  });

  test('Given the change recorder of the hosted edition, when an Admin sends and resends an invitation, then the operator log gets one info line with each record, and no line holds the form token, the session cookie, or an invitation token', async (t) => {
    const logger = new OperatorLogSpy();
    const site = openOrganizationSite(t, { reportFailure: accountFailureReporter(logger), memberships: administrationMembers, changeRecords: accountChangeRecorder(logger) });
    const eve = site.browserOf(userOf('user-eve', 'org-a'));
    const token = formsIn((await eve.open('members')).body)[0]?.fields.csrf_token ?? '';

    await submitOnPage(eve, 'members', { label: 'Invite', filled: { email: 'new@example.com' } });

    await submitOnPage(eve, 'members', 'Resend the invitation to new@example.com');

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
    const logger = new OperatorLogSpy();
    const application = await createApplication(hostedRootConfig, logger, { ...workOSSettingsFor(hostedRootConfig.publicBaseUrl), ...hostedFetchSettings });
    const browser = new HostedBrowser(application.handle, hostedRootConfig.publicBaseUrl, new BrowserSessionStore().signIn(userOf('user-eve', 'org-a')));
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
    assert.deepEqual(logger.lines, [`INFO ${hostedStartupLine}`, `ERROR ${hostedStorageUnavailableLine}`]);
  });
});
