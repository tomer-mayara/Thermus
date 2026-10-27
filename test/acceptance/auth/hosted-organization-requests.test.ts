import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import type { AccountFailureReport } from '../../../src/interfaces/web/account/account-routes.ts';
import { CLEARED_SESSION_COOKIE } from '../../support/doubles/auth/browser-session-store.ts';
import { formLabelled, formsIn, HostedBrowser } from '../../support/drivers/browser/hosted-browser.ts';
import { statusesOf } from '../../support/dsl/hosted-access.ts';
import { hostedConfig } from '../../support/fixtures/hosted-config.ts';
import { userOf } from '../../support/fixtures/hosted-members.ts';
import { serveOrganizationSite } from '../../support/in-process/hosted-organization-site.ts';

const mia = userOf('user-mia', 'org-a');

async function serve(t: TestContext) {
  const failures: AccountFailureReport[] = [];
  const site = await serveOrganizationSite(t, { reportFailure: (report) => failures.push(report) });
  return { ...site, failures };
}

describe('Hosted organization requests through the public routes: browser checks, cookie effects, session failures, and deferred operations', () => {
  test('Given a signed-in user whose session the provider refreshes at each request, when selection posts come from another site or without an origin, lack the form token or have a wrong one, or name an invalid return destination or an extra field, then each is refused without a switch, and the refreshed session cookie still reaches the browser', { timeout: 20_000 }, async (t) => {
    const site = await serve(t);
    const browser = site.browserOf(mia);
    const { csrf_token: token = '', ...withoutToken } = formLabelled(formsIn((await browser.open('organizations?return_to=/team/portal')).body), 'Globex').fields;
    const fields = { ...withoutToken, csrf_token: token };
    const posts: ReadonlyArray<[string, Readonly<Record<string, string>>, { origin?: string | null }, number]> = [
      ['a foreign origin', fields, { origin: 'https://evil.example' }, 403],
      ['no origin', fields, { origin: null }, 403],
      ['no form token', withoutToken, {}, 403],
      ['a wrong form token', { ...fields, csrf_token: 'forged-token' }, {}, 403],
      ['an absolute return destination', { ...fields, return_to: 'https://evil.example/team/' }, {}, 400],
      ['a return destination for another host', { ...fields, return_to: '//evil.example/team/' }, {}, 400],
      ['a return destination outside the public path', { ...fields, return_to: '/team/../admin' }, {}, 400],
      ['an organization name to change', { ...fields, organization_name: 'Renamed' }, {}, 400],
    ];

    for (const [label, form, options, status] of posts) {
      site.sessions.expireAccessToken(browser.cookieHeader);
      const before = browser.cookieHeader;
      const answer = await browser.post('organizations/select', form, options);
      assert.equal(answer.status, status, label);
      assert.equal(answer.location, undefined, label);
      assert.equal(answer.cookies.length, 1, `${label}: the refreshed session cookie is missing`);
      assert.notEqual(browser.cookieHeader, before, label);
    }
    site.sessions.expireAccessToken(browser.cookieHeader);
    const selected = await browser.post('organizations/select', fields);
    const destination = await browser.follow(selected);

    assert.equal(selected.status, 303);
    assert.equal(selected.cookies.length, 2, 'the answer has the refreshed cookie and then the cookie of the switch');
    assert.equal(destination.status, 200, 'the browser kept the session of the switch');
    assert.deepEqual(site.sessions.switches, [{ subject: 'user-mia', organizationId: 'org-b' }]);
    assert.deepEqual(site.failures, []);
  });

  test('Given an ended session and then an outage of the session lookup, when the organization page and a selection are requested, then the ended session gets a sign-in request that clears its cookie, the outage gets a server failure that keeps the cookie and asks for no sign-in, and no organization is read or switched', { timeout: 20_000 }, async (t) => {
    const site = await serve(t);
    const ended = new HostedBrowser(site.transport, hostedConfig.publicBaseUrl, 'session=ended-session');
    const browser = site.browserOf(mia);
    const acme = formLabelled(formsIn((await browser.open('organizations')).body), 'Acme (selected)');
    const readsBefore = site.directory.membershipReads.length;

    const signedOut = await ended.open('organizations');
    site.sessions.failLookups(new Error('session provider timed out'));
    const outages = [await browser.open('organizations'), await browser.submit(acme)];
    site.sessions.failLookups(undefined);
    const after = await browser.open('portal');

    assert.equal(signedOut.status, 401);
    assert.match(signedOut.body, /Sign in to use this page\./);
    assert.deepEqual(signedOut.cookies, [CLEARED_SESSION_COOKIE]);
    for (const outage of outages) {
      assert.equal(outage.status, 500);
      assert.deepEqual(outage.cookies, []);
      assert.doesNotMatch(outage.body, /Sign in/);
    }
    assert.equal(after.status, 200, 'the outage kept the session');
    assert.equal(site.directory.membershipReads.length, readsBefore);
    assert.deepEqual(site.sessions.switches, []);
  });

  test('Given an Admin with a selected organization, when it requests to create, resume, rename, or change the settings of an organization, then no route does it: the organization page accepts only reads, the selection accepts no other field, other organization paths do not exist, and the session gets no further switch', { timeout: 20_000 }, async (t) => {
    const site = await serve(t);
    const browser = site.browserOf(userOf('user-sam'));
    const acme = formLabelled(formsIn((await browser.open('organizations')).body), 'Acme');
    assert.equal((await browser.submit(acme)).status, 303);

    const create = await browser.post('organizations', { name: 'New organization' });
    const changes = [];
    const extras: ReadonlyArray<Readonly<Record<string, string>>> = [{ organization_name: 'Renamed' }, { settings: 'changed' }, { resume: 'operation-1' }];
    for (const extra of extras) changes.push((await browser.post('organizations/select', { ...acme.fields, ...extra })).status);
    const others = await statusesOf(browser, ['organizations/new', 'organizations/settings', 'organizations/resume']);

    assert.equal(create.status, 405);
    assert.equal(create.headers.get('Allow'), 'GET, HEAD');
    assert.deepEqual(changes, [400, 400, 400]);
    assert.deepEqual(others, { 'organizations/new': 404, 'organizations/settings': 404, 'organizations/resume': 404 });
    assert.deepEqual(site.sessions.switches, [{ subject: 'user-sam', organizationId: 'org-a' }]);
    assert.deepEqual(site.failures, []);
  });
});
