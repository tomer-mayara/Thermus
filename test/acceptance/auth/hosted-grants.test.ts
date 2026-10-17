import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { statusesOf } from '../../support/dsl/hosted-access.ts';
import { labelsOf, recordLines, rolesOf, serveAdministrationSite as serve, shownPage, submitOnPage, toolOutcome } from '../../support/dsl/hosted-administration.ts';
import { formLabelled, formsIn } from '../../support/drivers/browser/hosted-browser.ts';
import { userOf } from '../../support/fixtures/hosted-members.ts';

const membersPage = 'https://thermus.example/team/members';
const deniedChange = /Your account cannot make this change in the selected organization\./;

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
    const oldForm = await cy.submit(formLabelled(shownBefore.forms, 'Revoke User from una@example.com'));
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

  test('Given a browser session and MCP tokens of a User in two organizations, when an Admin removes its last application grant in the selected organization, then the next request there is refused with no default access, the membership and identity stay, and the other organization still works', { timeout: 20_000 }, async (t) => {
    const site = await serve(t);
    const una = site.browserOf(userOf('user-una', 'org-a'));
    const before = { portal: (await una.open('portal')).status, tool: await toolOutcome(site, 'user-una-token') };

    const revoked = await submitOnPage(site.browserOf(userOf('user-eve', 'org-a')), 'members', 'Revoke User from una@example.com');
    const after = { portal: (await una.open('portal')).status, tool: await toolOutcome(site, 'user-una-token'), globexTool: await toolOutcome(site, 'user-una-globex-token') };
    const organizations = formsIn((await una.open('organizations')).body);
    const selected = await una.submit(formLabelled(organizations, 'Globex'));
    const globexPortal = await una.open('portal');

    assert.deepEqual(before, { portal: 200, tool: 'done' });
    assert.equal(revoked.status, 303);
    assert.deepEqual(after, { portal: 403, tool: 'refused', globexTool: 'done' });
    assert.deepEqual(labelsOf(organizations), ['Globex']);
    assert.deepEqual([selected.status, globexPortal.status], [303, 200]);
    assert.deepEqual(site.directory.membershipIn('user-una', 'org-a'), {
      membershipId: 'membership-user-una-org-a',
      organizationId: 'org-a',
      email: 'una@example.com',
      status: 'active',
      grants: [{ role: 'member', permissions: [] }],
      revision: 'r2',
    });
  });
});
