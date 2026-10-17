import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { statusesOf } from '../../support/dsl/hosted-access.ts';
import { labelsOf, recordLines, rolesOf, serveAdministrationSite as serve, shownPage, toolOutcome } from '../../support/dsl/hosted-administration.ts';
import { formLabelled, formsIn } from '../../support/drivers/browser/hosted-browser.ts';
import { userOf } from '../../support/fixtures/hosted-members.ts';

const membersPage = 'https://thermus.example/team/members';
const deniedChange = /Your account cannot make this change in the selected organization\./;

describe('Hosted grant change refusals through the public routes: forged forms, other organizations, MFA, and browser checks', () => {
  test('Given an Admin without Super Admin, when it posts forged forms to grant Admin or Super Admin, to revoke the Admin or Super Admin grant of a combined-role member, or to deactivate, disable, or reset that member, then each is refused, no grant changes, and each refusal is recorded', { timeout: 20_000 }, async (t) => {
    const site = await serve(t);
    const eve = site.browserOf(userOf('user-eve', 'org-a'));
    const forms = (await shownPage(eve, 'members')).forms;
    const forDora = formLabelled(forms, 'Grant User to dora@example.com');
    const forFay = formLabelled(forms, 'Revoke User from fay@example.com');
    const forOtto = formLabelled(forms, 'Revoke User from otto@example.com');
    const forged = [
      { ...forDora.fields, role: 'admin' },
      { ...forDora.fields, role: 'super-admin' },
      { ...forFay.fields, role: 'admin' },
      { ...forOtto.fields, role: 'super-admin' },
      { ...forFay.fields, action: 'deactivate' },
      { ...forFay.fields, action: 'disable' },
      { ...forFay.fields, action: 'reset-credentials' },
    ];
    const rolesBefore = ['user-dora', 'user-fay', 'user-otto'].map((subject) => rolesOf(site, subject, 'org-a'));

    const answers = [];
    for (const fields of forged) answers.push(await eve.post('members/grants', fields));
    const otherPaths = await statusesOf(eve, ['members/deactivate', 'members/disable', 'members/reset']);

    for (const answer of answers) {
      assert.equal(answer.status, 403, answer.body);
      assert.match(answer.body, deniedChange);
    }
    assert.deepEqual(otherPaths, { 'members/deactivate': 404, 'members/disable': 404, 'members/reset': 404 });
    assert.deepEqual(['user-dora', 'user-fay', 'user-otto'].map((subject) => rolesOf(site, subject, 'org-a')), rolesBefore);
    assert.deepEqual(site.directory.grantChanges, []);
    assert.deepEqual(recordLines(site.records), [
      'user-eve in org-a: grant admin for membership-user-dora-org-a: denied',
      'user-eve in org-a: grant super-admin for membership-user-dora-org-a: denied',
      'user-eve in org-a: revoke admin for membership-user-fay-org-a: denied',
      'user-eve in org-a: revoke super-admin for membership-user-otto-org-a: denied',
      'user-eve in org-a: deactivate user for membership-user-fay-org-a: denied',
      'user-eve in org-a: disable user for membership-user-fay-org-a: denied',
      'user-eve in org-a: reset-credentials user for membership-user-fay-org-a: denied',
    ]);
  });

  test('Given members of two organizations, when an Admin of one organization revokes a grant there and posts a form that names a member of the other organization, then only its own organization changes, the other member is refused, and the other organization keeps its grants and access', { timeout: 20_000 }, async (t) => {
    const site = await serve(t);
    const ben = site.browserOf(userOf('user-ben', 'org-b'));
    const forms = (await shownPage(ben, 'members')).forms;
    const forUna = formLabelled(forms, 'Revoke User from una@example.com');
    const cyInAcme = site.directory.membershipIn('user-cy', 'org-a');

    const revoked = await ben.submit(forUna);
    const otherOrganization = await ben.post('members/grants', { ...forUna.fields, membership_id: cyInAcme?.membershipId ?? '', revision: cyInAcme?.revision ?? '' });
    const tools = { acme: await toolOutcome(site, 'user-una-token'), globex: await toolOutcome(site, 'user-una-globex-token') };

    assert.equal(revoked.status, 303);
    assert.equal(otherOrganization.status, 403);
    assert.match(otherOrganization.body, deniedChange);
    assert.deepEqual(labelsOf(forms).filter((label) => label.includes('sam@example.com') || label.includes('eve@example.com')), [], 'the page shows only the members of the organization of the session');
    assert.deepEqual(tools, { acme: 'done', globex: 'refused' });
    assert.deepEqual([rolesOf(site, 'user-una', 'org-a'), rolesOf(site, 'user-cy', 'org-a')], [['user'], ['user', 'admin']]);
    assert.deepEqual(recordLines(site.records), [
      'user-ben in org-b: revoke user for membership-user-una-org-b: applied',
      'user-ben in org-b: revoke user for membership-user-cy-org-a: denied',
    ]);
  });

  test('Given an Admin whose sign-in did not complete MFA, when it opens the members page or posts a grant change with the form token of its session, then each is refused with the MFA notice, no grant changes, and the refused change is recorded', { timeout: 20_000 }, async (t) => {
    const site = await serve(t);
    const eve = site.browserOf(userOf('user-eve', 'org-a'), { mfaCompleted: false });
    const token = formsIn((await eve.open('organizations')).body)[0]?.fields.csrf_token ?? '';
    const una = site.directory.membershipIn('user-una', 'org-a');

    const page = await eve.open('members');
    const post = await eve.post('members/grants', { csrf_token: token, organization_id: 'org-a', membership_id: una?.membershipId ?? '', revision: una?.revision ?? '', role: 'user', action: 'revoke' });

    for (const answer of [page, post]) {
      assert.equal(answer.status, 403);
      assert.match(answer.body, /Administration needs a sign-in that completed multi-factor authentication\./);
    }
    assert.deepEqual(rolesOf(site, 'user-una', 'org-a'), ['user']);
    assert.deepEqual(site.directory.grantChanges, []);
    assert.deepEqual(recordLines(site.records), ['user-eve in org-a: revoke user for membership-user-una-org-a: mfa-required']);
  });

  test('Given a session that the provider refreshes at each request, when grant posts come from another site or without an origin, lack the form token or have a wrong one, or name another organization than the session, then each is refused before any change, and the refreshed session cookie reaches each answer, also the redirect of a valid post', { timeout: 20_000 }, async (t) => {
    const site = await serve(t);
    const eve = site.browserOf(userOf('user-eve', 'org-a'));
    const { csrf_token: token = '', ...withoutToken } = formLabelled((await shownPage(eve, 'members')).forms, 'Grant User to dora@example.com').fields;
    const fields = { ...withoutToken, csrf_token: token };
    const posts: ReadonlyArray<[string, Readonly<Record<string, string>>, { origin?: string | null }, number]> = [
      ['a foreign origin', fields, { origin: 'https://evil.example' }, 403],
      ['no origin', fields, { origin: null }, 403],
      ['no form token', withoutToken, {}, 403],
      ['a wrong form token', { ...fields, csrf_token: 'forged-token' }, {}, 403],
      ['another organization', { ...fields, organization_id: 'org-b' }, {}, 409],
      ['an extra field', { ...fields, organization_name: 'Renamed' }, {}, 400],
    ];

    for (const [label, form, options, status] of posts) {
      site.sessions.expireAccessToken(eve.cookieHeader);
      const answer = await eve.post('members/grants', form, options);
      assert.equal(answer.status, status, `${label}: ${answer.body}`);
      assert.equal(answer.cookies.length, 1, `${label}: the refreshed session cookie is missing`);
    }
    site.sessions.expireAccessToken(eve.cookieHeader);
    const granted = await eve.post('members/grants', fields);

    assert.deepEqual([granted.status, granted.location?.href, granted.cookies.length], [303, membersPage, 1]);
    assert.equal((await eve.open('members')).status, 200, 'the browser kept the refreshed session');
    assert.deepEqual(rolesOf(site, 'user-dora', 'org-a'), ['user']);
    assert.deepEqual(recordLines(site.records), ['user-eve in org-a: grant user for membership-user-dora-org-a: applied']);
  });
});
