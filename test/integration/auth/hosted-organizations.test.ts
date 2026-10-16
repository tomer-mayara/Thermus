import assert from 'node:assert/strict';
import '../../support/processes/use-hosted-portal-fixture.ts';
import { describe, test, type TestContext } from 'node:test';
import { accountFailureReporter, createApplication } from '../../../src/application.ts';
import { OperatorLogSpy } from '../../support/doubles/application/operator-log-spy.ts';
import { BrowserSessionStore } from '../../support/doubles/auth/browser-session-store.ts';
import { formsIn, HostedBrowser } from '../../support/drivers/browser/hosted-browser.ts';
import { hostedRootConfig } from '../../support/fixtures/hosted-config.ts';
import { hostedFetchSettings, hostedStartupLine, workOSSettingsFor } from '../../support/fixtures/hosted-placeholder.ts';
import {
  contextAt,
  destinationPaths,
  formFor,
  member,
  members,
  openOrganizationSite,
  statusesOf,
  superAdminGrant,
  userGrant,
  userOf,
} from '../../support/in-process/hosted-organization-site.ts';
import type { ProbeReport } from '../../support/doubles/mcp/protected-tool-spy.ts';

function open(t: TestContext) {
  const logger = new OperatorLogSpy();
  const mcpUsers = ['user-mia', 'user-sam', 'user-una'].map((subject) => userOf(subject, 'org-a'));
  return { ...openOrganizationSite(t, { reportFailure: accountFailureReporter(logger), mcpUsers }), logger };
}

async function select(browser: HostedBrowser, label: string, returnTo = '/team/organizations') {
  const forms = formsIn((await browser.open(`organizations?return_to=${returnTo}`)).body);
  return browser.submit(formFor(forms, label));
}

