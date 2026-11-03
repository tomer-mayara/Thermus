import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { signupClosedPage, signupContinuePage, signupCreateAccountPage, signupFailurePage, signupFormPage } from '../../../src/interfaces/web/auth/workos/workos-signup-pages.ts';

const documentOf = (text: string) => ({ version: 'legal-v1', text, sha256: createHash('sha256').update(text).digest('hex') });
const documents = { version: 'bundle-v1', terms: documentOf('# Terms\n\nOriginal terms.'), notice: documentOf('# Notice\n\nOriginal notice.'), agreement: { version: 'agreement-v1', text: 'I agree to these exact terms.\n' } };
const accountPaths = { creation: '/signup/start', signIn: '/login' };

test('Given Markdown legal text, when signup renders it, then headings, emphasis, lists, tables and safe links are readable without executable markup or dangerous URLs', async () => {
  const markdown = '# Policy\n\nAn **original** paragraph with `code`.\n\n- First condition\n- Last condition\n\n| Item | Purpose |\n| --- | --- |\n| Account | Access |\n\n[Contact](mailto:legal@thermus.ai) and [Guide](https://thermus.ai/guide).\n\n<script>alert("no")</script>\n\n[Unsafe](javascript:alert%281%29)\n\n[Encoded](jav&#x61;script:alert%281%29)';
  const response = signupCreateAccountPage({ ...documents, notice: documentOf(markdown) }, accountPaths);
  const page = parseHTML(await response.text()).document;
  const reader = page.querySelector('.document-reader');
  assert.ok(reader);

  assert.equal(reader.querySelector('h4')?.textContent, 'Policy');
  assert.equal(reader.querySelector('strong')?.textContent, 'original');
  assert.equal(reader.querySelector('code')?.textContent, 'code');
  assert.equal(reader.querySelectorAll('li').length, 2);
  assert.equal(reader.querySelector('td')?.textContent, 'Account');
  assert.equal(reader.querySelector('a')?.getAttribute('href'), 'mailto:legal@thermus.ai');
  assert.equal(page.querySelectorAll('script, iframe, object').length, 0);
  assert.match(reader.textContent, /<script>alert\("no"\)<\/script>/);
  assert.equal([...page.querySelectorAll('a')].some((link) => /javascript:/i.test(link.getAttribute('href') ?? '')), false);
});

test('Given a signup document, when desktop and mobile readers are built, then keyboard regions and closed native disclosures expose the full original document without a reading gate', async () => {
  const response = signupCreateAccountPage(documents, accountPaths);
  const page = parseHTML(await response.text()).document;
  const desktop = page.querySelector('.document-reader');
  assert.ok(desktop);
  assert.equal(desktop.getAttribute('role'), 'region');
  assert.equal(desktop.getAttribute('tabindex'), '0');
  assert.equal(desktop.textContent.trim(), 'Notice\nOriginal notice.');
  assert.equal(page.querySelector('.document-excerpt')?.textContent, 'Original notice.');
  const disclosure = page.querySelector('details');
  assert.ok(disclosure);
  assert.equal(disclosure.hasAttribute('open'), false);
  assert.match(disclosure.querySelector('summary')?.textContent ?? '', /Read full privacy notice/);
  assert.match(disclosure.querySelector('summary')?.textContent ?? '', /Hide privacy notice/);
  const fullDocument = disclosure.querySelector('.document-text');
  assert.ok(fullDocument);
  assert.equal(fullDocument.textContent.trim(), desktop.textContent.trim());
  const ids = [...page.querySelectorAll('[id]')].map((element) => element.id);
  assert.equal(ids.length, new Set(ids).size);
  const css = page.querySelector('style')?.textContent ?? '';
  const policy = response.headers.get('Content-Security-Policy') ?? '';
  assert.ok(policy.includes(`style-src 'sha256-${createHash('sha256').update(css).digest('base64')}'`));
  assert.match(policy, /default-src 'none'/);
  assert.match(policy, /img-src 'self'/);
  assert.match(policy, /font-src 'self'/);
  assert.match(policy, /form-action 'self'/);
  assert.doesNotMatch(policy, /unsafe-inline|unsafe-eval/);
  assert.equal(page.querySelectorAll('script').length, 0);
  assert.equal(page.querySelectorAll('form').length, 1);
});

