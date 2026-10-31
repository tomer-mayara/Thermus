import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import { BillingRecorder } from '../../support/doubles/billing/billing-recorder.ts';
import { seatsIn, serveAdministrationSite } from '../../support/dsl/hosted-administration.ts';
import { formsIn } from '../../support/drivers/browser/hosted-browser.ts';
import { userOf } from '../../support/fixtures/hosted-members.ts';

const failurePage = /The request failed\. Try again later\./;

function billedSeatsIn(body: string): number | undefined {
  const match = /Billed seats: (\d+)/.exec(body);
  return match === null ? undefined : Number(match[1]);
}

async function serve(t: TestContext) {
  const billing = new BillingRecorder();
  return { ...(await serveAdministrationSite(t, { billing })), billing };
}

describe('Hosted billing with BillingFree through the public routes, with session, directory, and billing doubles', () => {
  test('Given Admin alone and Admin with User, each after password sign-in, when each opens the billing page of Acme, then each sees the free plan with no billed seat and no payment form, and billing reads only Acme', { timeout: 20_000 }, async (t) => {
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

  test('Given User alone, a default role, and a foreign organization request, when each opens the billing page, then each gets the access denial without a billing state, and billing reads nothing', { timeout: 20_000 }, async (t) => {
    const site = await serve(t);
    const visitors = [
      userOf('user-una', 'org-a'),
      userOf('user-dora', 'org-a'),
      userOf('user-ben', 'org-a'),
    ];

    for (const visitor of visitors) {
      const page = await site.browserOf(visitor).open('billing');

      assert.equal(page.status, 403, `${visitor.subject} in ${visitor.selectedOrganizationId}`);
      assert.equal(billedSeatsIn(page.body), undefined);
    }
    assert.deepEqual(site.billing.reads, []);
  });

  test('Given Admin without completed MFA, when it opens billing, then it reads the current free state without a billing mutation', async (t) => {
    const site = await serve(t);
    const page = await site.browserOf(userOf('user-sam', 'org-a'), { mfaCompleted: false }).open('billing');
    assert.equal(page.status, 200, page.body);
    assert.equal(billedSeatsIn(page.body), 0);
    assert.deepEqual(site.billing.reads, ['org-a']);
    assert.deepEqual([site.billing.updates, site.records], [[], []]);
  });

  test('Given an Admin, when it posts a form to the billing page, then it gets 405 with the allowed methods, because the free plan has no billing change, and billing gets no call and nothing is recorded', { timeout: 20_000 }, async (t) => {
    const site = await serve(t);

    const answer = await site.browserOf(userOf('user-sam', 'org-a')).post('billing', { organization_id: 'org-a', seat_count: '5' });

    assert.equal(answer.status, 405);
    assert.equal(answer.headers.get('Allow'), 'GET, HEAD');
    assert.deepEqual([site.billing.reads, site.billing.updates, site.records], [[], [], []]);
  });

  test('Given overlapping member pages and pending invitations, when an Admin reads Members and billing, then each active product member counts once and the free billing state stays unchanged', async (t) => {
    const site = await serve(t);
    site.directory.addInvitations({ organizationId: 'org-a', email: 'pending.user@example.com', role: 'user' });
    site.directory.memberPageLayout = (members) => [members.slice(0, 3), members.slice(2, 6), members.slice(5)];
    const browser = site.browserOf(userOf('user-sam', 'org-a'));

    const members = await browser.open('members');
    const billingPage = await browser.open('billing');

    assert.equal(seatsIn(members.body), 6);
    assert.match(billingPage.body, /Plan: Free/);
    assert.equal(billedSeatsIn(billingPage.body), 0);
    assert.deepEqual(site.billing.updates, []);
    assert.deepEqual(site.records, []);
    assert.deepEqual(site.failures, []);
  });

  test('Given a later member-page outage, when Members is read and then read after recovery, then no partial count is shown and the recovered page has the complete count', async (t) => {
    const site = await serve(t);
    const browser = site.browserOf(userOf('user-fay', 'org-a'));
    site.directory.memberPageLayout = (members) => [members.slice(0, 2), new Error('member page 2 timed out'), members.slice(4)];

    const failed = await browser.open('members');
    site.directory.memberPageLayout = undefined;
    const recovered = await browser.open('members');

    assert.equal(failed.status, 500);
    assert.match(failed.body, failurePage);
    assert.equal(seatsIn(failed.body), undefined);
    assert.equal(recovered.status, 200);
    assert.equal(seatsIn(recovered.body), 6);
    assert.deepEqual(site.billing.updates, []);
    assert.deepEqual(site.records, []);
    assert.deepEqual(site.failures.map(({ path, cause }) => `${path}: ${String(cause)}`), ['/team/members: Error: member page 2 timed out']);
  });
});
