import { approvedOrganizationDocuments } from '../../../src/accounts/providers/workos/workos-approved-organization-documents.ts';
import { micromark } from 'micromark';
import { gfm, gfmHtml } from 'micromark-extension-gfm';
import { readFile } from 'node:fs/promises';
import { approvedSignupDocuments } from '../../../src/accounts/providers/workos/workos-approved-signup-documents.ts';
import { createHash } from 'node:crypto';
import { parseHTML } from 'linkedom';
import { openProductionSignupSite } from '../../support/in-process/production-signup-site.ts';
import assert from 'node:assert/strict';
import { hostedRootConfig } from '../../support/fixtures/hosted-config.ts';
import { signupDocuments } from '../../support/fixtures/signup-documents.ts';
import { describe, test, type TestContext } from 'node:test';
import { HostedBrowser, formsIn } from '../../support/drivers/browser/hosted-browser.ts';
import { signInThroughServer, signUpThroughServer } from '../../support/dsl/workos-sign-in.ts';
import { signupWrites } from '../../support/dsl/workos-signup.ts';
import { serveWorkOSSite } from '../../support/in-process/workos-site.ts';
import { WorkOSFake } from '../../support/doubles/workos/workos-fake.ts';

const openSignupSite = (t: TestContext, enabled = false) => serveWorkOSSite(t, {
  config: hostedRootConfig,
  organizations: ['org_INTERNAL'],
  signupFake: true,
  ...(enabled ? { signup: { enabled: true, documents: signupDocuments } } : {}),
});

