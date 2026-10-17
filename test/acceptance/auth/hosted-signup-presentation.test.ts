import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { approvedSignupDocuments } from '../../../src/auth/hosted-auth/workos/workos-approved-signup-documents.ts';
import { signInThroughServer } from '../../support/dsl/workos-sign-in.ts';
import { HostedBrowser, formsIn } from '../../support/drivers/browser/hosted-browser.ts';
import { hostedRootConfig } from '../../support/fixtures/hosted-config.ts';
import { serveWorkOSSite } from '../../support/in-process/workos-site.ts';

test('Given a new visitor, when free signup opens, then the branded two-step page offers the complete readable notice before sign-in and a compact mobile disclosure', async (t) => {
  const site = await serveWorkOSSite(t, { config: hostedRootConfig, organizations: [], signupFake: true,
    signup: { enabled: true, documents: approvedSignupDocuments } });
  const answer = await new HostedBrowser(site.transport, site.publicBaseUrl).open('signup');
  const document = parseHTML(answer.body).document;

  assert.equal(answer.status, 200);
  assert.equal(document.querySelector('h1')?.textContent, 'Start free access.');
  assert.equal(document.querySelector('.task-card h2')?.textContent, 'Sign in to continue');
  assert.equal(document.querySelector('header img')?.getAttribute('src'), '/assets/thermus-logo.svg');
  assert.equal(document.querySelector('[aria-current="step"]')?.textContent?.includes('Sign in'), true);
  const reader = document.querySelector('#privacy-notice .document-reader');
  assert.ok(reader);
  assert.equal(reader.getAttribute('tabindex'), '0');
  assert.equal(reader.getAttribute('role'), 'region');
  assert.ok(reader.querySelector('table'), 'The full notice includes readable retention and cookie tables.');
  assert.match(reader.textContent, /10\. Changes and contact/);
  const disclosure = document.querySelector('#privacy-notice details');
  assert.ok(disclosure);
  assert.equal(disclosure.hasAttribute('open'), false);
  assert.match(disclosure.querySelector('summary')?.textContent ?? '', /Read full privacy notice/);
  const action = document.querySelector('.task-card .primary-action');
  assert.ok(action);
  assert.equal(action.textContent, 'Sign in to continue');
  assert.equal(action.getAttribute('href'), '/login?return_to=%2Fsignup');
  assert.deepEqual(formsIn(answer.body), []);
  assert.deepEqual(site.signupFake.organizations, []);
});

test('Given an eligible identity, when activation opens, then both full documents precede the exact unchecked agreement and only the existing activation fields are submitted', async (t) => {
  const site = await serveWorkOSSite(t, { config: hostedRootConfig, organizations: [], signupFake: true,
    signup: { enabled: true, documents: approvedSignupDocuments } });
  const user = { id: 'user_PRESENTATION', email: 'person@example.com', firstName: 'Person', emailVerified: true };
  site.world.users = [user];
  const { browser } = await signInThroughServer(site, user);
  const answer = await browser.open('signup');
  const document = parseHTML(answer.body).document;

  assert.equal(answer.status, 200);
  assert.equal(document.querySelector('h1')?.textContent, 'One step to your workspace.');
  assert.equal(document.querySelector('.task-card h2')?.textContent, 'Activate free access');
  assert.equal(document.querySelectorAll('.document-reader[tabindex="0"]').length, 2);
  assert.match(document.querySelector('#terms .document-reader')?.textContent ?? '', /12\. About these terms/);
  assert.match(document.querySelector('#privacy-notice .document-reader')?.textContent ?? '', /10\. Changes and contact/);
  const checkbox = document.querySelector('input[name="agreement"]');
  assert.ok(checkbox);
  assert.equal(checkbox.hasAttribute('checked'), false);
  assert.equal(checkbox.hasAttribute('required'), true);
  assert.equal(document.querySelector('.agreement-text')?.textContent, approvedSignupDocuments.agreement.text);
  assert.equal(checkbox.closest('details'), null);
  const form = formsIn(answer.body).find(({ action }) => action === '/signup');
  assert.ok(form);
  assert.deepEqual(Object.keys(form.fields).sort(), ['csrf_token', 'document_version']);
  assert.equal(document.querySelectorAll('input').length, 3);
  const accepted = await browser.post('signup', { ...form.fields, agreement: 'accepted' });
  assert.equal(accepted.status, 303);
  assert.equal(accepted.location?.pathname, '/organizations');
  assert.equal(accepted.location?.searchParams.get('return_to'), '/');
});
