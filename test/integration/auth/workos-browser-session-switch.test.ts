import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  accessToken,
  allowOnlyLoopbackRequests,
  authenticateRoute,
  clearedSessionCookie,
  cookieHeaderOf,
  grantsSent,
  signedIn,
  signIn,
  startSessionFixture,
  tokenAnswer,
} from './fixtures/workos-session-fixtures.ts';

describe('WorkOSBrowserSession with the pinned WorkOS SDK: organization switch and logout', () => {
  allowOnlyLoopbackRequests();

  test('Given a signed-in session, when it selects another organization, then the SDK refreshes with that organization ID, and the new cookie authenticates in that organization with the same CSRF token', async (t) => {
    const world = await startSessionFixture(t);
    const session = signedIn(await world.session.authenticate(await signIn(world, await accessToken(world, 'org_01ACME'))));
    world.fake.answer(authenticateRoute, tokenAnswer(await accessToken(world, 'org_02GLOBEX'), 'refresh-2'));

    const change = await session.selectOrganization('org_02GLOBEX');
    const sent = grantsSent(world.fake);

    assert.equal(change.status, 'switched');
    assert.deepEqual(sent.map(({ grant_type, refresh_token, organization_id }) => [grant_type, refresh_token, organization_id]), [['refresh_token', 'refresh-1', 'org_02GLOBEX']]);
    const switched = signedIn(await world.session.authenticate(cookieHeaderOf(change.cookies)));
    assert.deepEqual([switched.user.selectedOrganizationId, switched.csrfToken], ['org_02GLOBEX', session.csrfToken]);
  });

  test('Given an organization without a membership of the user, when the session selects it and WorkOS answers 400 organization_membership_not_found, then the switch is refused without a cookie change, and the session still authenticates', async (t) => {
    const world = await startSessionFixture(t);
    const cookie = await signIn(world, await accessToken(world, 'org_01ACME'));
    const session = signedIn(await world.session.authenticate(cookie));
    world.fake.answer(authenticateRoute, { status: 400, body: { error: 'organization_membership_not_found', error_description: 'The user is not a member of the organization.' } });

    const change = await session.selectOrganization('org_09OTHER');

    assert.deepEqual(change, { status: 'refused', cookies: [] });
    assert.equal(signedIn(await world.session.authenticate(cookie)).user.selectedOrganizationId, 'org_01ACME');
  });


  test('Given a session cookie whose access token expired, when the session ends, then the logout URL names the sid from the seal without a request to WorkOS, and the session cookie is cleared', async (t) => {
    const world = await startSessionFixture(t);
    const cookie = await signIn(world, await accessToken(world, 'org_01ACME', true));

    const end = await world.session.endSession(cookie);

    assert.deepEqual(end, { logoutUrl: `${world.fake.origin}/user_management/sessions/logout?session_id=session_01ADA`, cookies: [clearedSessionCookie] });
    assert.deepEqual(world.fake.takeRequests(), []);
  });
});
