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
import { signInThroughServer } from '../../support/dsl/workos-sign-in.ts';
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

  test('Given signup is enabled without approved documents, when the application starts, then startup fails', async (t) => {
    await assert.rejects(serveWorkOSSite(t, { config: hostedRootConfig, organizations: ['org_INTERNAL'], signup: { enabled: true } }), /document|bundle/i);
  });

  test('Given a visitor, when signup opens, then the full notice appears before sign in', async (t) => {
    const site = await openSignupSite(t, true);
    const browser = new HostedBrowser(site.transport, site.publicBaseUrl);
    const answer = await browser.open('signup');

    assert.equal(answer.status, 200);
    assert.ok(answer.body.includes(signupDocuments.notice.text));
    assert.match(answer.body, /href="\/login\?return_to=(?:%2F|\/)signup"/);
    assert.deepEqual(site.signupFake.organizations, []);
  });

  for (const method of ['GET', 'POST'] as const) {
    test(`Given a signed-in user deleted from WorkOS, when signup receives ${method}, then it offers fresh sign-in without activation writes`, async (t) => {
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
      const signIn = page.querySelector('.task-card a[href="/login?return_to=%2Fsignup"]');
      assert.ok(signIn);
      assert.equal(signIn.textContent, 'Sign in to continue');
      assert.equal(page.querySelector('header img')?.getAttribute('src'), '/assets/thermus-logo.svg');
      assert.equal(page.querySelector('#privacy-notice .document-reader')?.getAttribute('tabindex'), '0');
      assert.deepEqual(formsIn(answer.body), []);
      assert.doesNotMatch(answer.body, /type="checkbox"|temporarily unavailable/);
      assert.deepEqual(site.signupFake.organizations, []);
      assert.deepEqual(site.world.memberships, []);
      assert.deepEqual(site.world.fake.takeRequests().filter(({ method: verb }) => verb !== 'GET'), []);
    });
  }

  test('Given a signed-out visitor posts an old signup form, when signup answers, then the full notice and a usable Sign in link appear without writes', async (t) => {
    const site = await openSignupSite(t, true);
    const browser = new HostedBrowser(site.transport, site.publicBaseUrl);
    site.world.fake.takeRequests();
    const answer = await browser.post('signup', { csrf_token: 'old-token', document_version: signupDocuments.version, agreement: 'accepted' });

    assert.equal(answer.status, 401, answer.body);
    assert.ok(answer.body.includes(signupDocuments.notice.text), answer.body);
    const signIn = parseHTML(answer.body).document.querySelector('.task-card a[href="/login?return_to=%2Fsignup"]');
    assert.ok(signIn);
    assert.equal(signIn.textContent, 'Sign in to continue');
    assert.deepEqual(formsIn(answer.body), []);
    assert.equal(site.signupFake.organizations.length, 0);
    assert.equal(site.world.memberships.length, 0);
    assert.deepEqual(site.world.fake.takeRequests(), []);
  });

  test('Given a deleted user follows signup Sign in, when a fresh user returns and accepts the agreement, then one new organization receives Admin access', async (t) => {
    const site = await openSignupSite(t, true);
    const deleted = { id: 'user_OLD', email: 'returning@example.com', firstName: 'Person' };
    site.world.users = [deleted];
    const { browser } = await signInThroughServer(site, deleted);
    site.world.users = [];
    const recovery = await browser.open('signup');
    const signIn = parseHTML(recovery.body).document.querySelector('a[href="/login?return_to=%2Fsignup"]');
    assert.ok(signIn, recovery.body);
    const start = await browser.open(signIn.getAttribute('href') ?? '');
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

  test('Given current User access, when signup opens, then Continue uses the selector and returns to the portal without another agreement or provider write', async (t) => {
    const site = await openSignupSite(t, true);
    const user = { id: 'user_CONTINUE', email: 'person@company.example', firstName: 'Person' };
    site.world.users = [user];
    site.world.memberships = [{ userId: user.id, organizationId: 'org_INTERNAL', roles: ['user'], status: 'active' }];
    const { browser } = await signInThroughServer(site, user);
    site.world.fake.takeRequests();

    const page = await browser.open('signup?return_to=https://other.example/');

    assert.equal(page.status, 200, page.body);
    assert.match(page.body, /<a[^>]* href="\/organizations\?return_to=%2F">Continue<\/a>/);
    assert.deepEqual(formsIn(page.body), []);
    assert.doesNotMatch(page.body, /type="checkbox"|other\.example/);
    assert.ok(!page.body.includes(signupDocuments.terms.text));
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

  test('Given existing Admin-only access, when signup opens, then Continue preserves existing access without agreement, organization creation, or a new User membership', async (t) => {
    const site = await openSignupSite(t, true);
    const user = { id: 'user_ADMIN', email: 'admin@company.example', firstName: 'Admin' };
    site.world.users = [user];
    site.world.memberships = [{ userId: user.id, organizationId: 'org_INTERNAL', roles: ['admin'], status: 'active' }];
    const { browser } = await signInThroughServer(site, user);
    site.world.fake.takeRequests();

    const page = await browser.open('signup');

    assert.equal(page.status, 200, page.body);
    assert.match(page.body, /href="\/organizations\?return_to=%2F">Continue<\/a>/);
    assert.deepEqual(formsIn(page.body), []);
    assert.deepEqual(site.world.rolesOf(user, 'org_INTERNAL'), ['admin']);
    assert.deepEqual(site.signupFake.organizations, []);
    assert.equal(site.world.memberships.length, 1);
    assert.deepEqual(site.world.fake.takeRequests().filter(({ method }) => method !== 'GET'), []);
  });

  test('Given a signup form opened before Admin access was granted, when the old form is submitted, then existing access is used without another organization or grant', async (t) => {
    const site = await openSignupSite(t, true);
    const user = { id: 'user_STALE_FORM', email: 'person@company.example', firstName: 'Person' };
    site.world.users = [user];
    const { browser } = await signInThroughServer(site, user);
    const form = formsIn((await browser.open('signup')).body).find(({ action }) => action === '/signup');
    assert.ok(form);
    site.world.memberships = [{ userId: user.id, organizationId: 'org_INTERNAL', roles: ['admin'], status: 'active' }];
    site.world.fake.takeRequests();

    const answer = await browser.post('signup', { ...form.fields, organization_name: 'Acme Labs', agreement: 'accepted' });

    assert.equal(answer.status, 303, answer.body);
    assert.equal(answer.location?.searchParams.get('return_to'), '/');
    assert.deepEqual(site.world.rolesOf(user, 'org_INTERNAL'), ['admin']);
    assert.deepEqual(site.signupFake.organizations, []);
    assert.deepEqual(site.world.fake.takeRequests().filter(({ method }) => method !== 'GET'), []);
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
    assert.deepEqual(formsIn(publicPage.body), []);
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

function renderedText(markdown: string) {
  return parseHTML(`<div id=expected>${micromark(markdown, { extensions: [gfm()], htmlExtensions: [gfmHtml()] })}</div>`).document.querySelector('#expected')?.textContent;
}

function servedDocument(page: ReturnType<typeof parseHTML>['document'], id: string) {
  return { text: page.querySelector(`#${id} .document-reader`)?.textContent, version: page.querySelector(`#${id}`)?.getAttribute('data-document-version') };
}