test('Given step 1, when it is rendered, then one form posts the email address to the account creation path without a CSRF token, before the free-access and sign-in lines', async () => {
  const response = signupCreateAccountPage(documents, accountPaths);
  const html = await response.text();
  const page = parseHTML(html).document;

  assert.equal(response.status, 200);
  const form = page.querySelector('.task-card form');
  assert.ok(form);
  assert.equal(form.getAttribute('method'), 'post');
  assert.equal(form.getAttribute('action'), '/signup/start');
  assert.deepEqual([...form.querySelectorAll('input')].map((input) => input.getAttribute('name')), ['email']);
  const email = form.querySelector('input[name="email"]');
  assert.ok(email);
  assert.equal(email.getAttribute('type'), 'email');
  assert.equal(email.getAttribute('autocomplete'), 'email');
  assert.equal(email.getAttribute('maxlength'), '254');
  assert.equal(email.hasAttribute('required'), true);
  assert.equal(email.hasAttribute('value'), false);
  assert.equal(page.querySelector(`label[for="${email.id}"]`)?.textContent, 'Email address');
  assert.equal(form.querySelector('button[type="submit"]')?.textContent, 'Create account');
  assert.equal(page.querySelector('.form-message'), null);
  assert.ok(html.indexOf('</form>') < html.indexOf('Free access requires no card'));
  assert.ok(html.indexOf('Free access requires no card') < html.indexOf('Already have a Thermus account?'));
  assert.equal(page.querySelector('.task-card a[href="/login"]')?.textContent, 'Sign in');
  assert.match(response.headers.get('Content-Security-Policy') ?? '', /form-action 'self'/);
});

test('Given the origins of the provider sign-in, when step 1 is rendered, then its policy lets the form post here and redirect to those origins', async () => {
  const response = signupCreateAccountPage(documents, { ...accountPaths, providerOrigins: ['https://api.workos.com', 'https://auth.example.com'] });
  const policy = response.headers.get('Content-Security-Policy') ?? '';

  assert.ok(policy.includes("form-action 'self' https://api.workos.com https://auth.example.com;"), policy);
  assert.equal((policy.match(/form-action /g) ?? []).length, 1);
  assert.match(policy, /default-src 'none'/);
});

test('Given an email address that is not valid, when step 1 answers, then an alert next to the field asks for a valid address and the field keeps the typed text, escaped', async () => {
  const typed = '"><script>alert(1)</script>';
  const response = signupCreateAccountPage(documents, accountPaths, { status: 400, message: 'invalid-email', email: typed });
  const html = await response.text();
  const page = parseHTML(html).document;

  assert.equal(response.status, 400);
  const message = page.querySelector('form .form-message');
  assert.ok(message);
  assert.equal(message.getAttribute('role'), 'alert');
  assert.equal(message.textContent, 'Enter a valid email address.');
  const email = page.querySelector('input[name="email"]');
  assert.equal(email?.getAttribute('value'), typed);
  assert.equal(email?.getAttribute('aria-describedby'), message.id);
  assert.ok(html.includes('value="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"'));
  assert.equal(page.querySelectorAll('script').length, 0);
});

test('Given an email address that has an account, when step 1 answers, then an alert says that the account exists with a Sign in link to the sign-in path, and the field keeps the email', async () => {
  const response = signupCreateAccountPage(documents, { creation: '/app/signup/start', signIn: '/app/login' }, { status: 409, message: 'existing-account', email: 'person@example.com' });
  const page = parseHTML(await response.text()).document;

  assert.equal(response.status, 409);
  const message = page.querySelector('form .form-message');
  assert.ok(message);
  assert.equal(message.getAttribute('role'), 'alert');
  assert.equal(message.textContent, 'An account with this email address already exists. Sign in to open your workspace.');
  assert.equal(message.querySelector('a')?.getAttribute('href'), '/app/login');
  assert.equal(message.querySelector('a')?.textContent, 'Sign in');
  assert.equal(page.querySelector('form')?.getAttribute('action'), '/app/signup/start');
  assert.equal(page.querySelector('input[name="email"]')?.getAttribute('value'), 'person@example.com');
});

