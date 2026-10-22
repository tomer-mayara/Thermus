import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { seatsIn, serveAdministrationSite as serve } from '../../support/dsl/hosted-administration.ts';
import { formsIn } from '../../support/drivers/browser/hosted-browser.ts';
import { userOf } from '../../support/fixtures/hosted-members.ts';

const failurePage = /The request failed\. Try again later\./;

describe('The hosted active product member count through the public routes, with session and directory doubles', () => {
  test('Given members on several pages with repeated page boundaries, when Admin-only and combined User/Admin members open the members page, then each active product member counts once, including Admin-only members, while default-role, pending, and inactive memberships and pending invitations do not count', { timeout: 20_000 }, async (t) => {
    const site = await serve(t);
    site.directory.addInvitations({ organizationId: 'org-a', email: 'pending.user@example.com', role: 'user' });
    site.directory.memberPageLayout = (members) => [members.slice(0, 3), members.slice(2, 6), members.slice(5)];

    const acme = { adminOnly: (await site.browserOf(userOf('user-eve', 'org-a')).open('members')).body, combined: (await site.browserOf(userOf('user-otto', 'org-a')).open('members')).body };
    const globex = (await site.browserOf(userOf('user-ben', 'org-b')).open('members')).body;
    const userOnly = await site.browserOf(userOf('user-una', 'org-a')).open('members');

    assert.deepEqual([seatsIn(acme.adminOnly), seatsIn(acme.combined), seatsIn(globex)], [6, 6, 3]);
    assert.equal(userOnly.status, 403);
    assert.equal(seatsIn(userOnly.body), undefined);
    assert.deepEqual([...new Set(site.directory.memberPageReads.map(({ statuses }) => statuses.join()))], ['active,inactive,pending']);
    assert.ok(site.directory.memberPageReads.some(({ cursor }) => cursor !== undefined), 'the page reads followed the cursors');
    assert.deepEqual(site.failures, []);
  });

  test('Given a member page or an invitation page that fails to load, when the members page or the invitations page opens, then each gives the failure page without a partial number or list, and the operator gets the path and the cause', { timeout: 20_000 }, async (t) => {
    const site = await serve(t);
    site.directory.memberPageLayout = (members) => [members.slice(0, 2), new Error('member page 2 timed out'), members.slice(4)];
    site.directory.invitationPageLayout = () => [new Error('invitation page 1 timed out')];
    const otto = site.browserOf(userOf('user-otto', 'org-a'));

    const members = await otto.open('members');
    const invitations = await otto.open('invitations');

    for (const answer of [members, invitations]) {
      assert.equal(answer.status, 500);
      assert.match(answer.body, failurePage);
      assert.deepEqual(formsIn(answer.body), []);
    }
    assert.equal(seatsIn(members.body), undefined);
    assert.deepEqual(site.failures.map(({ path, cause }) => `${path}: ${String(cause)}`), [
      '/team/members: Error: member page 2 timed out',
      '/team/invitations: Error: invitation page 1 timed out',
    ]);
  });
});