describe('Hosted organization onboarding and selection with the real routes and service, and provider doubles', () => {
  test('Given a session that selected an organization where the membership is inactive, when the organization page and the tenant pages are requested, then the guidance comes from a directory read of the session user only, and each tenant page is refused by current access resolution, with no context, tenant, or role', async (t) => {
    const { directory, pages, browserOf } = open(t);
    const ivy = userOf('user-ivy', 'org-a');
    const browser = browserOf(ivy);

    const onboarding = await browser.open('organizations?organizationId=org-b', { 'X-Organization-Id': 'org-b' });
    const statuses = await statusesOf(browser);

    assert.equal(onboarding.status, 200);
    assert.match(onboarding.body, /accept the invitation/);
    assert.match(onboarding.body, /contact the operator/);
    assert.doesNotMatch(onboarding.body, /<form|hosted:|org-/);
    assert.deepEqual(directory.membershipReads, [ivy]);
    assert.deepEqual(statuses, { portal: 403, 'administration/users': 403, 'administration/admins': 403, billing: 403 });
    assert.deepEqual(directory.calls, destinationPaths.map(() => ivy));
    assert.deepEqual(pages.work, []);
  });

  test('Given memberships that change after the page was shown — one deactivated and one new —, when the user selects each, then the current read decides: the deactivated organization is refused without a switch, and the new one is selected, where the destination checks the current permission', async (t) => {
    const { sessions, directory, pages, browserOf } = open(t);
    const browser = browserOf(userOf('user-mia', 'org-a'));
    const shown = formsIn((await browser.open('organizations')).body);

    directory.replaceMemberships(members.map((record) => (record.organizationId === 'org-b' ? { ...record, active: false } : record))
      .concat(member('user-mia', 'org-e', [userGrant])));
    const refused = await browser.submit(formFor(shown, 'Globex'));
    const selected = await select(browser, 'Hooli', '/team/portal');
    const portal = await contextAt(browser, 'portal');

    assert.deepEqual(shown.map(({ label }) => label), ['Acme (selected)', 'Globex']);
    assert.equal(refused.status, 403);
    assert.equal(selected.location?.href, 'https://thermus.example/team/portal');
    assert.deepEqual([portal.organizationId, portal.tenantId, portal.permissions], ['org-e', 'hosted:org-e', ['product:access']]);
    assert.deepEqual(sessions.switches, [{ subject: 'user-mia', organizationId: 'org-e' }]);
    assert.deepEqual(pages.work.map(({ organizationId }) => organizationId), ['org-e']);
  });

  test('Given a browser session and an MCP token of the same user in one organization, when the browser selects another organization, then only that browser session changes: the MCP token and a second browser session keep their organization', async (t) => {
    const { browserOf, callTool } = open(t);
    const mia = userOf('user-mia', 'org-a');
    const browser = browserOf(mia);
    const otherBrowser = browserOf(mia);

    const selected = await select(browser, 'Globex', '/team/administration/users');
    const switched = await contextAt(browser, 'administration/users');
    const tool = await callTool('user-mia-token');
    const other = await contextAt(otherBrowser, 'portal');

    assert.equal(selected.status, 303);
    assert.equal(switched.organizationId, 'org-b');
    assert.notEqual(tool.isError, true, JSON.stringify(tool.content));
    const [content] = tool.content as Array<{ text: string }>;
    const report = JSON.parse(content?.text ?? '{}') as ProbeReport;
    assert.deepEqual([report.context.organizationId, report.context.tenantId], ['org-a', 'hosted:org-a']);
    assert.equal(other.organizationId, 'org-a');
  });

  test('Given two users in different organizations, when one posts selections of the other user\'s organization with forged organization values in the query, the headers, and a second form field, then only the memberships of the session user are read, no selection passes, no session switches, and the other user keeps its organization', async (t) => {
    const { sessions, directory, browserOf } = open(t);
    const mia = userOf('user-mia', 'org-a');
    const browser = browserOf(mia);
    const otto = browserOf(userOf('user-otto', 'org-d'));
    const acme = formFor(formsIn((await browser.open('organizations')).body), 'Acme (selected)');
    const forged = new URLSearchParams({ ...acme.fields, organization_id: 'org-d' });
    const doubled = new URLSearchParams(acme.fields);
    doubled.append('organization_id', 'org-d');

    const refused = await browser.post('organizations/select?organizationId=org-d', forged.toString(), { headers: { 'X-Organization-Id': 'org-d' } });
    const rejected = await browser.post('organizations/select', doubled.toString());
    const ottoContext = await contextAt(otto, 'administration/users');
    const miaContext = await contextAt(browser, 'portal');

    assert.deepEqual([refused.status, rejected.status], [403, 400]);
    assert.deepEqual(directory.membershipReads, [mia, mia]);
    assert.deepEqual(sessions.switches, []);
    assert.deepEqual([ottoContext.organizationId, miaContext.organizationId], ['org-d', 'org-a']);
  });

  test('Given Super Admin alone and User alone in the same organization, when each selects it and requests each destination and the MCP tool, then each destination and the tool check their own permission: Super Admin reaches only Admin-grant administration and billing, and User reaches only the product and the tool', async (t) => {
    const { browserOf, callTool, tools } = open(t);

    const outcomes: Record<string, unknown> = {};
    for (const subject of ['user-sam', 'user-una']) {
      const browser = browserOf(userOf(subject));
      assert.equal((await select(browser, 'Acme', '/team/portal')).status, 303, subject);
      const tool = await callTool(`${subject}-token`);
      outcomes[subject] = { ...(await statusesOf(browser)), tool: tool.isError === true ? 'refused' : 'done' };
    }

    assert.deepEqual(outcomes, {
      'user-sam': { portal: 403, 'administration/users': 403, 'administration/admins': 200, billing: 200, tool: 'refused' },
      'user-una': { portal: 200, 'administration/users': 403, 'administration/admins': 403, billing: 403, tool: 'done' },
    });
    assert.deepEqual(tools.contexts.map(({ user, grants }) => [user.subject, grants]), [['user-sam', [superAdminGrant]], ['user-una', [userGrant]]]);
  });

  test('Given an outage of the organization reads after the provider refreshed the session, when the organization page and a selection are requested, then each gets the failure page with the refreshed session cookie, the operator log names the path and the cause, no session switches, and the browser keeps its session', async (t) => {
    const { sessions, directory, logger, browserOf } = open(t);
    const browser = browserOf(userOf('user-mia', 'org-a'));
    const acme = formFor(formsIn((await browser.open('organizations')).body), 'Acme (selected)');

    directory.failMembershipReads(new Error('organization directory timed out'));
    const answers = [];
    for (const send of [() => browser.open('organizations'), () => browser.submit(acme)]) {
      sessions.expireAccessToken(browser.cookieHeader);
      answers.push(await send());
    }
    directory.failMembershipReads(undefined);
    const after = await browser.open('portal');

    for (const answer of answers) {
      assert.equal(answer.status, 500);
      assert.match(answer.body, /The request failed\. Try again later\./);
      assert.equal(answer.cookies.length, 1, 'the refreshed session cookie is missing');
    }
    assert.deepEqual(logger.lines, [
      'ERROR An account request failed unexpectedly for /team/organizations: Error: organization directory timed out',
      'ERROR An account request failed unexpectedly for /team/organizations/select: Error: organization directory timed out',
    ]);
    assert.deepEqual(sessions.switches, []);
    assert.equal(after.status, 200);
  });

  test('Given the production hosted application with the WorkOS provider, when the organization page and a selection arrive with the session cookie, form token, and organization values of the doubles, then each asks for a sign-in without a cookie, and nothing is selected or reported', async () => {
    const logger = new OperatorLogSpy();
    const application = await createApplication(hostedRootConfig, logger, { ...workOSSettingsFor(hostedRootConfig.publicBaseUrl), ...hostedFetchSettings });
    const browser = new HostedBrowser(application.handle, hostedRootConfig.publicBaseUrl, new BrowserSessionStore().signIn(userOf('user-mia', 'org-a')));

    const answers = [
      await browser.open('organizations?return_to=/team/portal'),
      await browser.post('organizations/select', { csrf_token: 'forged-token', organization_id: 'org-a', return_to: '/team/portal' }),
      await browser.open('portal'),
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