test('Given the creation page, when it is rendered, then an editable name and one unchecked authority agreement stay outside the document disclosures', async () => {
  const page = parseHTML(await signupFormPage(documents, 'csrf<&', '/signup').text()).document;
  const form = page.querySelector('form');
  assert.equal(form?.getAttribute('method'), 'post');
  assert.equal(form?.getAttribute('action'), '/signup');
  assert.deepEqual([...page.querySelectorAll('input')].map((input) => [input.getAttribute('name'), input.getAttribute('value')]), [
    ['csrf_token', 'csrf<&'], ['document_version', 'bundle-v1'], ['organization_name', null], ['agreement', 'accepted'],
  ]);
  const name = page.querySelector('input[name="organization_name"]');
  assert.ok(name);
  assert.equal(name.getAttribute('type'), 'text');
  assert.equal(name.getAttribute('maxlength'), '100');
  assert.equal(name.getAttribute('autocomplete'), 'organization');
  assert.equal(name.hasAttribute('required'), true);
  assert.equal(name.hasAttribute('readonly'), false);
  assert.equal(name.closest('details'), null);
  assert.equal(page.querySelector(`label[for="${name.id}"]`)?.textContent, 'Organization name');
  assert.equal(page.querySelectorAll('input[type="checkbox"]').length, 1);
  const agreement = page.querySelector('input[type="checkbox"]');
  assert.ok(agreement);
  assert.equal(agreement.hasAttribute('required'), true);
  assert.equal(agreement.hasAttribute('checked'), false);
  assert.equal(agreement.closest('details'), null);
  assert.equal(page.querySelector('.agreement-text')?.textContent, documents.agreement.text);
  assert.equal(page.querySelector('button[type="submit"]')?.textContent, 'Create organization');
  assert.equal(page.querySelector('button[type="submit"]')?.hasAttribute('disabled'), false);
});

test('Given closed, existing-access and failed signup states, when shown, then each branded notice keeps its status and offers a safe recovery action', async () => {
  const cases = [
    { response: signupClosedPage(403), status: 403, link: '/login', label: 'Sign in' },
    { response: signupContinuePage('/organizations?return_to=%2F'), status: 200, link: '/organizations?return_to=%2F', label: 'Continue' },
    { response: signupFailurePage(409, 'Contact support.', '/organizations?return_to=%2F'), status: 409, link: 'mailto:legal@thermus.ai', label: 'Contact' },
    { response: signupFailurePage(503, 'Try again later.'), status: 503, link: '/signup', label: 'Open signup again' },
    { response: signupFailurePage(401, 'Sign in before activation.'), status: 401, link: '/login?return_to=%2Fsignup', label: 'Sign in again' },
  ];
  for (const { response, status, link, label } of cases) {
    const page = parseHTML(await response.text()).document;
    assert.equal(response.status, status);
    assert.equal(page.querySelector('header img')?.getAttribute('src'), '/assets/thermus-logo.svg');
    const recovery = [...page.querySelectorAll('a')].find((anchor) => anchor.textContent === label);
    assert.equal(recovery?.getAttribute('href'), link);
    assert.equal(page.querySelectorAll('form').length, 0);
  }
});

test('Given an account whose organization exists, when the continue notice renders, then it says each account can create one organization and offers Continue', async () => {
  const response = signupContinuePage('/organizations?return_to=%2F');
  const page = parseHTML(await response.text()).document;

  assert.equal(response.status, 200);
  assert.equal(page.querySelector('title')?.textContent, 'Your organization exists · Thermus');
  assert.equal(page.querySelector('h1')?.textContent, 'Your organization exists');
  assert.equal(page.querySelector('.notice-message')?.textContent, 'Each Thermus account can create one organization through free access. This account already created its organization. Continue to open it.');
  assert.deepEqual([...page.querySelectorAll('.task-card a')].map((anchor) => [anchor.textContent, anchor.getAttribute('href')]), [['Continue', '/organizations?return_to=%2F']]);
  assert.equal(page.querySelectorAll('form, input').length, 0);
});
