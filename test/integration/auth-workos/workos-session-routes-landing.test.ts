import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AccessDecision } from '../../../src/accounts/identity/access-context.ts';
import { AccessResolverSpy } from '../../support/doubles/auth/access-resolver-spy.ts';
import { assertRedirect, browserRequest, clearedSignInCookie, publicBaseUrl, serve, SessionDouble, sessionCookie, signedInState } from './fixtures/session-routes-fixtures.ts';

const selectedUser = signedInState().user;
const cookies = [clearedSignInCookie, sessionCookie];
const selector = 'https://thermus.example/team/organizations?return_to=%2Fteam%2F';
const allowed: AccessDecision = {
  allowed: true,
  context: { user: selectedUser, tenantId: 'tenant-acme', organizationId: selectedUser.selectedOrganizationId, grants: [], permissions: ['product:access'] },
};

test('Given no sealed return destination and no trusted selected organization, when a callback includes forged organization and email hints, then the selector opens without an access lookup', async () => {
  const session = new SessionDouble();
  session.completion = { status: 'signed-in', user: { authority: selectedUser.authority, subject: selectedUser.subject }, cookies };
  const resolver = new AccessResolverSpy();
  const { routes } = serve(session, publicBaseUrl, resolver);

  assertRedirect(await routes.handle(browserRequest('/team/callback?code=code&state=state&organization_id=org_FORGED&email=forged@example.com')), selector, cookies);

  assert.deepEqual(resolver.calls, []);
});

test('Given a trusted selected organization with current product access and no return destination, when the callback completes, then the portal opens for that selection', async () => {
  const session = new SessionDouble();
  session.completion = { status: 'signed-in', user: selectedUser, cookies };
  const resolver = new AccessResolverSpy(new Map([[selectedUser.subject, allowed]]));
  const { routes } = serve(session, publicBaseUrl, resolver);

  assertRedirect(await routes.handle(browserRequest('/team/callback?code=code&state=state')), publicBaseUrl, cookies);

  assert.deepEqual(resolver.calls, [selectedUser]);
});

test('Given a selected organization without current product access or with a mismatched resolver organization, when its default callback completes, then the selector opens with the completed sign-in cookies', async () => {
  const decisions: AccessDecision[] = [
    { allowed: false, reason: 'membership-inactive' },
    { allowed: true, context: { ...allowed.context, permissions: [] } },
    { allowed: true, context: { ...allowed.context, organizationId: 'org_OTHER' } },
  ];
  for (const decision of decisions) {
    const session = new SessionDouble();
    session.completion = { status: 'signed-in', user: selectedUser, cookies };
    const { routes } = serve(session, publicBaseUrl, new AccessResolverSpy(new Map([[selectedUser.subject, decision]])));

    assertRedirect(await routes.handle(browserRequest('/team/callback?code=code&state=state')), selector, cookies);
  }
});

test('Given a current membership lookup outage after a completed sign-in, when landing is resolved, then the signed-in recovery keeps the new cookies and links to the selector instead of replaying the code', async () => {
  const outage = new Error('private directory details');
  const session = new SessionDouble();
  session.completion = { status: 'signed-in', user: selectedUser, cookies };
  const { routes, failures } = serve(session, publicBaseUrl, new AccessResolverSpy(new Map([[selectedUser.subject, outage]])));

  const response = await routes.handle(browserRequest('/team/callback?code=secret-code&state=state'));

  assert.equal(response.status, 500);
  assert.deepEqual(response.headers.getSetCookie(), cookies);
  const body = await response.text();
  assert.match(body, /href="\/team\/organizations\?return_to=%2Fteam%2F"/);
  assert.doesNotMatch(body, /secret-code|private directory details|Sign in again|You are not signed in/);
  assert.deepEqual(failures, [{ path: '/team/callback', cause: outage }]);
});

test('Given an explicit safe root or page destination, when sign-in completes without a selected organization, then landing preserves the destination without another access lookup', async () => {
  for (const returnTo of ['/team/', '/team/members']) {
    const session = new SessionDouble();
    session.completion = { status: 'signed-in', user: { authority: selectedUser.authority, subject: selectedUser.subject }, returnTo, cookies };
    const resolver = new AccessResolverSpy(new Map([[selectedUser.subject, new Error('must not read')]]));
    const { routes } = serve(session, publicBaseUrl, resolver);

    assertRedirect(await routes.handle(browserRequest('/team/callback?code=code&state=state')), `https://thermus.example${returnTo}`, cookies);
    assert.deepEqual(resolver.calls, []);
  }
});
