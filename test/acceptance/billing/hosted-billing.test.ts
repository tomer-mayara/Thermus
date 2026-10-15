import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import { BillingRecorder } from '../../support/billing-recorder.ts';
import { recordLines, rolesOf, seatsIn, serveAdministrationSite, shownPage, submitOnPage } from '../../support/hosted-administration.ts';
import { formsIn } from '../../support/drivers/browser/hosted-browser.ts';
import { formFor, userOf } from '../../support/hosted-organization-site.ts';

const failurePage = /The request failed\. Try again later\./;
const mfaNotice = /Multi-factor authentication required/;

function billedSeatsIn(body: string): number | undefined {
  const match = /Billed seats: (\d+)/.exec(body);
  return match === null ? undefined : Number(match[1]);
}

// The administration site of the hosted acceptance tests, with BillingFree behind a recorder at the payment boundary.
// Acme (org-a) has 4 active User seats: otto, cy, fay, and una.
async function serve(t: TestContext) {
  const billing = new BillingRecorder();
  return { ...(await serveAdministrationSite(t, { billing })), billing };
}

describe('Hosted billing with BillingFree through the public routes, with session, directory, and billing doubles', () => {
  test('Given Super Admin alone and Super Admin with User and Admin, each with a sign-in that completed MFA, when each opens the billing page of Acme, then each sees the free plan with no billed seat and no payment form, and billing reads only Acme', { timeout: 20_000 }, async (t) => {
    const site = await serve(t);

    const pages = [await site.browserOf(userOf('user-sam', 'org-a')).open('billing'), await site.browserOf(userOf('user-otto', 'org-a')).open('billing')];

    for (const page of pages) {
      assert.equal(page.status, 200, page.body);
      assert.match(page.body, /Plan: Free/);
      assert.match(page.body, /collects no payment/);
      assert.equal(billedSeatsIn(page.body), 0);
      assert.deepEqual(formsIn(page.body), []);
      assert.equal(page.headers.get('Cache-Control'), 'no-store');
    }
    assert.deepEqual(site.billing.reads, ['org-a', 'org-a']);
    assert.deepEqual(site.billing.updates, []);
    assert.deepEqual(site.records, []);
    assert.deepEqual(site.failures, []);
  });

  test('Given User alone, Admin alone, User plus Admin, a default role, and members of Globex, when each opens the billing page, then each gets the access denial without a billing state, and billing reads nothing', { timeout: 20_000 }, async (t) => {
    const site = await serve(t);
    const visitors = [
      userOf('user-una', 'org-a'),
      userOf('user-eve', 'org-a'),
      userOf('user-cy', 'org-a'),
      userOf('user-dora', 'org-a'),
      userOf('user-ben', 'org-b'),
      userOf('user-ben', 'org-a'),
    ];

    for (const visitor of visitors) {
      const page = await site.browserOf(visitor).open('billing');

      assert.equal(page.status, 403, `${visitor.subject} in ${visitor.selectedOrganizationId}`);
      assert.equal(billedSeatsIn(page.body), undefined);
    }
    assert.deepEqual(site.billing.reads, []);
  });

  test('Given a Super Admin whose sign-in did not complete MFA, when it opens the billing page, then it gets the MFA notice, and billing reads nothing', { timeout: 20_000 }, async (t) => {
    const site = await serve(t);

    const page = await site.browserOf(userOf('user-sam', 'org-a'), { mfaCompleted: false }).open('billing');

    assert.equal(page.status, 403);
    assert.match(page.body, mfaNotice);
    assert.equal(billedSeatsIn(page.body), undefined);
    assert.deepEqual(site.billing.reads, []);
  });

  test('Given a Super Admin, when it posts a form to the billing page, then it gets 405 with the allowed methods, because the free plan has no billing change, and billing gets no call and nothing is recorded', { timeout: 20_000 }, async (t) => {
    const site = await serve(t);

    const answer = await site.browserOf(userOf('user-sam', 'org-a')).post('billing', { organization_id: 'org-a', seat_count: '5' });

    assert.equal(answer.status, 405);
    assert.equal(answer.headers.get('Allow'), 'GET, HEAD');
    assert.deepEqual([site.billing.reads, site.billing.updates, site.records], [[], [], []]);
  });

  test('Given Acme with 4 active User seats on overlapping member pages, with Admin-only, Super-Admin-only, default-role, pending, and inactive memberships and a pending User invitation, when an Admin grants User to an Admin-only member and another Admin then revokes User from a member, then billing gets the complete count after each change, 5 and then 4, and the billing page still shows the free plan with no billed seat', { timeout: 20_000 }, async (t) => {
    const site = await serve(t);
    site.directory.addInvitations({ organizationId: 'org-a', email: 'pending.user@example.com', role: 'user' });
    site.directory.memberPageLayout = (members) => [members.slice(0, 3), members.slice(2, 6), members.slice(5)];

    const granted = await submitOnPage(site.browserOf(userOf('user-fay', 'org-a')), 'members', 'Grant User to eve@example.com');
    const revoked = await submitOnPage(site.browserOf(userOf('user-otto', 'org-a')), 'members', 'Revoke User from una@example.com');
    const sam = site.browserOf(userOf('user-sam', 'org-a'));
    const members = await sam.open('members');
    const billingPage = await sam.open('billing');

    assert.deepEqual([granted.status, revoked.status], [303, 303]);
    assert.deepEqual(site.billing.updates, ['org-a: 5', 'org-a: 4']);
    assert.equal(seatsIn(members.body), 4);
    assert.match(billingPage.body, /Plan: Free/);
    assert.equal(billedSeatsIn(billingPage.body), 0);
    assert.deepEqual(recordLines(site.records), [
      'user-fay in org-a: grant user for membership-user-eve-org-a: applied',
      'user-otto in org-a: revoke user for membership-user-una-org-a: applied',
    ]);
    assert.deepEqual(site.failures, []);
  });

  test('Given a member page that fails after a User grant change is made, when the change runs, then billing gets no partial count, the browser gets the failure page, the record says applied, and the operator gets the path and the cause; when a later User grant change runs after the directory recovers, then billing gets the complete count, which includes the first change', { timeout: 20_000 }, async (t) => {
    const site = await serve(t);
    const fay = site.browserOf(userOf('user-fay', 'org-a'));
    const { forms } = await shownPage(fay, 'members');
    site.directory.memberPageLayout = (members) => [members.slice(0, 2), new Error('member page 2 timed out'), members.slice(4)];

    const failed = await fay.submit(formFor(forms, 'Grant User to eve@example.com'));
    const updatesAfterFailure = [...site.billing.updates];
    site.directory.memberPageLayout = undefined;
    const later = await submitOnPage(site.browserOf(userOf('user-otto', 'org-a')), 'members', 'Revoke User from una@example.com');

    assert.equal(failed.status, 500);
    assert.match(failed.body, failurePage);
    assert.deepEqual(updatesAfterFailure, []);
    assert.deepEqual(rolesOf(site, 'user-eve', 'org-a'), ['admin', 'user']);
    assert.equal(later.status, 303);
    assert.deepEqual(site.billing.updates, ['org-a: 4']);
    assert.deepEqual(recordLines(site.records), [
      'user-fay in org-a: grant user for membership-user-eve-org-a: applied',
      'user-otto in org-a: revoke user for membership-user-una-org-a: applied',
    ]);
    assert.deepEqual(site.failures.map(({ path, cause }) => `${path}: ${String(cause)}`), ['/team/members/grants: Error: member page 2 timed out']);
  });
});