describe('Hosted self-service signup is closed by default', () => {
  test('Given no signup setting, when a visitor opens signup, then the page says activation is closed and offers Sign in and Contact', async (t) => {
    const site = await openSignupSite(t);
    const browser = new HostedBrowser(site.transport, site.publicBaseUrl);
    site.world.fake.takeRequests();
    const answer = await browser.open('signup');

    assert.equal(answer.status, 200);
    assert.match(answer.body, /activation is closed/i);
    assert.match(answer.body, /<a[^>]* href="[^"]*login[^"]*">Sign in<\/a>/);
    assert.match(answer.body, /<a[^>]* href="mailto:legal@thermus.ai">Contact<\/a>/);
    assert.deepEqual(formsIn(answer.body), []);
    assert.equal(answer.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(site.world.fake.takeRequests(), []);
  });

  test('Given no signup setting, when a visitor follows Create account or posts an email at step 1, then the closed notice appears and no WorkOS read or provider sign-in starts', async (t) => {
    const site = await openSignupSite(t);
    const browser = new HostedBrowser(site.transport, site.publicBaseUrl);
    site.world.fake.takeRequests();

    const answer = await browser.open('signup/start');
    const posted = await browser.post('signup/start', { email: 'person@example.com' });

    assert.equal(answer.status, 200, answer.body);
    assert.match(answer.body, /activation is closed/i);
    assert.equal(answer.location, undefined);
    assert.deepEqual(answer.cookies, []);
    assert.equal(answer.headers.get('Cache-Control'), 'no-store');
    assert.equal(posted.status, 403, posted.body);
    assert.match(posted.body, /activation is closed/i);
    assert.equal(posted.location, undefined);
    assert.deepEqual(posted.cookies, []);
    assert.deepEqual(site.world.fake.takeRequests(), []);
  });

  test('Given closed signup and a signed-in identity without membership, when an earlier agreement form is posted, then activation stays closed and no membership is created', async (t) => {
    const site = await openSignupSite(t);
    const { browser } = await signInThroughServer(site, { id: 'user_SIGNUP', email: 'person@example.com', firstName: 'Person' });
    const session = JSON.parse((await browser.open('session')).body) as { csrfToken: string };
    site.world.fake.takeRequests();
    const answer = await browser.post('signup', { csrf_token: session.csrfToken, document_version: 'earlier-test-version', agreement: 'accepted' });

    assert.equal(answer.status, 403);
    assert.match(answer.body, /activation is closed/i);
    assert.deepEqual(site.world.memberships, []);
    assert.deepEqual(site.world.fake.takeRequests().filter(({ method, path }) => method === 'POST'
      && (path === '/organizations' || path === '/user_management/organization_memberships')), []);
  });
});

describe('Hosted self-service signup with a test legal bundle', () => {
  test('S1-03a Given an eligible verified person, when creation opens, then the organization name is editable and the one authority agreement is unchecked', async (t) => {
    const site = await openSignupSite(t, true);
    const user = { id: 'user_NAMED_FORM', email: 'creator@example.com', firstName: 'Creator', emailVerified: true };
    site.world.users = [user];
    const { browser } = await signInThroughServer(site, user);
    site.world.fake.takeRequests();

    const answer = await browser.open('signup');

    assert.equal(answer.status, 200, answer.body);
    const document = parseHTML(answer.body).document;
    const name = document.querySelector('input[name="organization_name"]');
    assert.ok(name, 'The creator can enter the organization name.');
    assert.equal(name.getAttribute('type'), 'text');
    assert.notEqual(name.id, '');
    assert.equal(name.hasAttribute('readonly'), false);
    assert.equal(name.hasAttribute('disabled'), false);
    assert.ok(document.querySelector(`label[for="${name.id}"]`)?.textContent?.includes('Organization name'));
    assert.equal(document.querySelectorAll('input[type="checkbox"]').length, 1);
    const agreement = document.querySelector('input[name="agreement"]');
    assert.ok(agreement);
    assert.equal(agreement.hasAttribute('checked'), false);
    assert.equal(document.querySelector('.agreement-text')?.textContent, signupDocuments.agreement.text);
    assert.ok(answer.body.includes(signupDocuments.terms.text));
    assert.ok(answer.body.includes(signupDocuments.notice.text));
    assert.equal(formsIn(answer.body).find(({ action }) => action === '/signup')?.label, 'Create organization');
    assert.equal(answer.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(site.world.fake.takeRequests().filter(({ method }) => method !== 'GET'), []);
  });

  test('S1-03a Given an eligible verified creator, Acme Labs, and the accepted authority agreement, when creation completes, then the first Admin is sent to the guide route with matching named organization context', async (t) => {
    const site = await openSignupSite(t, true);
    const user = { id: 'user_NAMED_CREATOR', email: 'creator@example.com', firstName: 'Creator', emailVerified: true };
    site.world.users = [user];
    const { browser } = await signInThroughServer(site, user);
    const form = formsIn((await browser.open('signup')).body).find(({ action }) => action === '/signup');
    assert.ok(form);
    site.world.fake.takeRequests();
    const submittedAt = Date.now();

    const answer = await browser.post('signup', { ...form.fields, organization_name: 'Acme Labs', agreement: 'accepted' });

    assert.equal(answer.status, 303, answer.body);
    assert.equal(answer.location?.pathname, '/quick-start');
    assert.equal(site.signupFake.organizations.length, 1);
    const organization = site.signupFake.organizations[0];
    assert.ok(organization);
    const organizationId = String(organization.id);
    assert.equal(organization.name, 'Acme Labs');
    assert.deepEqual(organization.domains, []);
    const metadata = organization.metadata as Record<string, string>;
    assert.equal(metadata.subject, user.id);
    assert.equal(metadata.documents_version, signupDocuments.version);
    assert.equal(metadata.terms_version, signupDocuments.terms.version);
    assert.equal(metadata.terms_sha256, signupDocuments.terms.sha256);
    assert.equal(metadata.notice_version, signupDocuments.notice.version);
    assert.equal(metadata.notice_sha256, signupDocuments.notice.sha256);
    assert.equal(metadata.agreement_version, signupDocuments.agreement.version);
    assert.equal(metadata.agreement_sha256, createHash('sha256').update(signupDocuments.agreement.text).digest('hex'));
    assert.ok(Date.parse(metadata.authority_accepted_at) >= submittedAt && Date.parse(metadata.authority_accepted_at) <= Date.now());
    assert.equal(site.world.memberships.length, 1);
    assert.deepEqual(site.world.rolesOf(user, organizationId), ['admin']);
    assert.equal(site.world.statusOf(user, organizationId), 'active');
    const session = JSON.parse((await browser.open('session')).body) as { organizationId: string };
    const access = await browser.open('portal/access');
    assert.equal(access.status, 200, access.body);
    assert.equal(session.organizationId, organizationId);
    assert.deepEqual(JSON.parse(access.body), {
      organizationId,
      organizationName: 'Acme Labs',
      roles: ['admin'],
      plan: 'free',
      memberLimit: 5,
      mcpUrl: site.world.mcpResourceUrl,
    });
    const writes = site.world.fake.takeRequests().filter(({ method }) => method === 'POST');
    assert.equal(writes.filter(({ path }) => path === '/organizations').length, 1);
    assert.equal(writes.filter(({ path }) => path === '/user_management/organization_memberships').length, 1);
  });

  test('Given a new visitor, when step 1 posts a new email and AuthKit returns the new verified user, then the provider starts at its sign-up screen with the email as login hint, signup offers the organization form, and creation opens Quick start', async (t) => {
    const site = await openSignupSite(t, true);
    const user = { id: 'user_NEW_ACCOUNT', email: 'new@example.com', firstName: 'New', emailVerified: true };

    const { browser, start, callback } = await signUpThroughServer(site, user);

    assert.equal(start.status, 303, start.body);
    assert.equal(start.location?.pathname, '/user_management/authorize');
    assert.equal(start.location?.searchParams.get('screen_hint'), 'sign-up');
    assert.equal(start.location?.searchParams.get('provider'), 'authkit');
    assert.equal(start.location?.searchParams.get('login_hint'), user.email);
    assert.ok(start.location?.searchParams.get('state'));
    assert.ok(start.cookies.some((cookie) => cookie.startsWith('__Host-thermus-sign-in=')), start.cookies.join('\n'));
    assert.equal(callback.status, 303, callback.body);
    assert.equal(callback.location?.href, new URL('signup', site.publicBaseUrl).href);
    const page = await browser.follow(callback);
    assert.equal(page.status, 200, page.body);
    const form = formsIn(page.body).find(({ action }) => action === '/signup');
    assert.ok(form, page.body);
    const created = await browser.post('signup', { ...form.fields, organization_name: 'Acme Labs', agreement: 'accepted' });
    assert.equal(created.status, 303, created.body);
    assert.equal(created.location?.pathname, '/quick-start');
    assert.equal(site.signupFake.organizations.length, 1);
    assert.deepEqual(site.world.rolesOf(user, String(site.signupFake.organizations[0]?.id)), ['admin']);
  });

  test('Given signup is enabled without approved documents, when the application starts, then startup fails', async (t) => {
    await assert.rejects(serveWorkOSSite(t, { config: hostedRootConfig, organizations: ['org_INTERNAL'], signup: { enabled: true } }), /document|bundle/i);
  });

  test('Given a visitor, when signup opens, then the full notice appears before account creation, and the page policy lets its form reach the WorkOS sign-in', async (t) => {
    const site = await openSignupSite(t, true);
    const browser = new HostedBrowser(site.transport, site.publicBaseUrl);
    const answer = await browser.open('signup');

    assert.equal(answer.status, 200);
    assert.ok(answer.body.includes(signupDocuments.notice.text));
    assert.ok(answer.body.indexOf(signupDocuments.notice.text) < answer.body.indexOf('action="/signup/start"'));
    // The POST of step 1 redirects to the WorkOS authorization, which redirects to AuthKit. Chrome applies form-action to
    // each redirect after the post, so the policy allows the origins of both; the fake serves both at one origin.
    const policy = answer.headers.get('Content-Security-Policy') ?? '';
    assert.ok(policy.includes(`form-action 'self' ${site.world.fake.origin};`), policy);
    assert.doesNotMatch(answer.body, /return_to/);
    assert.deepEqual(site.signupFake.organizations, []);
  });

  for (const method of ['GET', 'POST'] as const) {
    test(`Given a signed-in user deleted from WorkOS, when signup receives ${method}, then it offers account creation without activation writes`, async (t) => {
      const site = await openSignupSite(t, true);
      const user = { id: 'user_DELETED', email: 'deleted@example.com', firstName: 'Person' };
      site.world.users = [user];
      const { browser } = await signInThroughServer(site, user);
      const form = formsIn((await browser.open('signup')).body).find(({ action }) => action === '/signup');
      assert.ok(form);
      site.world.users = [];
      site.world.fake.takeRequests();

      const answer = method === 'GET' ? await browser.open('signup')
        : await browser.post('signup', { ...form.fields, organization_name: 'Acme Labs', agreement: 'accepted' });

      assert.equal(answer.status, method === 'GET' ? 200 : 401, answer.body);
      assert.ok(answer.body.includes(signupDocuments.notice.text), answer.body);
      const page = parseHTML(answer.body).document;
      assertAccountCreationForm(answer.body);
      assert.equal(page.querySelector('header img')?.getAttribute('src'), '/assets/thermus-logo.svg');
      assert.equal(page.querySelector('#privacy-notice .document-reader')?.getAttribute('tabindex'), '0');
      assert.doesNotMatch(answer.body, /type="checkbox"|temporarily unavailable/);
      assert.deepEqual(site.signupFake.organizations, []);
      assert.deepEqual(site.world.memberships, []);
      assert.deepEqual(site.world.fake.takeRequests().filter(({ method: verb }) => verb !== 'GET'), []);
    });
  }

  test('Given a signed-out visitor posts an old signup form, when signup answers, then the full notice and the step 1 email form appear without writes', async (t) => {
    const site = await openSignupSite(t, true);
    const browser = new HostedBrowser(site.transport, site.publicBaseUrl);
    site.world.fake.takeRequests();
    const answer = await browser.post('signup', { csrf_token: 'old-token', document_version: signupDocuments.version, agreement: 'accepted' });

    assert.equal(answer.status, 401, answer.body);
    assert.ok(answer.body.includes(signupDocuments.notice.text), answer.body);
    assertAccountCreationForm(answer.body);
    assert.equal(site.signupFake.organizations.length, 0);
    assert.equal(site.world.memberships.length, 0);
    assert.deepEqual(site.world.fake.takeRequests(), []);
  });

  test('Given a deleted user posts the email of step 1, when a fresh user returns and accepts the agreement, then one new organization receives Admin access', async (t) => {
    const site = await openSignupSite(t, true);
    const deleted = { id: 'user_OLD', email: 'returning@example.com', firstName: 'Person' };
    site.world.users = [deleted];
    const { browser } = await signInThroughServer(site, deleted);
    site.world.users = [];
    const recovery = await browser.open('signup');
    assertAccountCreationForm(recovery.body);
    const start = await browser.post('signup/start', { email: deleted.email });
    assert.equal(start.location?.searchParams.get('screen_hint'), 'sign-up');
    assert.equal(start.location?.searchParams.get('login_hint'), deleted.email);
    const state = start.location?.searchParams.get('state');
    assert.ok(state);
    const fresh = { ...deleted, id: 'user_FRESH' };
    site.world.users = [fresh];
    const callback = await browser.open(`callback?code=${site.world.codeFor(fresh)}&state=${encodeURIComponent(state)}`);
    assert.equal(callback.location?.pathname, '/signup', callback.body);
    const form = formsIn((await browser.follow(callback)).body).find(({ action }) => action === '/signup');
    assert.ok(form);
    const activation = await browser.post('signup', { ...form.fields, organization_name: 'Acme Labs', agreement: 'accepted' });

    assert.equal(activation.status, 303, activation.body);
    assert.equal(activation.location?.pathname, '/quick-start');
    assert.equal(site.signupFake.organizations.length, 1);
    const organization = site.signupFake.organizations[0];
    assert.ok(organization);
    assert.equal((organization.metadata as Record<string, string>).subject, fresh.id);
    assert.deepEqual(site.world.rolesOf(fresh, String(organization.id)), ['admin']);
    assert.equal(site.world.memberships.length, 1);
  });

  for (const method of ['GET', 'POST'] as const) {
    test(`Given a current-user provider outage, when signup receives ${method}, then it reports unavailability without activation writes`, async (t) => {
      const site = await openSignupSite(t, true);
      const user = { id: 'user_READ_OUTAGE', email: 'person@example.com', firstName: 'Person' };
      site.world.users = [user];
      const { browser } = await signInThroughServer(site, user);
      const form = formsIn((await browser.open('signup')).body).find(({ action }) => action === '/signup');
      assert.ok(form);
      site.world.fake.answer(`GET /user_management/users/${user.id}`, { status: 503, body: { message: 'private provider error' } });
      site.world.fake.takeRequests();

      const answer = method === 'GET' ? await browser.open('signup')
        : await browser.post('signup', { ...form.fields, organization_name: 'Acme Labs', agreement: 'accepted' });

      assert.equal(answer.status, 503, answer.body);
      assert.match(answer.body, /temporarily unavailable/);
      assert.doesNotMatch(answer.body, /private provider error/);
      assert.deepEqual(formsIn(answer.body), []);
      assert.equal(site.signupFake.organizations.length, 0);
      assert.equal(site.world.memberships.length, 0);
      assert.deepEqual(site.world.fake.takeRequests().filter(({ method: verb }) => verb !== 'GET'), []);
    });
  }

  test('Given current User access in an invited organization and no organization of its own, when signup opens with a foreign return_to, then it offers the organization form without a provider write, and the selector still opens the invited workspace at the portal', async (t) => {
    const site = await openSignupSite(t, true);
    const user = { id: 'user_CONTINUE', email: 'person@company.example', firstName: 'Person' };
    site.world.users = [user];
    site.world.memberships = [{ userId: user.id, organizationId: 'org_INTERNAL', roles: ['user'], status: 'active' }];
    const { browser } = await signInThroughServer(site, user);
    site.world.fake.takeRequests();

    const page = await browser.open('signup?return_to=https://other.example/');

    assert.equal(page.status, 200, page.body);
    assert.equal(formsIn(page.body).find(({ action }) => action === '/signup')?.label, 'Create organization');
    assert.ok(parseHTML(page.body).document.querySelector('input[name="organization_name"]'), page.body);
    assert.ok(page.body.includes(signupDocuments.terms.text));
    assert.doesNotMatch(page.body, /other\.example/);
    assert.deepEqual(site.signupFake.organizations, []);
    assert.deepEqual(site.world.fake.takeRequests().filter(({ method }) => method !== 'GET'), []);
    const selector = await browser.open('organizations?return_to=%2F');
    const select = formsIn(selector.body).find(({ fields }) => fields.organization_id === 'org_INTERNAL');
    assert.ok(select, selector.body);
    const selected = await browser.submit(select);
    assert.equal(selected.status, 303, selected.body);
    assert.equal(selected.location?.pathname, '/');
  });

  test('Given a verified user with no access, when the agreement is accepted again after activation and revocation, then one Admin grant is created and stays revoked', async (t) => {
    const site = await openSignupSite(t, true);
    const user = { id: 'user_NEW', email: 'person@gmail.com', firstName: 'Person', emailVerified: true };
    site.world.users = [user];
    const { browser } = await signInThroughServer(site, user);
    const page = await browser.open('signup');
    assert.ok(page.body.includes(signupDocuments.terms.text));
    assert.ok(page.body.includes(signupDocuments.notice.text));
    const form = formsIn(page.body).find(({ action }) => action === '/signup');
    assert.ok(form);
    assert.equal((page.body.match(/type="checkbox"/g) ?? []).length, 1);
    assert.equal(parseHTML(page.body).document.querySelector('input[name="agreement"]')?.hasAttribute('checked'), false);
    site.world.fake.takeRequests();

    const fields = { ...form.fields, organization_name: 'Acme Labs', agreement: 'accepted' };
    const answer = await browser.post('signup', fields);
    assert.equal(answer.status, 303, answer.body);
    assert.equal(answer.location?.pathname, '/quick-start');
    const repeated = await browser.post('signup', fields);
    assert.equal(repeated.status, 303, repeated.body);
    assert.equal(site.signupFake.organizations.length, 1);
    const organization = site.signupFake.organizations[0];
    assert.ok(organization);
    assert.deepEqual(organization.domains, []);
    assert.match(String(organization.external_id), /^thermus-signup:/);
    const metadata = organization.metadata as Record<string, string>;
    assert.equal(metadata.subject, user.id);
    assert.equal(metadata.documents_version, signupDocuments.version);
    assert.equal(metadata.terms_sha256, signupDocuments.terms.sha256);
    assert.equal(metadata.notice_sha256, signupDocuments.notice.sha256);
    assert.equal(site.world.memberships.length, 1);
    assert.deepEqual(site.world.rolesOf(user, String(organization.id)), ['admin']);
    const writes = site.world.fake.takeRequests().filter(({ method }) => method === 'POST');
    assert.equal(writes.filter(({ path }) => path === '/organizations').length, 1);
    assert.equal(writes.filter(({ path }) => path === '/user_management/organization_memberships').length, 1);
    assert.equal((JSON.parse((await browser.open('session')).body) as { organizationId: string }).organizationId, organization.id);
    const activated = await browser.open('signup');
    assert.match(activated.body, /href="\/organizations\?return_to=%2F">Continue<\/a>/);
    assert.deepEqual(formsIn(activated.body), []);
    site.world.fake.takeRequests();

    site.world.setStatus(user, String(organization.id), 'inactive');
    const revoked = await browser.post('signup', fields);
    assert.equal(revoked.status, 409, revoked.body);
    assert.match(revoked.body, /support|contact/i);
    assert.equal(site.world.statusOf(user, String(organization.id)), 'inactive');
    assert.deepEqual(site.world.fake.takeRequests().filter(({ method }) => method === 'POST'), []);
  });

  test('Given a signed-in user, when acceptance is missing or the origin is foreign, then no provider write occurs', async (t) => {
    const site = await openSignupSite(t, true);
    const user = { id: 'user_INVALID', email: 'person@example.com', firstName: 'Person' };
    site.world.users = [user];
    const { browser } = await signInThroughServer(site, user);
    const page = await browser.open('signup');
    const form = formsIn(page.body).find(({ action }) => action === '/signup');
    assert.ok(form);
    site.world.fake.takeRequests();

    assert.equal((await browser.post('signup', { ...form.fields, organization_name: 'Acme Labs' })).status, 400);
    assert.equal((await browser.post('signup', { ...form.fields, organization_name: 'Acme Labs', agreement: 'accepted' }, { origin: 'https://other.example' })).status, 403);
    assert.deepEqual(site.signupFake.organizations, []);
    assert.deepEqual(site.world.fake.takeRequests().filter(({ method }) => method === 'POST'), []);
  });
  test('Given a session for a user whose current email is unverified, when signup is submitted, then activation is refused', async (t) => {
    const site = await openSignupSite(t, true);
    const user = { id: 'user_UNVERIFIED', email: 'person@gmail.com', firstName: 'Person' };
    site.world.users = [{ ...user, emailVerified: false }];
    const { browser } = await signInThroughServer(site, { ...user, emailVerified: true });
    const form = formsIn((await browser.open('signup')).body).find(({ action }) => action === '/signup');
    assert.ok(form);
    const answer = await browser.post('signup', { ...form.fields, organization_name: 'Acme Labs', agreement: 'accepted' });
    assert.equal(answer.status, 403, answer.body);
    assert.match(answer.body, /verify/i);
    assert.deepEqual(site.signupFake.organizations, []);
    assert.deepEqual(site.world.memberships, []);
  });

  test('Given Admin-only access in an invited organization, when the person accepts the signup form, then the person\'s own organization opens at Quick start with Admin access, and the invited Admin membership stays unchanged', async (t) => {
    const site = await openSignupSite(t, true);
    const user = { id: 'user_ADMIN', email: 'admin@company.example', firstName: 'Admin' };
    site.world.users = [user];
    site.world.memberships = [{ userId: user.id, organizationId: 'org_INTERNAL', roles: ['admin'], status: 'active' }];
    const invited = structuredClone(site.world.memberships);
    const { browser } = await signInThroughServer(site, user);
    const form = formsIn((await browser.open('signup')).body).find(({ action }) => action === '/signup');
    assert.ok(form);
    signupWrites(site);

    const answer = await browser.post('signup', { ...form.fields, organization_name: 'Own Labs', agreement: 'accepted' });

    assert.equal(answer.status, 303, answer.body);
    assert.equal(answer.location?.pathname, '/quick-start');
    assert.equal(site.signupFake.organizations.length, 1);
    const organizationId = String(site.signupFake.organizations[0]?.id);
    const access = await browser.open('portal/access');
    assert.equal(access.status, 200, access.body);
    const opened = JSON.parse(access.body) as { organizationId: string; roles: string[] };
    assert.deepEqual([opened.organizationId, opened.roles], [organizationId, ['admin']]);
    assert.deepEqual(site.world.memberships.slice(0, invited.length), invited);
    assert.deepEqual(signupWrites(site).map(({ path }) => path), ['/organizations', '/user_management/organization_memberships']);
  });

  test('Given a signup form opened before an invitation gave Admin access, when the form is submitted, then the person\'s one organization is created and opens Quick start, and the invited Admin access stays unchanged', async (t) => {
    const site = await openSignupSite(t, true);
    const user = { id: 'user_STALE_FORM', email: 'person@company.example', firstName: 'Person' };
    site.world.users = [user];
    const { browser } = await signInThroughServer(site, user);
    const form = formsIn((await browser.open('signup')).body).find(({ action }) => action === '/signup');
    assert.ok(form);
    site.world.memberships = [{ userId: user.id, organizationId: 'org_INTERNAL', roles: ['admin'], status: 'active' }];
    const invited = structuredClone(site.world.memberships);
    signupWrites(site);

    const answer = await browser.post('signup', { ...form.fields, organization_name: 'Acme Labs', agreement: 'accepted' });

    assert.equal(answer.status, 303, answer.body);
    assert.equal(answer.location?.pathname, '/quick-start');
    assert.equal(site.signupFake.organizations.length, 1);
    assert.deepEqual(site.world.rolesOf(user, String(site.signupFake.organizations[0]?.id)), ['admin']);
    assert.deepEqual(site.world.memberships.slice(0, invited.length), invited);
    assert.deepEqual(signupWrites(site).map(({ path }) => path), ['/organizations', '/user_management/organization_memberships']);
  });

  test('Given a revoked created organization and current access elsewhere, when signup opens, then it requires support and lets other access continue without a new agreement or repair', async (t) => {
    const site = await openSignupSite(t, true);
    const user = { id: 'user_REVOKED', email: 'person@company.example', firstName: 'Person' };
    site.world.users = [user];
    const { browser } = await signInThroughServer(site, user);
    const form = formsIn((await browser.open('signup')).body).find(({ action }) => action === '/signup');
    assert.ok(form);
    assert.equal((await browser.post('signup', { ...form.fields, organization_name: 'Acme Labs', agreement: 'accepted' })).status, 303);
    const organizationId = String(site.signupFake.organizations[0]?.id);
    site.world.setStatus(user, organizationId, 'inactive');
    site.world.memberships = [...site.world.memberships, { userId: user.id, organizationId: 'org_INTERNAL', roles: ['user'], status: 'active' }];
    site.world.fake.takeRequests();

    const page = await browser.open('signup');

    assert.equal(page.status, 409, page.body);
    assert.match(page.body, /mailto:legal@thermus.ai/);
    assert.match(page.body, /href="\/organizations\?return_to=%2F">Continue to another workspace<\/a>/);
    assert.deepEqual(formsIn(page.body), []);
    assert.equal(site.world.statusOf(user, organizationId), 'inactive');
    assert.equal(site.signupFake.organizations.length, 1);
    assert.deepEqual(site.world.fake.takeRequests().filter(({ method }) => method !== 'GET'), []);
  });

  test('Given the signup-record lookup fails, when signup opens, then the page reports unavailability instead of offering a new agreement', async (t) => {
    const site = await openSignupSite(t, true);
    const user = { id: 'user_OUTAGE', email: 'person@example.com', firstName: 'Person' };
    site.world.users = [user];
    const { browser } = await signInThroughServer(site, user);
    site.signupFake.failOrganizationReads = true;
    site.world.fake.takeRequests();

    const page = await browser.open('signup');

    assert.equal(page.status, 503, page.body);
    assert.match(page.body, /temporarily unavailable/);
    assert.deepEqual(formsIn(page.body), []);
    assert.doesNotMatch(page.body, /private provider error/);
    assert.deepEqual(site.signupFake.organizations, []);
    assert.deepEqual(site.world.fake.takeRequests().filter(({ method }) => method !== 'GET'), []);
  });

});


describe('Step 1 of free access checks the email address before AuthKit opens', () => {
  test('Given a person whose email already has a Thermus account, when step 1 posts that email, then step 1 says that the account exists, offers Sign in, keeps the email, and starts no provider sign-in', async (t) => {
    const site = await openSignupSite(t, true);
    site.world.users = [{ id: 'user_EXISTING', email: 'person@example.com', firstName: 'Person' }];
    const browser = new HostedBrowser(site.transport, site.publicBaseUrl);
    site.world.fake.takeRequests();

    const answer = await browser.post('signup/start', { email: ' Person@Example.com ' });

    assert.equal(answer.status, 409, answer.body);
    const page = parseHTML(answer.body).document;
    const message = page.querySelector('.task-card .form-message');
    assert.ok(message, answer.body);
    assert.match(message.textContent, /^An account with this email address already exists\. Sign in to create your organization or to open your workspace\.$/);
    assert.equal(message.getAttribute('role'), 'alert');
    assert.equal(message.querySelector('a[href="/login"]')?.textContent, 'Sign in');
    assert.equal(page.querySelector('input[name="email"]')?.getAttribute('value'), 'person@example.com');
    assertAccountCreationForm(answer.body);
    assert.equal(answer.location, undefined);
    assert.deepEqual(answer.cookies, []);
    const requests = site.world.fake.takeRequests();
    assert.deepEqual(requests.map(({ method, path }) => `${method} ${new URL(path, 'http://fake').pathname}`), ['GET /user_management/users']);
    assert.equal(new URL(requests[0]?.path ?? '', 'http://fake').searchParams.get('email'), 'person@example.com');
  });

  test('Given an email address that is not valid, when step 1 posts it, then step 1 asks for a valid address and no WorkOS read or provider sign-in starts', async (t) => {
    const site = await openSignupSite(t, true);
    const browser = new HostedBrowser(site.transport, site.publicBaseUrl);
    site.world.fake.takeRequests();

    for (const email of ['', 'person', 'person@example', 'two words@example.com', `${'a'.repeat(250)}@example.com`]) {
      const answer = await browser.post('signup/start', { email });

      assert.equal(answer.status, 400, email);
      assert.equal(parseHTML(answer.body).document.querySelector('.task-card .form-message')?.textContent, 'Enter a valid email address.');
      assertAccountCreationForm(answer.body);
      assert.equal(answer.location, undefined);
      assert.deepEqual(answer.cookies, []);
    }
    assert.deepEqual(site.world.fake.takeRequests(), []);
  });

  test('Given the WorkOS user read fails, when step 1 posts a new email, then the provider sign-in still starts with the email as login hint and the operator log has only fixed text', async (t) => {
    const site = await openSignupSite(t, true);
    site.world.fake.answer('GET /user_management/users', { status: 500, body: { message: 'private provider error' } });
    const browser = new HostedBrowser(site.transport, site.publicBaseUrl);

    const answer = await browser.post('signup/start', { email: 'new@example.com' });

    assert.equal(answer.status, 303, answer.body);
    assert.equal(answer.location?.pathname, '/user_management/authorize');
    assert.equal(answer.location?.searchParams.get('screen_hint'), 'sign-up');
    assert.equal(answer.location?.searchParams.get('login_hint'), 'new@example.com');
    assert.ok(answer.cookies.some((cookie) => cookie.startsWith('__Host-thermus-sign-in=')), answer.cookies.join('\n'));
    assert.deepEqual(site.log.lines.filter((line) => line.startsWith('ERROR ')), ['ERROR Hosted signup could not check the email address.']);
    assert.ok(site.log.lines.every((line) => !line.includes('private provider error')), site.log.lines.join('\n'));
  });
});


describe('S2.5 production signup documents', () => {
  test('Given production signup is off by default, when GET, HEAD, or an old form arrives, then it stays closed without policy bytes or provider reads', async (t) => {
    const site = await openProductionSignupSite(t);
    const browser = new HostedBrowser(site.transport, site.publicBaseUrl);
    const get = await browser.open('signup');
    const post = await browser.post('signup', { agreement: 'accepted' });
    const head = await site.transport(new Request(new URL('signup', site.publicBaseUrl), { method: 'HEAD' }));

    assert.equal(get.status, 200);
    assert.equal(post.status, 403);
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
    for (const page of [get, post]) {
      assert.match(page.body, /New account activation is closed/);
      assert.doesNotMatch(page.body, /<pre>|fs03-review|Terms of Service|Privacy Notice|By checking/);
    }
    assert.deepEqual(site.world.fake.takeRequests(), []);
  });

  test('S2.5 Given the approved membership-removal bundle in the hosted candidate and an eligible creator, when signup opens and its one agreement is accepted, then exact Terms and Privacy are served and the first Admin retains their legal versions and hashes', async (t) => {
    const site = await openProductionSignupSite(t, true);
    const expected = {
      version: 's2502-organization-removal-proposal-2026-10-26-v1',
      terms: { version: 'hosted-terms-organization-removal-proposal-2026-10-26-v1', sha256: '164e013e2cbf0889ad5aaaef14aac745acaed01023bc914c7adae1a4bf4ce048' },
      notice: { version: 'hosted-privacy-organization-removal-proposal-2026-10-26-v1', sha256: 'df330cf3d905f4bd6f64d3a9dfd8dded5be476c39e40e05b87596e6678429b1c' },
      agreement: { version: 'hosted-agreement-organization-proposal-2026-10-23-v2', sha256: '279cb2f3005131618bcf7f3ea755ad09205dca3c490f2c3de0c70b25e1ef2a9a' },
    };
    const visitor = new HostedBrowser(site.transport, site.publicBaseUrl);
    const publicPage = await visitor.open('signup');
    const publicNotice = servedDocument(parseHTML(publicPage.body).document, 'privacy-notice');
    const privacy = await readFile('docs/legal/organization-removal-2026-10-26-proposal-v1/privacy.md', 'utf8');
    assert.equal(publicNotice.text, renderedText(privacy));
    assert.equal(publicNotice.version, expected.notice.version);
    assertAccountCreationForm(publicPage.body);
    assert.deepEqual(site.world.fake.takeRequests(), []);
    const user = { id: 'user_AUDIT_CREATOR', email: 'creator@example.com', firstName: 'Creator', emailVerified: true };
    site.world.users = [user];
    const { browser } = await signInThroughServer(site, user);
    const answer = await browser.open('signup');
    assert.equal(answer.status, 200, answer.body);
    const document = parseHTML(answer.body).document;
    for (const [id, file, legal] of [
      ['terms', 'terms.md', expected.terms],
      ['privacy-notice', 'privacy.md', expected.notice],
    ] as const) {
      const source = await readFile(`docs/legal/organization-removal-2026-10-26-proposal-v1/${file}`, 'utf8');
      assert.equal(createHash('sha256').update(source).digest('hex'), legal.sha256);
      const served = servedDocument(document, id);
      assert.equal(served.text, renderedText(source));
      assert.equal(served.version, legal.version);
    }
    const checkbox = document.querySelector('input[name="agreement"]');
    assert.equal(document.querySelectorAll('input[type="checkbox"]').length, 1);
    assert.ok(checkbox);
    assert.equal(checkbox.hasAttribute('checked'), false);
    const agreement = document.querySelector('.agreement-text')?.textContent;
    assert.equal(agreement, await readFile('docs/legal/organization-removal-2026-10-26-proposal-v1/agreement.txt', 'utf8'));
    assert.equal(createHash('sha256').update(agreement ?? '').digest('hex'), expected.agreement.sha256);
    const form = formsIn(answer.body).find(({ action }) => action === '/signup');
    assert.ok(form);
    assert.equal(form.fields.document_version, expected.version);
    for (const version of [approvedOrganizationDocuments.version, 's204-organization-audit-proposal-2026-10-24-v3']) {
      const stale = await browser.post('signup', { ...form.fields, document_version: version, organization_name: 'Audit Organization', agreement: 'accepted' });
      assert.equal(stale.status, 400, stale.body);
      assert.equal(site.signupFake.organizations.length, 0);
      assert.equal(site.world.memberships.length, 0);
    }
    const created = await browser.post('signup', { ...form.fields, organization_name: 'Audit Organization', agreement: 'accepted' });
    assert.equal(created.status, 303, created.body);
    assert.equal(site.signupFake.organizations.length, 1);
    const organization = site.signupFake.organizations[0];
    assert.ok(organization);
    const metadata = organization.metadata as Record<string, string>;
    assert.equal(metadata.documents_version, expected.version);
    for (const part of ['terms', 'notice', 'agreement'] as const) {
      assert.equal(metadata[`${part}_version`], expected[part].version);
      assert.equal(metadata[`${part}_sha256`], expected[part].sha256);
    }
    assert.deepEqual(site.world.rolesOf(user, String(organization.id)), ['admin']);
    assert.equal((await browser.open('portal/access')).status, 200);
  });

});


test('Given the earlier personal bundle, when an explicit composition enables organization creation, then startup still refuses it before provider access', async (t) => {
  let world: WorkOSFake | undefined;
  await assert.rejects(serveWorkOSSite(t, {
    config: hostedRootConfig, organizations: [], signup: { enabled: true, documents: approvedSignupDocuments },
    setUp: (started) => { world = started; },
  }), /organization-creation/);
  assert.ok(world);
  assert.deepEqual(world.fake.takeRequests(), []);
});


for (const part of ['terms', 'notice'] as const) {
  for (const corruption of ['bytes', 'hash'] as const) {
    test(`Given the approved ${part} with corrupt ${corruption}, when signup is composed, then it fails before any provider read or write`, async (t) => {
      const original = approvedOrganizationDocuments[part];
      const changed = corruption === 'bytes' ? { ...original, text: original.text + ' ' } : { ...original, sha256: '0'.repeat(64) };
      const documents = { ...approvedOrganizationDocuments, [part]: changed };
      // The site starts the fake before it composes the application, so the fake can show that no request reached it.
      let world: WorkOSFake | undefined;
      await assert.rejects(serveWorkOSSite(t, {
        config: hostedRootConfig, organizations: [], signup: { enabled: true, documents }, setUp: (started) => { world = started; },
      }), /document bytes or hash/);
      assert.deepEqual(world?.fake.takeRequests(), []);
    });
  }
}

// Step 1 of free access: the one form, which posts the email address to the account creation path.
function assertAccountCreationForm(body: string) {
  const form = parseHTML(body).document.querySelector('.task-card form[action="/signup/start"]');
  assert.ok(form, body);
  const email = form.querySelector('input[name="email"]');
  assert.ok(email, body);
  assert.equal(email.getAttribute('type'), 'email');
  assert.equal(email.hasAttribute('required'), true);
  assert.deepEqual(formsIn(body), [{ action: '/signup/start', fields: {}, label: 'Create account' }]);
}

function renderedText(markdown: string) {
  return parseHTML(`<div id=expected>${micromark(markdown, { extensions: [gfm()], htmlExtensions: [gfmHtml()] })}</div>`).document.querySelector('#expected')?.textContent;
}

function servedDocument(page: ReturnType<typeof parseHTML>['document'], id: string) {
  return { text: page.querySelector(`#${id} .document-reader`)?.textContent, version: page.querySelector(`#${id}`)?.getAttribute('data-document-version') };
}
