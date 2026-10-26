import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { parseHTML } from 'linkedom';
import { loggingPage } from '../../../src/interfaces/web/account/logging-page.ts';
import { membersPageLayout } from '../../../src/interfaces/web/account/members-page-layout.ts';

const navigation = { product: '/', members: '/members', organizations: '/organizations', logging: '/logging' };
const settings = { revision: 'r1', endpoint: 'https://collector.example/v1/logs', auth: 'bearer' as const, enabled: false, tokenPresent: true };
function render(axiomDataset?: string) {
  return loggingPage({ settings: { ...settings, ...(axiomDataset === undefined ? {} : { axiomDataset }) }, navigation, tenantId: 'tenant:a', csrfToken: 'csrf', action: '/logging/save', testAction: '/logging/test' });
}

test('Given saved destination settings, when the page opens, then only a nonempty dataset selects Axiom and the token stays blank', async () => {
  for (const dataset of [undefined, '', 'audit-log-test']) {
    const { document } = parseHTML(await render(dataset).text());
    assert.equal(document.querySelector('input[name="destination"][checked]')?.getAttribute('value'), dataset ? 'axiom' : 'custom');
    assert.equal(document.querySelector('input[name="token"]')?.getAttribute('value'), '');
    assert.equal(document.querySelector('input[name="auth"]')?.getAttribute('type'), 'hidden');
    assert.equal(document.querySelector('input[name="auth"]')?.getAttribute('value'), 'bearer');
  }
});

test('Given editable destination settings, when the user switches Axiom and Custom, then only Axiom submits a required dataset and all edits survive', async () => {
  const { document, window } = parseHTML(await render('audit-log-test').text());
  const script = document.querySelector('script')?.textContent;
  assert.ok(script);
  runInNewContext(script, { document });
  const dataset = document.querySelector('input[name="axiom_dataset"]')!;
  const group = document.querySelector('#logging-axiom-fields')!;
  const endpoint = document.querySelector('input[name="endpoint"]')!;
  const token = document.querySelector('input[name="token"]')!;
  endpoint.setAttribute('value', 'https://edited.example/v1/logs'); token.setAttribute('value', 'unsaved-token');
  const axiom = document.querySelector('input[value="axiom"]')!;
  const custom = document.querySelector('input[value="custom"]')!;
  for (const chooseAxiom of [false, true, false]) {
    axiom.toggleAttribute('checked', chooseAxiom); custom.toggleAttribute('checked', !chooseAxiom);
    custom.dispatchEvent(new window.Event('change', { bubbles: true }));
    assert.equal(group.hasAttribute('hidden'), !chooseAxiom);
    assert.equal(dataset.hasAttribute('disabled'), !chooseAxiom);
    assert.equal(dataset.hasAttribute('required'), chooseAxiom);
    assert.equal(dataset.getAttribute('value'), 'audit-log-test');
    assert.equal(endpoint.getAttribute('value'), 'https://edited.example/v1/logs');
    assert.equal(token.getAttribute('value'), 'unsaved-token');
  }
});

test('Given the destination script, when the page sets CSP, then only its hash permits execution and Members keeps scripts blocked', async () => {
  const response = render();
  const { document } = parseHTML(await response.text());
  const script = document.querySelector('script')?.textContent;
  assert.ok(script);
  const csp = response.headers.get('Content-Security-Policy')!;
  assert.ok(csp.includes(`script-src 'sha256-${createHash('sha256').update(script).digest('base64')}'`));
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
  assert.doesNotMatch(membersPageLayout(navigation, '').headers.get('Content-Security-Policy')!, /script-src/);
});

test('Given a browser without scripts, when the destination form opens, then the dataset remains editable with Custom instructions', async () => {
  const { document } = parseHTML(await render().text());
  assert.equal(document.querySelector('#logging-axiom-fields')?.hasAttribute('hidden'), false);
  assert.equal(document.querySelector('input[name="axiom_dataset"]')?.hasAttribute('disabled'), false);
  assert.match(document.querySelector('noscript')?.textContent ?? '', /For Custom, clear the Axiom dataset/);
});

test('Given unavailable settings, when Audit logs renders, then full native help remains outside any form without adding a script', async () => {
  const response = loggingPage({ navigation, tenantId: 'tenant:a', csrfToken: 'csrf', action: '/logging/save', testAction: '/logging/test' });
  const { document } = parseHTML(await response.text());
  const help = document.querySelector('details[data-help="audit"]');
  assert.ok(help);
  assert.equal(help.hasAttribute('open'), false);
  assert.equal(help.closest('form'), null);
  assert.match(help.textContent ?? '', /A pending Save can finish after that read/);
  assert.match(help.textContent ?? '', /synthetic Test events can include the actor’s display name/);
  assert.equal(help.querySelectorAll('script, form, input').length, 0);
  assert.equal(document.querySelectorAll('script').length, 1);
  assert.equal(document.querySelectorAll('form').length, 0);
});
