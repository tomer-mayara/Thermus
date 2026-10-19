import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { organizationSelectionPage } from '../../../src/hosted-admin/account-pages.ts';
import { formsIn } from '../../support/drivers/browser/hosted-browser.ts';

test('Given a selected organization and a long organization name, when the selector renders, then the current choice is named in text and semantics and each complete name stays on a submit button', async () => {
  const longName = 'Research & development '.repeat(18);
  const response = organizationSelectionPage({ action: '/team/organizations/select', csrfToken: 'csrf', returnTo: '/team/', organizations: [
    { organizationId: 'org-a', organizationName: 'Personal workspace', selected: true },
    { organizationId: 'org-b', organizationName: longName, selected: false },
  ] });
  const body = await response.text();
  const document = parseHTML(body).document;
  const current = document.querySelector('li[aria-current="true"]');
  assert.equal(current?.querySelector('button')?.textContent, 'Personal workspace (selected)');
  assert.equal(document.querySelectorAll('[aria-current]').length, 1);
  assert.deepEqual([...document.querySelectorAll('button')].map((button) => [button.getAttribute('type'), button.hasAttribute('disabled')]), [['submit', false], ['submit', false]]);
  assert.deepEqual(formsIn(body).map(({ label }) => label), ['Personal workspace (selected)', longName]);
  assert.equal(document.querySelector('main')?.getAttribute('id'), 'main-content');
  assert.equal(document.querySelector('.skip-link')?.getAttribute('href'), '#main-content');
  assert.equal(document.querySelector('h1')?.textContent, 'Select an organization');
});

test('Given provider and form values with markup, when the selector renders, then they stay text and exact hidden field values without executable markup', async () => {
  const values = { action: '/team/organizations/select?from="<&', csrfToken: '"><script>alert(1)</script>', returnTo: '/team/<account>&"' };
  const organization = { organizationId: 'org-"><img src=x onerror=alert(1)>', organizationName: '<b>Research & "Design"</b>', selected: false };
  const body = await organizationSelectionPage({ ...values, organizations: [organization] }).text();
  const document = parseHTML(body).document;
  assert.equal(document.querySelectorAll('script, b, [onerror]').length, 0);
  assert.equal(document.querySelectorAll('img').length, 1);
  assert.deepEqual(formsIn(body), [{ action: values.action, label: organization.organizationName,
    fields: { csrf_token: values.csrfToken, organization_id: organization.organizationId, return_to: values.returnTo } }]);
  assert.equal(document.querySelectorAll('[aria-current]').length, 0);
});
