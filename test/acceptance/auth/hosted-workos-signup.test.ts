import { approvedSignupDocuments } from '../../../src/auth/hosted-auth/workos/workos-approved-signup-documents.ts';
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
import type { WorkOSFake } from '../../support/doubles/workos/workos-fake.ts';

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

  test('Given a verified user with no access, when the agreement is accepted again after activation and revocation, then one User grant is created and stays revoked', async (t) => {
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

    const fields = { ...form.fields, agreement: 'accepted' };
    const answer = await browser.post('signup', fields);
    assert.equal(answer.status, 303, answer.body);
    assert.equal(answer.location?.pathname, '/organizations');
    assert.equal(answer.location?.searchParams.get('return_to'), '/');
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
    assert.deepEqual(site.world.rolesOf(user, String(organization.id)), ['user']);
    const writes = site.world.fake.takeRequests().filter(({ method }) => method === 'POST');
    assert.equal(writes.filter(({ path }) => path === '/organizations').length, 1);
    assert.equal(writes.filter(({ path }) => path === '/user_management/organization_memberships').length, 1);
    const selector = await browser.follow(answer);
    const select = formsIn(selector.body).find(({ fields: selectedFields }) => selectedFields.organization_id === organization.id);
    assert.ok(select, selector.body);
    const selected = await browser.submit(select);
    assert.equal(selected.status, 303, selected.body);
    assert.equal(selected.location?.pathname, '/');
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
    const { browser } = await signInThroughServer(site, { id: 'user_INVALID', email: 'person@example.com', firstName: 'Person' });
    const page = await browser.open('signup');
    const form = formsIn(page.body).find(({ action }) => action === '/signup');
    assert.ok(form);
    site.world.fake.takeRequests();

    assert.equal((await browser.post('signup', form.fields)).status, 400);
    assert.equal((await browser.post('signup', { ...form.fields, agreement: 'accepted' }, { origin: 'https://other.example' })).status, 403);
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
    const answer = await browser.post('signup', { ...form.fields, agreement: 'accepted' });
    assert.equal(answer.status, 403, answer.body);
    assert.match(answer.body, /verify/i);
    assert.deepEqual(site.signupFake.organizations, []);
    assert.deepEqual(site.world.memberships, []);
  });

  test('Given existing Admin access, when signup is submitted, then a separate personal workspace gets only User access', async (t) => {
    const site = await openSignupSite(t, true);
    const user = { id: 'user_EXISTING_ADMIN', email: 'person@company.example', firstName: 'Person' };
    site.world.users = [user];
    site.world.memberships = [{ userId: user.id, organizationId: 'org_INTERNAL', roles: ['admin'], status: 'active' }];
    const { browser } = await signInThroughServer(site, user);
    const form = formsIn((await browser.open('signup')).body).find(({ action }) => action === '/signup');
    assert.ok(form);
    const answer = await browser.post('signup', { ...form.fields, agreement: 'accepted' });
    assert.equal(answer.status, 303, answer.body);
    assert.equal(answer.location?.pathname, '/organizations');
    assert.deepEqual(site.world.rolesOf(user, 'org_INTERNAL'), ['admin']);
    assert.equal(site.signupFake.organizations.length, 1);
    assert.deepEqual(site.world.rolesOf(user, String(site.signupFake.organizations[0]?.id)), ['user']);
  });

  test('Given a signup form opened before User access was granted, when the old form is submitted, then existing access is used without another organization or grant', async (t) => {
    const site = await openSignupSite(t, true);
    const user = { id: 'user_STALE_FORM', email: 'person@company.example', firstName: 'Person' };
    site.world.users = [user];
    const { browser } = await signInThroughServer(site, user);
    const form = formsIn((await browser.open('signup')).body).find(({ action }) => action === '/signup');
    assert.ok(form);
    site.world.memberships = [{ userId: user.id, organizationId: 'org_INTERNAL', roles: ['user'], status: 'active' }];
    site.world.fake.takeRequests();

    const answer = await browser.post('signup', { ...form.fields, agreement: 'accepted' });

    assert.equal(answer.status, 303, answer.body);
    assert.equal(answer.location?.searchParams.get('return_to'), '/');
    assert.deepEqual(site.world.rolesOf(user, 'org_INTERNAL'), ['user']);
    assert.deepEqual(site.signupFake.organizations, []);
    assert.deepEqual(site.world.fake.takeRequests().filter(({ method }) => method !== 'GET'), []);
  });

  test('Given a revoked personal workspace and current access elsewhere, when signup opens, then it requires support and lets other access continue without a new agreement or repair', async (t) => {
    const site = await openSignupSite(t, true);
    const user = { id: 'user_REVOKED', email: 'person@company.example', firstName: 'Person' };
    site.world.users = [user];
    const { browser } = await signInThroughServer(site, user);
    const form = formsIn((await browser.open('signup')).body).find(({ action }) => action === '/signup');
    assert.ok(form);
    assert.equal((await browser.post('signup', { ...form.fields, agreement: 'accepted' })).status, 303);
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

  test('Given the personal-record lookup fails, when signup opens, then the page reports unavailability instead of offering a new agreement', async (t) => {
    const site = await openSignupSite(t, true);
    const user = { id: 'user_OUTAGE', email: 'person@example.com', firstName: 'Person' };
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


describe('FS-04 production signup documents', () => {
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

  test('Given signup is enabled only in a production-path test, when a visitor signs in and accepts the complete frozen documents, then their exact versions and hashes reach the acceptance record', async (t) => {
    const site = await openProductionSignupSite(t, true);
    const visitor = new HostedBrowser(site.transport, site.publicBaseUrl);
    const noticePage = await visitor.open('signup');
    const noticeDocument = parseHTML(noticePage.body).document;
    const noticeReader = noticeDocument.querySelector('#privacy-notice .document-reader');
    assert.ok(noticeReader);
    const notice = noticeReader.textContent;
    assert.equal(noticePage.status, 200, noticePage.body);
    assert.equal(createHash('sha256').update(approvedSignupDocuments.notice.text).digest('hex'), 'a56c234b9bf98f3d5a9f0e5231547a45e1cbbe0099e019c8b5326f47b5a69669');
    assert.equal(createHash('sha256').update(notice).digest('hex'), '2c285b8ae45a90dc355706f9728e8769e19b8174b4abefb8adf57ac9aa1d12f9');
    assert.equal(noticeDocument.querySelector('#privacy-notice')?.getAttribute('data-document-version'), approvedSignupDocuments.notice.version);
    assert.match(notice, /How Thermus handles information/);
    assert.match(notice, /10\. Changes and contact/);
    assert.equal(noticeDocument.querySelectorAll('#privacy-notice .document-reader table').length, 2);
    assert.match(noticePage.body, /Sign in/);
    assert.deepEqual(site.world.fake.takeRequests(), []);

    const user = { id: 'user_FROZEN_POLICY', email: 'person@example.com', firstName: 'Person' };
    site.world.users = [user];
    const { browser } = await signInThroughServer(site, user);
    const page = await browser.open('signup');
    assert.equal(page.status, 200, page.body);
    const document = parseHTML(page.body).document;
    const terms = document.querySelector('#terms .document-reader')?.textContent ?? '';
    assert.equal(Buffer.byteLength(approvedSignupDocuments.terms.text, 'utf8'), 17523);
    assert.equal(createHash('sha256').update(approvedSignupDocuments.terms.text).digest('hex'), '31ec3ed48a4513f167d8e5cc49d1ff7b0e059f0c9ffe128f4c274a4e3efad15f');
    assert.equal(createHash('sha256').update(terms).digest('hex'), '977453ea25207501eabca4ea288165d4b7b5a3269928bb89ec68e0eb036d8e35');
    assert.match(terms, /Security has limits\./);
    assert.match(terms, /12\. About these terms/);
    assert.equal(document.querySelector('#terms')?.getAttribute('data-document-version'), approvedSignupDocuments.terms.version);
    assert.equal(document.querySelector('#privacy-notice .document-reader')?.textContent, notice);
    const checkbox = document.querySelector('input[type="checkbox"]');
    assert.ok(checkbox);
    assert.equal(document.querySelectorAll('input[type="checkbox"]').length, 1);
    assert.equal(checkbox.hasAttribute('checked'), false);
    const agreement = document.querySelector('.agreement-text')?.textContent ?? '';
    assert.equal(Buffer.byteLength(agreement), 388);
    assert.equal(createHash('sha256').update(agreement).digest('hex'), 'a55a976f413b27220d205c629243e16ae3f95a40d12008bcfb98f2bd14f70ab6');
    const form = formsIn(page.body).find(({ action }) => action === '/signup');
    assert.ok(form);
    assert.equal(form.fields.document_version, 'fs03-review-2026-10-16-v1');

    const result = await browser.post('signup', { ...form.fields, agreement: 'accepted' });
    assert.equal(result.status, 303, result.body);
    const metadata = site.signupFake.organizations[0]?.metadata as Record<string, string>;
    assert.equal(metadata.documents_version, form.fields.document_version);
    assert.equal(metadata.terms_version, 'hosted-terms-review-2026-10-16-v1');
    assert.equal(metadata.terms_sha256, '31ec3ed48a4513f167d8e5cc49d1ff7b0e059f0c9ffe128f4c274a4e3efad15f');
    assert.equal(metadata.notice_version, 'hosted-privacy-review-2026-10-16-v1');
    assert.equal(metadata.notice_sha256, 'a56c234b9bf98f3d5a9f0e5231547a45e1cbbe0099e019c8b5326f47b5a69669');
    assert.equal(metadata.agreement_version, 'hosted-agreement-review-2026-10-16-v1');
  });
});


for (const part of ['terms', 'notice'] as const) {
  for (const corruption of ['bytes', 'hash'] as const) {
    test(`Given the approved ${part} with corrupt ${corruption}, when signup is composed, then it fails before any provider read or write`, async (t) => {
      const original = approvedSignupDocuments[part];
      const changed = corruption === 'bytes' ? { ...original, text: original.text + ' ' } : { ...original, sha256: '0'.repeat(64) };
      const documents = { ...approvedSignupDocuments, [part]: changed };
      // The site starts the fake before it composes the application, so the fake can show that no request reached it.
      let world: WorkOSFake | undefined;
      await assert.rejects(serveWorkOSSite(t, {
        config: hostedRootConfig, organizations: [], signup: { enabled: true, documents }, setUp: (started) => { world = started; },
      }), /document bytes or hash/);
      assert.deepEqual(world?.fake.takeRequests(), []);
    });
  }
}
