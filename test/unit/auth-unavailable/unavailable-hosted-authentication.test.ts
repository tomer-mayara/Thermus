import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { AuthenticatedUser } from '../../../src/auth/access-context.ts';
import { UnavailableHostedAuthentication } from '../../../src/auth-unavailable/unavailable-hosted-authentication.ts';
import { setProcessEnvironment } from '../../support/process-environment.ts';

const publicBaseUrl = 'https://magumagu.example/';
const forgedSession = 'wos-session=Fe26.2*forged-sealed-session; better-auth.session_token=forged-local-session';

function forgedRequests(): Request[] {
  const form = { 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'https://magumagu.example', Cookie: forgedSession };
  return [
    new Request(publicBaseUrl),
    new Request(new URL('account', publicBaseUrl), { headers: { Cookie: forgedSession } }),
    new Request(new URL('account', publicBaseUrl), { headers: { Authorization: 'Bearer forged-connect-token' } }),
    new Request(new URL('organizations?organizationId=org_01FORGED', publicBaseUrl), { headers: { Cookie: forgedSession, 'X-Organization-Id': 'org_01FORGED' } }),
    new Request(new URL('organizations/select', publicBaseUrl), { method: 'POST', headers: form, body: 'organizationId=org_01FORGED' }),
    new Request(new URL('billing/seats', publicBaseUrl), { method: 'POST', headers: form, body: 'organizationId=org_01FORGED&seatCount=5' }),
    new Request(new URL('auth/callback?code=forged-code&state=forged-state', publicBaseUrl), { headers: { Cookie: forgedSession } }),
  ];
}

const anyUsers: readonly AuthenticatedUser[] = [
  { authority: 'workos:client_placeholder', subject: 'user_01FORGED', selectedOrganizationId: 'org_01FORGED' },
  { authority: 'workos:client_placeholder', subject: 'user_01FORGED' },
  { authority: 'better-auth:local-installation', subject: 'local-user' },
];

async function assertNothingIssued(authentication: UnavailableHostedAuthentication): Promise<void> {
  for (const request of forgedRequests()) {
    assert.deepEqual(await authentication.authenticate(request), { status: 'unavailable' });
    assert.equal(request.bodyUsed, false);
  }
  for (const user of anyUsers) {
    assert.deepEqual(await authentication.resolve(user), { allowed: false, reason: 'account-inactive' });
  }
}

describe('UnavailableHostedAuthentication', () => {
  test('Given any browser request, also with a forged session cookie, bearer token, organization ID, or form input, when its session is authenticated, then hosted authentication is unavailable, no user is given, and the request body stays unread', async () => {
    const authentication = new UnavailableHostedAuthentication();
    const requests = forgedRequests();

    const states = await Promise.all(requests.map((request) => authentication.authenticate(request)));

    assert.deepEqual(states, requests.map(() => ({ status: 'unavailable' })));
    assert.deepEqual(requests.map(({ bodyUsed }) => bodyUsed), requests.map(() => false));
  });

  test('Given any user, also one with a selected organization, when access is resolved, then access is denied and no context, tenant, or grant is given', async () => {
    const authentication = new UnavailableHostedAuthentication();

    const decisions = await Promise.all(anyUsers.map((user) => authentication.resolve(user)));

    assert.deepEqual(decisions, anyUsers.map(() => ({ allowed: false, reason: 'account-inactive' })));
  });

  test('Given a value for each WorkOS setting in the process environment, when the placeholder authenticates and resolves, then it still issues no identity and no grant', async (t) => {
    setProcessEnvironment(t, {
      WORKOS_AUTHKIT_ISSUER: 'https://magumagu-test.authkit.app',
      WORKOS_CLIENT_ID: 'client_placeholder',
      WORKOS_API_KEY: 'workos-api-key-placeholder',
      WORKOS_REDIRECT_URI: 'https://magumagu.example/auth/callback',
      WORKOS_COOKIE_PASSWORD: 'cookie-password-placeholder-0032',
    });

    await assertNothingIssued(new UnavailableHostedAuthentication());
  });
});
