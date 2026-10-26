import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { GenericServerException, UnauthorizedException } from '@workos-inc/node';
import type { SealRefresh } from '../../../src/accounts/providers/workos/workos-session-client.ts';
import {
  ada,
  authority,
  browserSession,
  clearedSessionCookie,
  cookieHeader,
  envelope,
  joseError,
  oauthError,
  refreshedTo,
  retryableFailure,
  sealOptions,
  sessionCookieHeader,
  sessionEnvelopeIn,
  settings,
  signedIn,
  terminalRefusal,
  WorkOSSessionClientDouble,
} from './fixtures/workos-session-client-double.ts';

describe('WorkOSBrowserSession: the refresh of a session check', () => {
  test('Given an access token that does not verify (invalid_jwt), when the session authenticates, then one refresh in the organization of the session decides, and the signed-in result has one new session cookie with the new seal, the same CSRF token, and no MFA evidence', async () => {
    for (const mfa of [true, false]) {
      const client = new WorkOSSessionClientDouble();
      client.check = () => ({ authenticated: false, reason: 'invalid_jwt' });
      client.refresh = () => ({ authenticated: true, sealedSession: 'seal-2', user: { ...ada, email: 'ada@new.example' }, organizationId: 'org_01ACME' });

      const session = signedIn(await browserSession(client).authenticate(sessionCookieHeader({ ...envelope, mfa })));

      assert.deepEqual(client.calls, [{ method: 'authenticate', input: sealOptions }, { method: 'refresh', input: sealOptions }]);
      assert.equal(session.cookies.length, 1);
      assert.deepEqual(sessionEnvelopeIn(session.cookies[0]), { seal: 'seal-2', csrf: envelope.csrf, mfa: false });
      assert.deepEqual(
        [session.user, session.profile.email, session.csrfToken, session.mfaCompleted],
        [{ authority, subject: ada.id, selectedOrganizationId: 'org_01ACME' }, 'ada@new.example', envelope.csrf, false],
      );
    }
  });

  test('Given an access token signed with a key that the cached key set does not have yet, when the session authenticates, then the SDK error ERR_JWKS_NO_MATCHING_KEY leads to one refresh, and the session is signed in with the new seal', async () => {
    const client = new WorkOSSessionClientDouble();
    client.check = () => joseError('JWKSNoMatchingKey', 'ERR_JWKS_NO_MATCHING_KEY');

    const session = signedIn(await browserSession(client).authenticate(cookieHeader));

    assert.deepEqual(client.methods(), ['authenticate', 'refresh']);
    assert.equal(sessionEnvelopeIn(session.cookies[0])?.seal, 'seal-2');
  });


  test('Given a refresh that WorkOS refuses for good (invalid_grant, mfa_enrollment, sso_required, or invalid_session_cookie), when the session authenticates, then it is signed out with the cleared cookie', async () => {
    for (const reason of ['invalid_grant', 'mfa_enrollment', 'sso_required', 'invalid_session_cookie']) {
      const client = new WorkOSSessionClientDouble();
      client.check = () => ({ authenticated: false, reason: 'invalid_jwt' });
      client.refresh = () => terminalRefusal(reason);

      assert.deepEqual(await browserSession(client).authenticate(cookieHeader), { status: 'signed-out', cookies: [clearedSessionCookie] }, reason);
    }
  });

  test('Given a refresh that fails for a time (server_error, rate_limit_exceeded, timeout, or network_error), when the session authenticates, then it rejects with an outage error that names the reason and keeps the cause, so a recoverable session is not erased', async () => {
    for (const reason of ['server_error', 'rate_limit_exceeded', 'timeout', 'network_error']) {
      const cause = new Error(`WorkOS ${reason}`);
      const client = new WorkOSSessionClientDouble();
      client.check = () => ({ authenticated: false, reason: 'invalid_jwt' });
      client.refresh = () => retryableFailure(reason, cause);

      await assert.rejects(browserSession(client).authenticate(cookieHeader), (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, new RegExp(reason));
        assert.equal(error.cause, cause);
        return true;
      });
    }
  });

  test('Given an expired session whose selected membership was removed, when WorkOS throws OAuth 400 organization_membership_not_found, then the session signs out with a cleared cookie and no further refresh', async () => {
    const client = new WorkOSSessionClientDouble();
    client.check = () => ({ authenticated: false, reason: 'invalid_jwt' });
    client.refresh = () => oauthError(400, 'organization_membership_not_found');

    assert.deepEqual(await browserSession(client).authenticate(cookieHeader), { status: 'signed-out', cookies: [clearedSessionCookie] });
    assert.deepEqual(client.methods(), ['authenticate', 'refresh']);
  });

  test('Given a different OAuth status, code, or error shape, when automatic refresh throws, then the error still rejects and the session cookie is retained', async () => {
    const errors = [
      oauthError(403, 'organization_membership_not_found'),
      oauthError(500, 'organization_membership_not_found'),
      oauthError(400, 'invalid_request'),
      Object.assign(new Error('Wrong error kind'), { status: 400, error: 'organization_membership_not_found' }),
      Object.assign(new Error('Wrong status type'), { name: 'OauthException', status: '400', error: 'organization_membership_not_found' }),
      Object.assign(new Error('Wrong code field'), { name: 'OauthException', status: 400, code: 'organization_membership_not_found' }),
    ];
    for (const error of errors) {
      const client = new WorkOSSessionClientDouble();
      client.check = () => ({ authenticated: false, reason: 'invalid_jwt' });
      client.refresh = () => error;

      await assert.rejects(browserSession(client).authenticate(cookieHeader), actual => actual === error);
      assert.deepEqual(client.methods(), ['authenticate', 'refresh']);
    }
  });

  test('Given a refresh that the SDK throws (UnauthorizedException, an OAuth error, or a 5xx answer that is not JSON) or that gives no seal, when the session authenticates, then it rejects, so the cookie stays', async () => {
    const parseFailure = new Error('Unexpected error', { cause: Object.assign(new Error('Bad JSON'), { name: 'ParseError', rawStatus: 502 }) });
    const withoutSeal: SealRefresh = { authenticated: true, user: ada, organizationId: 'org_01ACME' };

    for (const answer of [new UnauthorizedException('request-1'), oauthError(400, 'invalid_request'), parseFailure, withoutSeal]) {
      const client = new WorkOSSessionClientDouble();
      client.check = () => ({ authenticated: false, reason: 'invalid_jwt' });
      client.refresh = () => answer;

      await assert.rejects(browserSession(client).authenticate(cookieHeader));
    }
  });
});

