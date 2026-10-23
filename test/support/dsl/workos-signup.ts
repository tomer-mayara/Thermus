import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { HostedBrowser, formsIn } from '../drivers/browser/hosted-browser.ts';
import { serveWorkOSSite, type WorkOSSite } from '../in-process/workos-site.ts';
import { hostedRootConfig } from '../fixtures/hosted-config.ts';
import { signupDocuments } from '../fixtures/signup-documents.ts';
import { signInThroughServer } from './workos-sign-in.ts';

const signup = { enabled: true, documents: signupDocuments };

export async function beginOrganizationSignup(t: TestContext) {
  const site = await serveWorkOSSite(t, { config: hostedRootConfig, organizations: [], signupFake: true, signup });
  const user = { id: 'user_RECOVERY', email: 'person@example.com', firstName: 'Person', emailVerified: true };
  site.world.users = [user];
  const { browser } = await signInThroughServer(site, user);
  const form = formsIn((await browser.open('signup')).body).find(({ action }) => action === '/signup');
  assert.ok(form);
  return { site, user, browser, fields: { ...form.fields, organization_name: 'Acme Labs', agreement: 'accepted' } };
}

export async function restartOrganizationSignup(t: TestContext, prior: WorkOSSite, browser: HostedBrowser) {
  await prior.close();
  const site = await serveWorkOSSite(t, { config: hostedRootConfig, organizations: [], world: prior.world, signup });
  return { site, browser: new HostedBrowser(site.transport, site.publicBaseUrl, browser.cookieHeader) };
}

export function signupWrites(site: WorkOSSite) {
  return site.world.fake.takeRequests().filter(({ method, path }) => method !== 'GET' && path !== '/user_management/authenticate');
}
