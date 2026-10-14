import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import type { RefreshSessionResponse } from '@workos-inc/node';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Page, Route } from 'playwright';
import { refreshedAccessToken, refreshedToken } from '../../../support/hosted-live/browser-session.ts';
import { once, type LiveRun } from '../../../support/hosted-live/live-run.ts';
import { browserIssuer, initiateLoginUri, localOrigin, signOutUri } from '../../../support/hosted-live/settings.ts';
import { errorCode, readToken, secondsLeft } from '../../../support/hosted-live/tokens.ts';

const signInOptions = { timeout: 180_000 };
const graceWait = 31_000;
const endedSession = { authenticated: false, reason: 'invalid_grant', retryable: false };

function outcome(result: RefreshSessionResponse): Readonly<Record<string, unknown>> {
  if (result.authenticated) return { authenticated: true };
  return { authenticated: false, reason: result.reason, retryable: result.retryable };
}

function originAndPath(url: string | URL): string {
  const { origin, pathname } = new URL(url);
  return `${origin}${pathname}`;
}

async function stubLocalSite(page: Page): Promise<void> {
  await page.route(`${localOrigin}/**`, (route: Route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Thermus local test site</p>' }));
}

async function openLogoutUrl(page: Page, logoutUrl: string): Promise<string> {
  await stubLocalSite(page);
  await page.goto(logoutUrl, { waitUntil: 'load' });
  await page.waitForURL((url) => url.host !== 'api.workos.com', { timeout: 15_000 });
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
  return originAndPath(page.url());
}

export function describeSessionEndingProofs(run: LiveRun): void {
  const { settings, workos } = run;
  const browserKeys = createRemoteJWKSet(new URL(workos.userManagement.getJwksUrl(settings.clientId)));
  const logout = once(async () => {
    const { session, page } = await run.organizationSignIn();
    refreshedToken(await session.refresh());
    const landing = await openLogoutUrl(page, workos.userManagement.getLogoutUrl({ sessionId: session.sessionId }));
    return { session, landing };
  });

  describe('Hosted live proofs: the end of browser sessions', () => {
    test('Given a browser session, when its refresh token is used, replayed at once, and replayed after 31 seconds, then the refresh and the replay succeed, and the old token works after 31 seconds only if WorkOS did not rotate it', signInOptions, async (t) => {
      const { exchange } = await run.newUserSignIn();
      const previous = exchange.refreshToken;
      const refresh = (refreshToken: string) => workos.userManagement.authenticateWithRefreshToken({ clientId: settings.clientId, refreshToken });

      const first = await refresh(previous);
      const replay = await refresh(previous).catch((error: unknown) => assert.fail(`The replay of the previous refresh token within 30 seconds failed: ${errorCode(error)}.`));
      const rotated = first.refreshToken !== previous;
      await sleep(graceWait);
      const late = await refresh(previous).then(() => 'works', (error: unknown) => `refused: ${errorCode(error)}`);

      t.diagnostic(`rotated: ${rotated}`);
      t.diagnostic(`the replay within 30 seconds gave the refresh token of the first refresh: ${replay.refreshToken === first.refreshToken}`);
      t.diagnostic(`previous token after 31 s: ${late}`);
      assert.equal(late === 'works', !rotated, `The previous refresh token after 31 seconds ${late}, but rotated is ${rotated}.`);
    });

    test('Given a browser session, when the operator revokes it, then the sealed refresh gives invalid_grant without retry, the session leaves the session list, and the issued access token still verifies until it expires', signInOptions, async (t) => {
      const { session } = await run.newUserLaterSignIn();
      const accessToken = refreshedAccessToken(await session.refresh());
      const token = readToken(accessToken);

      await workos.userManagement.revokeSession({ sessionId: session.sessionId });

      const after = outcome(await session.refresh());
      t.diagnostic(`sealed refresh after the revocation: ${JSON.stringify(after)}`);
      assert.deepEqual(after, endedSession);
      assert.equal(await session.listed(), false, 'The revoked session is still in the session list.');
      await jwtVerify(accessToken, browserKeys, { issuer: browserIssuer(settings) });
      t.diagnostic(`the access token issued before the revocation verifies for ${secondsLeft(token)} more seconds`);
      assert.ok(secondsLeft(token) > 0 && secondsLeft(token) <= 300, `The access token verifies for ${secondsLeft(token)} more seconds.`);
    });

    test('Given a signed-in browser session, when the browser opens the WorkOS logout URL of the session, then the session ends: it leaves the session list, and its sealed refresh gives invalid_grant', signInOptions, async (t) => {
      const { session } = await logout();

      const after = outcome(await session.refresh());
      t.diagnostic(`sealed refresh after the logout: ${JSON.stringify(after)}`);
      assert.deepEqual(after, endedSession);
      assert.equal(await session.listed(), false, 'The session is still in the session list after the logout.');
    });

    test('Given that logout, when WorkOS ends the session, then the browser lands on the default Sign-out URI https://localhost:46443/', signInOptions, async (t) => {
      const { landing } = await logout();
      t.diagnostic(`the browser landed on ${landing}`);

      assert.equal(landing, signOutUri, [
        `After the logout, the browser landed on ${landing}, not on the default Sign-out URI ${signOutUri}.`,
        `The owner must set the default Sign-out URI of the staging environment to ${signOutUri} in the WorkOS dashboard.`,
      ].join(' '));
    });

    test('Given no sign-in request, when a browser opens the AuthKit domain directly, then AuthKit sends it to the Initiate login URI https://localhost:46443/login before any sign-in page', signInOptions, async (t) => {
      const page = await run.browser.newPage();
      try {
        const navigations: string[] = [];
        page.on('framenavigated', (frame) => {
          if (frame === page.mainFrame()) navigations.push(originAndPath(frame.url()));
        });
        await stubLocalSite(page);
        await page.goto(`${settings.authkitIssuer}/`, { waitUntil: 'commit' });
        const first = await Promise.race([
          page.waitForURL((url) => originAndPath(url) === initiateLoginUri, { waitUntil: 'commit' }).then(() => 'the Initiate login URI'),
          page.locator('input[name=email]').waitFor().then(() => 'the AuthKit sign-in page'),
        ]);
        t.diagnostic(`navigations: ${navigations.join(' > ')}`);

        assert.equal(first, 'the Initiate login URI', [
          `A direct visit to ${settings.authkitIssuer}/ showed ${first} (${navigations.join(' > ')}), not the Initiate login URI ${initiateLoginUri}.`,
          `The owner must set the Initiate login URI of the staging environment to ${initiateLoginUri} in the WorkOS dashboard.`,
        ].join(' '));
      } finally {
        await page.context().close();
      }
    });
  });
}
