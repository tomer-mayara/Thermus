import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { organizationSelectionPage } from '../../../src/interfaces/web/account/account-pages.ts';
import { formsIn } from '../../support/drivers/browser/hosted-browser.ts';

const selector = { action: '/team/organizations/select', product: '/team/', csrfToken: 'csrf', returnTo: '/team/', organizations: [
  { organizationId: 'org-a', organizationName: 'Acme', selected: true },
  { organizationId: 'org-b', organizationName: 'Globex', selected: false },
] };

function createLinksIn(document: ReturnType<typeof parseHTML>['document']) {
  return [...document.querySelectorAll('a')].filter((link) => link.textContent === 'Create an organization');
}

// The notes of the organization card that come after the list.
function cardNotesIn(document: ReturnType<typeof parseHTML>['document']) {
  return [...document.querySelectorAll('section[aria-labelledby="organizations-heading"] ul ~ p')];
}

test('Given a selected organization and a long organization name, when the selector renders, then the current choice is named in text and semantics and each complete name stays on a submit button', async () => {
  const longName = 'Research & development '.repeat(18);
  const response = organizationSelectionPage({ action: '/team/organizations/select', product: '/team/', csrfToken: 'csrf', returnTo: '/team/', organizations: [
    { organizationId: 'org-a', organizationName: 'Personal workspace', selected: true },
    { organizationId: 'org-b', organizationName: longName, selected: false },
  ] });
  const body = await response.text();
  const document = parseHTML(body).document;
  const current = document.querySelector('li[aria-current="true"]');
  assert.equal(current?.querySelector('button')?.textContent, 'Personal workspace (selected)');
  assert.equal(document.querySelectorAll('li[aria-current]').length, 1);
  assert.equal(document.querySelector('nav [aria-current="page"]')?.textContent, 'Switch Workspace');
  assert.deepEqual([...document.querySelectorAll('button')].map((button) => [button.getAttribute('type'), button.hasAttribute('disabled')]), [['submit', false], ['submit', false]]);
  assert.deepEqual(formsIn(body).map(({ label }) => label), ['Personal workspace (selected)', longName]);
  assert.equal(document.querySelector('main')?.getAttribute('id'), 'main-content');
  assert.equal(document.querySelector('.skip-link')?.getAttribute('href'), '#main-content');
  assert.equal(document.querySelector('h1')?.textContent, 'Select an organization');
});

test('Given provider, form, and signup values with markup, when the selector renders, then they stay text, exact hidden field values, and an exact link address without executable markup', async () => {
  const values = { action: '/team/organizations/select?from="<&', product: '/team/', csrfToken: '"><script>alert(1)</script>', returnTo: '/team/<account>&"', signupUrl: 'https://thermus.example/team/signup?from="><script>alert(2)</script>&next=<b>' };
  const organization = { organizationId: 'org-"><img src=x onerror=alert(1)>', organizationName: '<b>Research & "Design"</b>', selected: false };
  const body = await organizationSelectionPage({ ...values, organizations: [organization] }).text();
  const document = parseHTML(body).document;
  assert.equal(document.querySelectorAll('script, b, [onerror]').length, 0);
  assert.equal(document.querySelectorAll('img').length, 1);
  assert.deepEqual(formsIn(body), [{ action: values.action, label: organization.organizationName,
    fields: { csrf_token: values.csrfToken, organization_id: organization.organizationId, return_to: values.returnTo } }]);
  assert.equal(document.querySelectorAll('li[aria-current]').length, 0);
  assert.equal(createLinksIn(document)[0]?.getAttribute('href'), values.signupUrl);
});

test('Given a signup URL, when the selector renders, then a Create an organization link outside the header menu opens that URL', async () => {
  const signupUrl = 'https://thermus.example/team/signup';
  const document = parseHTML(await organizationSelectionPage({ ...selector, signupUrl }).text()).document;
  const createLinks = createLinksIn(document);
  assert.deepEqual(createLinks.map((link) => link.getAttribute('href')), [signupUrl]);
  assert.equal(createLinks[0]?.closest('nav'), null);
  const notes = cardNotesIn(document);
  assert.deepEqual(notes.map((note) => note.textContent), ['Your choice applies to this browser.', 'Each account can create one organization. Create an organization.']);
  assert.equal(notes[1]?.querySelector('a'), createLinks[0]);
  assert.deepEqual([...document.querySelectorAll('nav a')].map((link) => link.textContent), ['Connect', 'Switch Workspace']);
});

test('Given no signup URL, when the selector renders, then it has no Create an organization link', async () => {
  const body = await organizationSelectionPage(selector).text();
  const document = parseHTML(body).document;
  assert.deepEqual(createLinksIn(document), []);
  assert.doesNotMatch(body, /Each account can create one organization/);
  assert.deepEqual(cardNotesIn(document).map((note) => note.textContent), ['Your choice applies to this browser.']);
});