describe('WorkOSBrowserSession: the organization switch', () => {
  test('Given a signed-in session, when it selects another organization and WorkOS refreshes into it, then the switch sends one session cookie with the new seal, the same CSRF token, and no MFA evidence', async () => {
    const client = new WorkOSSessionClientDouble();
    const session = signedIn(await browserSession(client).authenticate(cookieHeader));

    const change = await session.selectOrganization('org_02GLOBEX');

    assert.equal(change.status, 'switched');
    assert.equal(change.cookies.length, 1);
    assert.deepEqual(sessionEnvelopeIn(change.cookies[0]), { seal: 'seal-2', csrf: envelope.csrf, mfa: false });
    assert.deepEqual(client.calls.at(-1), { method: 'refresh', input: { ...sealOptions, organizationId: 'org_02GLOBEX' } });
  });

  test('Given a session that refreshed during its check, when it selects an organization, then the switch refreshes the newest seal, because WorkOS can rotate the refresh token', async () => {
    const client = new WorkOSSessionClientDouble();
    client.check = () => ({ authenticated: false, reason: 'invalid_jwt' });
    client.refresh = (seal, organizationId) => refreshedTo(seal === 'seal-1' ? 'seal-2' : 'seal-3', organizationId ?? 'org_01ACME');
    const session = signedIn(await browserSession(client).authenticate(cookieHeader));

    const change = await session.selectOrganization('org_02GLOBEX');

    assert.deepEqual(client.calls.at(-1), { method: 'refresh', input: { sessionData: 'seal-2', cookiePassword: settings.cookiePassword, organizationId: 'org_02GLOBEX' } });
    assert.equal(sessionEnvelopeIn(change.cookies[0])?.seal, 'seal-3');
  });

  test('Given WorkOS refuses the organization with a 4xx OAuth error, such as 400 organization_membership_not_found, when the session selects it, then the switch is refused without a cookie change, so the session stays', async () => {
    for (const refusal of [oauthError(400, 'organization_membership_not_found'), oauthError(403, 'access_denied')]) {
      const client = new WorkOSSessionClientDouble();
      const session = signedIn(await browserSession(client).authenticate(cookieHeader));
      client.refresh = () => refusal;

      assert.deepEqual(await session.selectOrganization('org_09OTHER'), { status: 'refused', cookies: [] }, refusal.error);
    }
  });

  test('Given WorkOS refreshes into another organization than the one selected, when the session selects it, then the switch is refused but keeps the new seal, because the refresh token can rotate', async () => {
    const client = new WorkOSSessionClientDouble();
    const session = signedIn(await browserSession(client).authenticate(cookieHeader));
    client.refresh = () => refreshedTo('seal-2', 'org_01ACME');

    const change = await session.selectOrganization('org_02GLOBEX');

    assert.equal(change.status, 'refused');
    assert.deepEqual(change.cookies.map(sessionEnvelopeIn), [{ seal: 'seal-2', csrf: envelope.csrf, mfa: false }]);
  });

  test('Given WorkOS ended the session, when the session selects an organization, then the switch signs out with the cleared cookie', async () => {
    const client = new WorkOSSessionClientDouble();
    const session = signedIn(await browserSession(client).authenticate(cookieHeader));
    client.refresh = () => terminalRefusal('invalid_grant');

    assert.deepEqual(await session.selectOrganization('org_02GLOBEX'), { status: 'signed-out', cookies: [clearedSessionCookie] });
  });

  test('Given a refresh outage, a 401 of the API key, or a server error, when the session selects an organization, then the switch rejects, so no cookie changes', async () => {
    const answers = [retryableFailure('server_error', new Error('WorkOS 500')), new UnauthorizedException('request-1'), new GenericServerException(500, 'Internal error', {}, 'request-1')];

    for (const answer of answers) {
      const client = new WorkOSSessionClientDouble();
      const session = signedIn(await browserSession(client).authenticate(cookieHeader));
      client.refresh = () => answer;

      await assert.rejects(session.selectOrganization('org_02GLOBEX'));
    }
  });
});
