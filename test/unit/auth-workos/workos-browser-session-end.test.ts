import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  browserSession,
  clearedSessionCookie,
  cookieHeader,
  envelope,
  sealOptions,
  unsignedToken,
  WorkOSSessionClientDouble,
} from './fixtures/workos-session-client-double.ts';

describe('WorkOSBrowserSession: the end of a session and its CSRF token', () => {
  test('Given a usable session cookie whose access token has expired, when the session ends, then the WorkOS logout URL names the sid from the seal, the session cookie is cleared, and no token check runs', async () => {
    const client = new WorkOSSessionClientDouble();
    client.stored = { accessToken: unsignedToken({ sid: 'session_01ADA', exp: 1 }) };

    const end = await browserSession(client).endSession(cookieHeader);

    assert.deepEqual(end, { logoutUrl: 'https://api.workos.example/user_management/sessions/logout?session_id=session_01ADA', cookies: [clearedSessionCookie] });
    assert.deepEqual(client.calls, [
      { method: 'getSessionFromCookie', input: sealOptions },
      { method: 'getLogoutUrl', input: { sessionId: 'session_01ADA' } },
    ]);
  });

  test('Given no session cookie or one that does not open, when the session ends, then the session cookie is cleared without a logout URL, and no WorkOS call runs', async () => {
    const client = new WorkOSSessionClientDouble();

    for (const header of [null, 'theme=dark', '__Host-thermus-session=broken']) {
      assert.deepEqual(await browserSession(client).endSession(header), { cookies: [clearedSessionCookie] }, String(header));
    }
    assert.deepEqual(client.calls, []);
  });

  test('Given a seal without a usable access token (no record, an empty record, a value that is not a JWT, or a token without sid), or a damaged seal, when the session ends, then the session cookie is cleared without a logout URL', async () => {
    const stored = [undefined, {}, { accessToken: 'not-a-jwt' }, { accessToken: unsignedToken({ sid: undefined }) }, { accessToken: unsignedToken({ sid: 42 }) }];

    for (const record of [...stored, new DOMException('Invalid character', 'InvalidCharacterError'), new Error('Invalid expiration')]) {
      const client = new WorkOSSessionClientDouble();
      client.stored = record;

      assert.deepEqual(await browserSession(client).endSession(cookieHeader), { cookies: [clearedSessionCookie] }, JSON.stringify(record));
      assert.deepEqual(client.methods(), ['getSessionFromCookie']);
    }
  });

  test('Given an unexpected failure while the seal is read, when the session ends, then it rejects', async () => {
    const client = new WorkOSSessionClientDouble();
    client.stored = new Error('Cookie password is required');

    await assert.rejects(browserSession(client).endSession(cookieHeader), { message: 'Cookie password is required' });
  });

  test('Given a session cookie, when the logout route asks for its CSRF token, then it gets the token of the cookie without a WorkOS call; no cookie or one that does not open gives no token', () => {
    const client = new WorkOSSessionClientDouble();
    const session = browserSession(client);

    assert.deepEqual(
      [session.csrfTokenOf(cookieHeader), session.csrfTokenOf(null), session.csrfTokenOf('__Host-thermus-session=broken')],
      [envelope.csrf, undefined, undefined],
    );
    assert.deepEqual(client.calls, []);
  });
});
