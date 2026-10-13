import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import { administrationMembers, labelsOf, recordLines, rolesOf, shownPage, submitOnPage, toolOutcome } from '../../support/hosted-administration.ts';
import { formsIn } from '../../support/hosted-browser.ts';
import { formFor, serveOrganizationSite, statusesOf, userOf } from '../../support/hosted-organization-site.ts';

const membersPage = 'https://magumagu.example/team/members';
const deniedChange = /Your account cannot make this change in the selected organization\./;

function serve(t: TestContext) {
  return serveOrganizationSite(t, {
    reportFailure: () => assert.fail('no account request may fail'),
    memberships: administrationMembers,
    mcpUsers: ['user-sam', 'user-otto', 'user-cy', 'user-fay', 'user-una'].map((subject) => userOf(subject, 'org-a')),
    mcpTokens: new Map([['user-cy-globex-token', userOf('user-cy', 'org-b')], ['user-una-globex-token', userOf('user-una', 'org-b')]]),
  });
}

describe('Hosted grant management through the public routes, with session and directory doubles', () => {
  test('Given a Super Admin with no other grant, when it grants Admin to itself on the members page and then uses that Admin authority to grant User to itself, then each grant works without the approval of another person, and before each grant only its current grants apply', { timeout: 20_000 }, async (t) => {
    const site = await serve(t);
    const sam = site.browserOf(userOf('user-sam', 'org-a'));

    const before = await shownPage(sam, 'members');
    const accessBefore = { ...(await statusesOf(sam, ['portal'])), tool: await toolOutcome(site, 'user-sam-token') };
    const adminGranted = await submitOnPage(sam, 'members', 'Grant Admin to sam@example.com');
    const withAdmin = await shownPage(sam, 'members');
    const accessWithAdmin = { ...(await statusesOf(sam, ['portal'])), tool: await toolOutcome(site, 'user-sam-token') };
    const userGranted = await submitOnPage(sam, 'members', 'Grant User to sam@example.com');
    const accessAfter = { ...(await statusesOf(sam, ['portal'])), tool: await toolOutcome(site, 'user-sam-token') };

    assert.equal(before.answer.status, 200, before.answer.body);
    assert.ok(labelsOf(before.forms).includes('Grant Admin to sam@example.com'), JSON.stringify(labelsOf(before.forms)));
    assert.deepEqual(labelsOf(before.forms).filter((label) => /^(Grant|Revoke) User /.test(label)), [], 'Super Admin alone manages no User grant');
    assert.deepEqual(accessBefore, { portal: 403, tool: 'refused' });
    assert.deepEqual([adminGranted.status, adminGranted.location?.href], [303, membersPage]);
    assert.ok(labelsOf(withAdmin.forms).includes('Grant User to sam@example.com'));
    assert.deepEqual(accessWithAdmin, { portal: 403, tool: 'refused' }, 'Admin gives no product access');
    assert.deepEqual([userGranted.status, userGranted.location?.href], [303, membersPage]);
    assert.deepEqual(accessAfter, { portal: 200, tool: 'done' });
    assert.deepEqual(rolesOf(site, 'user-sam', 'org-a'), ['super-admin', 'admin', 'user']);
    assert.deepEqual(recordLines(site.records), [
      'user-sam in org-a: grant admin for membership-user-sam-org-a: applied',
      'user-sam in org-a: grant user for membership-user-sam-org-a: applied',
    ]);
  });

  test('Given User plus Admin with a browser session and MCP tokens in two organizations, when a Super Admin revokes the Admin grant, then the next Admin request of that session is refused, also with a form shown before, while its product page and the MCP tool still work, and its other organization keeps its grants and access', { timeout: 20_000 }, async (t) => {
    const site = await serve(t);
    const cy = site.browserOf(userOf('user-cy', 'org-a'));
    const shownBefore = await shownPage(cy, 'members');

    const revoked = await submitOnPage(site.browserOf(userOf('user-sam', 'org-a')), 'members', 'Revoke Admin from cy@example.com');
    const oldForm = await cy.submit(formFor(shownBefore.forms, 'Revoke User from una@example.com'));
    const after = {
      members: (await cy.open('members')).status,
      portal: (await cy.open('portal')).status,
      tool: await toolOutcome(site, 'user-cy-token'),
      globexTool: await toolOutcome(site, 'user-cy-globex-token'),
    };

    assert.equal(shownBefore.answer.status, 200);
    assert.equal(revoked.status, 303);
    assert.equal(oldForm.status, 403);
    assert.match(oldForm.body, deniedChange);
    assert.deepEqual(after, { members: 403, portal: 200, tool: 'done', globexTool: 'done' });
    assert.deepEqual([rolesOf(site, 'user-cy', 'org-a'), rolesOf(site, 'user-cy', 'org-b'), rolesOf(site, 'user-una', 'org-a')], [['user'], ['user'], ['user']]);
    assert.deepEqual(recordLines(site.records), [
      'user-sam in org-a: revoke admin for membership-user-cy-org-a: applied',
      'user-cy in org-a: revoke user for membership-user-una-org-a: denied',
    ]);
  });

  test('Given User plus Admin, when the Admin revokes its own User grant, then its Admin page still works, and the product page and the MCP tool are refused on the next request', { timeout: 20_000 }, async (t) => {
    const site = await serve(t);
    const fay = site.browserOf(userOf('user-fay', 'org-a'));
    const before = { ...(await statusesOf(fay, ['members', 'portal'])), tool: await toolOutcome(site, 'user-fay-token') };

    const revoked = await submitOnPage(fay, 'members', 'Revoke User from fay@example.com');
    const after = { ...(await statusesOf(fay, ['members', 'portal'])), tool: await toolOutcome(site, 'user-fay-token') };

    assert.deepEqual(before, { members: 200, portal: 200, tool: 'done' });
    assert.equal(revoked.status, 303);
    assert.deepEqual(after, { members: 200, portal: 403, tool: 'refused' });
    assert.deepEqual(rolesOf(site, 'user-fay', 'org-a'), ['admin']);
  });

  test('Given User, Admin, and Super Admin, when the member revokes its own Admin grant and then grants Admin to itself again through its remaining Super Admin authority, then each step works without another person, and its User grant stays', { timeout: 20_000 }, async (t) => {
    const site = await serve(t);
    const otto = site.browserOf(userOf('user-otto', 'org-a'));

    const revoked = await submitOnPage(otto, 'members', 'Revoke Admin from otto@example.com');
    const withoutAdmin = await shownPage(otto, 'members');
    const rolesWithoutAdmin = rolesOf(site, 'user-otto', 'org-a');
    const regranted = await submitOnPage(otto, 'members', 'Grant Admin to otto@example.com');

    assert.deepEqual([revoked.status, regranted.status], [303, 303]);
    assert.deepEqual(rolesWithoutAdmin, ['user', 'super-admin']);
    assert.deepEqual(labelsOf(withoutAdmin.forms).filter((label) => /^(Grant|Revoke) User /.test(label)), [], 'without Admin, the member manages no User grant');
    assert.deepEqual(rolesOf(site, 'user-otto', 'org-a'), ['user', 'super-admin', 'admin']);
    assert.equal(await toolOutcome(site, 'user-otto-token'), 'done');
    assert.deepEqual(recordLines(site.records), [
      'user-otto in org-a: revoke admin for membership-user-otto-org-a: applied',
      'user-otto in org-a: grant admin for membership-user-otto-org-a: applied',
    ]);
  });

  test('Given an Admin without Super Admin, when it posts forged forms to grant Admin or Super Admin, to revoke the Admin or Super Admin grant of a combined-role member, or to deactivate, disable, or reset that member, then each is refused, no grant changes, and each refusal is recorded', { timeout: 20_000 }, async (t) => {
    const site = await serve(t);
    const eve = site.browserOf(userOf('user-eve', 'org-a'));
    const forms = (await shownPage(eve, 'members')).forms;
    const forDora = formFor(forms, 'Grant User to dora@example.com');
    const forFay = formFor(forms, 'Revoke User from fay@example.com');
    const forOtto = formFor(forms, 'Revoke User from otto@example.com');
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
    const forUna = formFor(forms, 'Revoke User from una@example.com');
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

  test('Given a browser session and MCP tokens of a User in two organizations, when an Admin removes its last application grant in the selected organization, then the next request there is refused with no default access, the membership and identity stay, and the other organization still works', { timeout: 20_000 }, async (t) => {
    const site = await serve(t);
    const una = site.browserOf(userOf('user-una', 'org-a'));
    const before = { portal: (await una.open('portal')).status, tool: await toolOutcome(site, 'user-una-token') };

    const revoked = await submitOnPage(site.browserOf(userOf('user-eve', 'org-a')), 'members', 'Revoke User from una@example.com');
    const after = { portal: (await una.open('portal')).status, tool: await toolOutcome(site, 'user-una-token'), globexTool: await toolOutcome(site, 'user-una-globex-token') };
    const organizations = formsIn((await una.open('organizations')).body);
    const selected = await una.submit(formFor(organizations, 'Organization org-b'));
    const globexPortal = await una.open('portal');

    assert.deepEqual(before, { portal: 200, tool: 'done' });
    assert.equal(revoked.status, 303);
    assert.deepEqual(after, { portal: 403, tool: 'refused', globexTool: 'done' });
    assert.deepEqual(labelsOf(organizations), ['Organization org-b']);
    assert.deepEqual([selected.status, globexPortal.status], [303, 200]);
    assert.deepEqual(site.directory.membershipIn('user-una', 'org-a'), {
      membershipId: 'membership-user-una-org-a',
      organizationId: 'org-a',
      subject: 'user-una',
      email: 'una@example.com',
      status: 'active',
      grants: [{ role: 'member', permissions: [] }],
      revision: 'r2',
    });
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
    const { csrf_token: token = '', ...withoutToken } = formFor((await shownPage(eve, 'members')).forms, 'Grant User to dora@example.com').fields;
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
