import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, test } from 'node:test';
import { fakeApiKey, fakeClientId, refusedLoopbackPort } from '../../support/workos-fake-api.ts';
import {
  accessToken,
  allowOnlyLoopbackRequests,
  authenticateRoute,
  authority,
  ada,
  clearedSessionCookie,
  cookieHeaderOf,
  grantsSent,
  keySetRoute,
  sessionFor,
  signedIn,
  signIn,
  startWorld,
  tokenAnswer,
} from './fixtures/workos-session-world.ts';

// The real browser session with the pinned WorkOS SDK, pointed at a local fake of the WorkOS API. These tests show
// the collaboration with the SDK, not the behavior of the WorkOS service.

describe('WorkOSBrowserSession with the pinned WorkOS SDK: sign-in, session checks, and refresh', () => {
  allowOnlyLoopbackRequests();

  test('Given a sign-in that AuthKit completed, when the callback brings the code and the state, then the SDK exchanges the code with the verifier of the AuthKit URL for a sealed session, and the new session cookie authenticates as the WorkOS user with the MFA evidence of the password sign-in', async (t) => {
    const world = await startWorld(t);
    const start = await world.session.startSignIn({ returnTo: '/team/members' });
    const authKitUrl = new URL(start.url);
    world.fake.answer(authenticateRoute, tokenAnswer(await accessToken(world, 'org_01ACME'), 'refresh-1'));

    const completion = await world.session.completeSignIn({
      query: new URLSearchParams({ code: 'code-1', state: authKitUrl.searchParams.get('state') ?? '' }),
      cookieHeader: cookieHeaderOf(start.cookies),
    });

    const [exchange] = world.fake.takeRequests();
    const body = exchange?.body as Readonly<Record<string, string>>;
    assert.deepEqual(
      { grant: body.grant_type, client: body.client_id, secret: body.client_secret, code: body.code },
      { grant: 'authorization_code', client: fakeClientId, secret: fakeApiKey, code: 'code-1' },
    );
    assert.equal(createHash('sha256').update(body.code_verifier ?? '').digest('base64url'), authKitUrl.searchParams.get('code_challenge'));
    if (completion.status !== 'signed-in') assert.fail(`the sign-in was refused: ${completion.reason}`);
    assert.equal(completion.returnTo, '/team/members');
    const session = signedIn(await world.session.authenticate(cookieHeaderOf(completion.cookies.slice(1))));
    assert.deepEqual(
      { user: session.user, profile: session.profile, mfaCompleted: session.mfaCompleted, cookies: session.cookies },
      { user: { authority, subject: ada.id, selectedOrganizationId: 'org_01ACME' }, profile: { email: ada.email, firstName: 'Ada', lastName: 'Lovelace' }, mfaCompleted: true, cookies: [] },
    );
  });

  test('Given a session cookie with a valid access token, when the session authenticates, then the SDK checks the token against the browser key set, and no refresh and no cookie change follow', async (t) => {
    const world = await startWorld(t);
    const cookie = await signIn(world, await accessToken(world, 'org_01ACME'));

    const session = signedIn(await world.session.authenticate(cookie));

    assert.deepEqual(session.cookies, []);
    assert.deepEqual(world.fake.takeRequests().map(({ method, path }) => `${method} ${path}`), [keySetRoute]);
  });

  test('Given a session cookie whose access token expired, when the session authenticates, then the SDK refreshes it through POST /user_management/authenticate with the stored refresh token in the organization of the session, and the one new cookie keeps the CSRF token and authenticates without another refresh', async (t) => {
    const world = await startWorld(t);
    const cookie = await signIn(world, await accessToken(world, 'org_01ACME', true));
    const csrfToken = world.session.csrfTokenOf(cookie);
    world.fake.answer(authenticateRoute, tokenAnswer(await accessToken(world, 'org_01ACME'), 'refresh-2'));

    const refreshed = signedIn(await world.session.authenticate(cookie));
    const refreshGrants = grantsSent(world.fake);
    const again = signedIn(await world.session.authenticate(cookieHeaderOf(refreshed.cookies)));

    assert.deepEqual(refreshGrants, [{
      grant_type: 'refresh_token',
      client_id: fakeClientId,
      client_secret: fakeApiKey,
      refresh_token: 'refresh-1',
      organization_id: 'org_01ACME',
    }]);
    assert.equal(refreshed.cookies.length, 1);
    assert.match(csrfToken ?? '', /^[\w-]{43}$/);
    assert.deepEqual([refreshed.csrfToken, again.csrfToken, again.mfaCompleted], [csrfToken, csrfToken, true]);
    assert.deepEqual(again.cookies, []);
    assert.deepEqual(grantsSent(world.fake), []);
  });

  test('Given an expired session that WorkOS ended, when the refresh gets 400 invalid_grant, then the session is signed out with the cleared cookie', async (t) => {
    const world = await startWorld(t);
    const cookie = await signIn(world, await accessToken(world, 'org_01ACME', true));
    world.fake.answer(authenticateRoute, { status: 400, body: { error: 'invalid_grant', error_description: 'Session has already ended.' } });

    assert.deepEqual(await world.session.authenticate(cookie), { status: 'signed-out', cookies: [clearedSessionCookie] });
  });


  test('Given a browser key set that answers 500 or a WorkOS API that refuses the connection, when the session authenticates, then the check rejects without a refresh, so the cookie stays, and the same cookie authenticates after the outage', async (t) => {
    const world = await startWorld(t);
    const cookie = await signIn(world, await accessToken(world, 'org_01ACME'));
    const refusing = sessionFor(world.fake, { port: await refusedLoopbackPort() });
    world.fake.answer(keySetRoute, { status: 500, body: { message: 'Internal error' } });

    await assert.rejects(world.session.authenticate(cookie), { code: 'ERR_JOSE_GENERIC' });
    await assert.rejects(refusing.authenticate(cookie), { name: 'TypeError', message: 'fetch failed' });
    const duringOutage = world.fake.takeRequests().map(({ method, path }) => `${method} ${path}`);
    world.fake.answer(keySetRoute, () => world.fake.browserKeySet.answer());

    assert.deepEqual(duringOutage, [keySetRoute]);
    assert.deepEqual(signedIn(await world.session.authenticate(cookie)).cookies, []);
  });

});
