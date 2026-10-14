import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import type { Page } from 'playwright';
import { completeAuthKit } from '../../../support/hosted-live/authkit-driver.ts';
import { refreshedAccessToken } from '../../../support/hosted-live/browser-session.ts';
import { authorizeWithConnect, type ConnectGrant } from '../../../support/hosted-live/connect-grant.ts';
import { issuedTokens, requestMachineTokens } from '../../../support/hosted-live/connect-client.ts';
import { once, type LiveRun } from '../../../support/hosted-live/live-run.ts';
import { nextNavigation, originAndPath, recordNavigations } from '../../../support/hosted-live/navigations.ts';
import { initiateLoginUri, localOrigin, mcpResource, signOutUri } from '../../../support/hosted-live/settings.ts';
import type { LiveUser } from '../../../support/hosted-live/staging-fixtures.ts';
import { readToken, secondsLeft } from '../../../support/hosted-live/tokens.ts';
import { deleteWorkOSResource } from '../../../support/hosted-live/workos-api.ts';
import { mcpRequest } from '../../../unit/mcp/fixtures/mcp-http-request.ts';

const signInOptions = { timeout: 240_000 };
const expiryOptions = { timeout: 600_000 };
const redirectTimeout = 15_000;
const sessionCookie = '__Host-thermus-session';
const signInCookie = '__Host-thermus-sign-in';
// A browser access token and a Connect access token live for 300 seconds; a little more lets both expire.
const tokenLifetimeWait = 305_000;

interface PortalVisit {
  readonly page: Page;
  readonly pages: readonly string[];
  readonly signedInAt: number;
}

interface ServerAnswer {
  readonly status: number;
  readonly body: string;
  readonly setCookies: readonly string[];
}

async function serverGet(page: Page, path: string): Promise<ServerAnswer> {
  const answer = await page.context().request.get(new URL(path, `${localOrigin}/`).href, { maxRedirects: 0 });
  return { status: answer.status(), body: await answer.text(), setCookies: answer.headersArray().filter(({ name }) => name.toLowerCase() === 'set-cookie').map(({ value }) => value) };
}

async function sessionJson(page: Page): Promise<Readonly<Record<string, unknown>>> {
  const answer = await serverGet(page, 'session');
  assert.equal(answer.status, 200, `GET /session gave ${answer.status}.`);
  return JSON.parse(answer.body) as Readonly<Record<string, unknown>>;
}

export function describeHostedServerCases(run: LiveRun): void {
  const { settings } = run;
  const authkitHost = new URL(settings.authkitIssuer).host;

  // A sign-in through the portal of the local HTTPS site: the Sign In button, /login, the AuthKit pages, and the
  // callback of the server. The browser keeps the cookies of the server, as a user's browser does.
  async function signInThroughPortal(user: LiveUser, organizationName?: string): Promise<PortalVisit> {
    await run.site();
    const page = await run.browser.newPage();
    await page.goto(`${localOrigin}/`);
    await page.getByRole('button', { name: 'Sign In' }).click();
    const pages = await completeAuthKit(page, { user, authkitHost, ...(organizationName === undefined ? {} : { organizationName }) });
    await page.waitForURL(`${localOrigin}/`);
    await page.getByRole('heading', { name: /^Welcome, / }).waitFor();
    await page.locator('.product-access').filter({ hasNotText: 'Checking' }).waitFor();
    return { page, pages, signedInAt: Date.now() };
  }

  async function mcpStatus(token: string | undefined): Promise<{ status: number; challenge: string | null; body: string }> {
    const site = await run.site();
    const response = await fetch(mcpRequest({ url: new URL('mcp', site.thermusUrl).href, method: 'server/discover', ...(token === undefined ? {} : { token }) }));
    return { status: response.status, challenge: response.headers.get('WWW-Authenticate'), body: await response.text() };
  }

  const admin = once(async () => {
    const { twoOrganizationUser, organizationA } = await run.fixtures();
    return signInThroughPortal(twoOrganizationUser, organizationA.name);
  });
  const mixedGrantInB = once(async (): Promise<ConnectGrant> => {
    const { mixedUser, organizationB, oauthApplication } = await run.fixtures();
    return authorizeWithConnect(run, { user: mixedUser, organizationName: organizationB.name, clientId: oauthApplication.clientId });
  });

  describe('Hosted live gate (AUTH-06): the hosted server at https://localhost:46443/ with WorkOS', () => {
    test('Given a member with User and Admin in organization A, when the member signs in through the portal and chooses A, then MFA completes before the callback, the server keeps the session in a sealed __Host- cookie that is HttpOnly, Secure, and SameSite=Lax, and the portal shows the product access of A from a current grant read', signInOptions, async (t) => {
      const { organizationA } = await run.fixtures();
      const { page, pages } = await admin();
      const cookies = await page.context().cookies(localOrigin);
      const session = cookies.find(({ name }) => name === sessionCookie);
      t.diagnostic(`AuthKit pages: ${pages.join(' > ')}`);
      t.diagnostic(`cookies: ${cookies.map(({ name, httpOnly, secure, sameSite, path, value }) => `${name} (${value.length} characters, HttpOnly ${httpOnly}, Secure ${secure}, SameSite ${sameSite}, Path ${path})`).join(', ')}`);

      assert.ok(pages.some((path) => path.startsWith('/mfa/')), 'AuthKit did not ask for the MFA step.');
      assert.ok(session, 'The server set no session cookie.');
      assert.deepEqual([session.httpOnly, session.secure, session.sameSite, session.path], [true, true, 'Lax', '/']);
      assert.equal(cookies.some(({ name }) => name === signInCookie), false, 'The sign-in cookie stayed after the callback.');
      assert.match(await page.locator('.product-access').innerText(), new RegExp(`You have product access in organization ${organizationA.id}\\. Roles: admin, user\\.`));
      const json = await sessionJson(page);
      assert.equal(json.mfaCompleted, true, 'The session of a password sign-in with required MFA has no MFA evidence.');
      assert.equal(json.organizationId, organizationA.id);
    });

    test('Given a signed-in user without an active membership, when the portal and the organization page open, then the portal shows no product access, the protected portal request gives 403, and the organization page gives the onboarding guidance', signInOptions, async () => {
      const { newUser } = await run.fixtures();
      const { page } = await signInThroughPortal(newUser);

      assert.match(await page.locator('.product-access').innerText(), /no product access in the selected organization/);
      assert.equal((await serverGet(page, 'portal/access')).status, 403);
      const onboarding = await serverGet(page, 'organizations');
      assert.equal(onboarding.status, 200);
      assert.match(onboarding.body, /Your account has no active access to an organization\./);
      await page.context().close();
    });

    test('Given an Admin-only member and a default-role member of organization A, when each signs in, then the protected portal request gives 403 for both: Admin alone gives no product access, and the default role gives no permission', signInOptions, async () => {
      const { adminOnlyUser, defaultRoleUser } = await run.fixtures();
      for (const user of [adminOnlyUser, defaultRoleUser]) {
        const { page } = await signInThroughPortal(user);
        assert.equal((await serverGet(page, 'portal/access')).status, 403, `${user.email.split('@')[0]} got product access.`);
        assert.match(await page.locator('.product-access').innerText(), /no product access/);
        await page.context().close();
      }
    });

    test('Given the Connect grant of a User in organization A, when its MCP client calls the MCP endpoint, then the call succeeds; without a token the answer is 401 with a Bearer challenge that names the protected-resource metadata, which names the AuthKit issuer', signInOptions, async (t) => {
      const site = await run.site();
      const { connectUser, organizationA, oauthApplication } = await run.fixtures();
      // A new grant: the provider proofs revoked the consent of the first one, and its token can have expired.
      const { tokens } = await authorizeWithConnect(run, { user: connectUser, organizationName: organizationA.name, clientId: oauthApplication.clientId });
      const allowed = await mcpStatus(tokens.accessToken);
      const missing = await mcpStatus(undefined);
      const metadataResponse = await fetch(new URL('.well-known/oauth-protected-resource/mcp', site.thermusUrl));
      const metadata = await metadataResponse.json() as Record<string, unknown>;
      t.diagnostic(`MCP with the Connect token: ${allowed.status}; without a token: ${missing.status} ${String(missing.challenge)}`);
      t.diagnostic(`protected-resource metadata: ${JSON.stringify(metadata)}`);

      assert.equal(allowed.status, 200, allowed.body);
      assert.equal(missing.status, 401);
      assert.match(String(missing.challenge), /^Bearer /);
      assert.match(String(missing.challenge), /resource_metadata="https:\/\/localhost:46443\/\.well-known\/oauth-protected-resource\/mcp"/);
      assert.equal(metadata.resource, mcpResource);
      assert.deepEqual(metadata.authorization_servers, [settings.authkitIssuer]);
    });

    test('Given a browser access token and an M2M token, when each is sent to the MCP endpoint, then each gets 401 and no MCP work', signInOptions, async () => {
      const { machineApplication } = await run.fixtures();
      // The session of this sign-in stays active: the other proofs ended the other sessions. A new browser token lets
      // only its kind refuse it.
      const { session } = await run.newUserSignIn();
      const browserToken = refreshedAccessToken(await session.refresh());
      const machine = issuedTokens(await requestMachineTokens(settings.authkitIssuer, machineApplication, mcpResource), 'The M2M token request');

      assert.equal((await mcpStatus(browserToken)).status, 401);
      assert.equal((await mcpStatus(machine.accessToken)).status, 401);
    });

    test('Given a member with Admin only in organization A and User in organization B, when the browser session is in A and the MCP grant is in B, then the portal has no product access while the MCP grant works: each credential keeps its own organization', signInOptions, async (t) => {
      const { mixedUser, organizationA, organizationB } = await run.fixtures();
      const grant = await mixedGrantInB();
      const browser = await signInThroughPortal(mixedUser, organizationA.name);
      t.diagnostic(`Connect grant pages: ${grant.visit.pages.join(' > ')}; token org_id is B: ${String(readToken(grant.tokens.accessToken).claims.org_id === organizationB.id)}`);

      assert.equal(readToken(grant.tokens.accessToken).claims.org_id, organizationB.id);
      assert.equal((await sessionJson(browser.page)).organizationId, organizationA.id);
      assert.equal((await serverGet(browser.page, 'portal/access')).status, 403);
      assert.equal((await mcpStatus(grant.tokens.accessToken)).status, 200);
      await browser.page.context().close();
    });

    test('Given an Admin-only member of organization A with a Connect grant, when its MCP client calls the MCP endpoint, then it gets 403 access_denied: MCP needs User', signInOptions, async () => {
      const { adminOnlyUser, organizationA, oauthApplication } = await run.fixtures();
      const grant = await authorizeWithConnect(run, { user: adminOnlyUser, organizationName: organizationA.name, clientId: oauthApplication.clientId });
      const answer = await mcpStatus(grant.tokens.accessToken);

      assert.equal(answer.status, 403);
      assert.match(answer.body, /access_denied/);
    });

    test('Given an external sign-in, when a browser opens the AuthKit domain directly, then AuthKit sends it to the Initiate login URI /login of the server, which starts the sign-in, and the user ends signed in on the portal', signInOptions, async (t) => {
      await run.site();
      const { connectUser } = await run.fixtures();
      const page = await run.browser.newPage();
      const navigations = recordNavigations(page);
      const initiated = nextNavigation(page, (url) => originAndPath(url) === initiateLoginUri, redirectTimeout);
      await page.goto(`${settings.authkitIssuer}/`);
      const reached = await initiated;
      t.diagnostic(`navigations: ${navigations.join(' > ')}`);
      assert.equal(reached, initiateLoginUri, [
        `A direct visit to ${settings.authkitIssuer}/ did not reach the Initiate login URI ${initiateLoginUri}.`,
        `The owner must set the Initiate login URI of the staging environment to ${initiateLoginUri} in the WorkOS dashboard.`,
      ].join(' '));
      await completeAuthKit(page, { user: connectUser, authkitHost });
      await page.waitForURL(`${localOrigin}/`);
      await page.getByRole('heading', { name: /^Welcome, / }).waitFor();
      await page.context().close();
    });

    test('Given the signed-in portal, when the member clicks Sign Out, then the server clears the session cookie and sends the browser to the WorkOS logout URL, WorkOS ends the session, and the browser lands on the Sign-out URI, which shows the signed-out portal', signInOptions, async (t) => {
      const { organizationB, twoOrganizationUser } = await run.fixtures();
      const { page } = await signInThroughPortal(twoOrganizationUser, organizationB.name);
      const activeBefore = await activeSessionsOf(run, twoOrganizationUser.id);
      const navigations = recordNavigations(page);
      const logout = page.waitForRequest((request) => request.url().startsWith('https://api.workos.com/user_management/sessions/logout'), { timeout: 15_000 });
      // The sign-out URI is the URL of the portal itself, so only a new navigation shows the landing.
      const landing = page.waitForEvent('framenavigated', { predicate: (frame) => frame === page.mainFrame(), timeout: 15_000 }).then((frame) => frame.url(), () => undefined);
      await page.getByRole('button', { name: 'Sign Out' }).click();
      await logout;
      const landed = await landing;
      const cookies = await page.context().cookies(localOrigin);
      const activeAfter = await activeSessionsOf(run, twoOrganizationUser.id);
      const landedAt = landed === undefined ? 'no page: the browser stopped after the WorkOS logout URL' : originAndPath(landed);
      t.diagnostic(`navigations: ${navigations.join(' > ')}`);
      t.diagnostic(`landing after the sign-out: ${landedAt}; active WorkOS sessions of the user: ${activeBefore} before, ${activeAfter} after`);

      assert.equal(cookies.some(({ name }) => name === sessionCookie), false, 'The session cookie stayed after the sign-out.');
      assert.equal(activeAfter, activeBefore - 1, 'WorkOS did not end the session.');
      assert.equal(landedAt, signOutUri, [
        `After the sign-out, the browser reached ${landedAt}, not the Sign-out URI ${signOutUri}.`,
        `The owner must set the default Sign-out URI of the staging environment to ${signOutUri} in the WorkOS dashboard.`,
        'The portal allows a form redirect only to its own origin, to api.workos.com, and to the AuthKit domain.',
      ].join(' '));
      await page.getByRole('button', { name: 'Sign In' }).waitFor();
      await page.context().close();
    });

    test('Given a signed-in session, an ended session, and an MCP grant whose consent was revoked, when their 300-second access tokens expire, then the session refreshes with a new cookie and the same form token, the ended session gives 401 with a cleared cookie, and the revoked grant works until its token expires and then gives 401', expiryOptions, async (t) => {
      const { mixedUser, connectUser, organizationB, oauthApplication } = await run.fixtures();
      const { page } = await admin();
      const before = await sessionJson(page);
      const ended = await signInThroughPortal(connectUser);
      const revoked = await revokeActiveSessionsOf(run, connectUser.id);
      const grant = await authorizeWithConnect(run, { user: mixedUser, organizationName: organizationB.name, clientId: oauthApplication.clientId });
      const status = await deleteWorkOSResource(settings, `/user_management/users/${mixedUser.id}/authorized_applications/${oauthApplication.id}`);
      const revokedToken = readToken(grant.tokens.accessToken);
      const atRevocation = await mcpStatus(grant.tokens.accessToken);
      const sessionAfterRevocation = await serverGet(ended.page, 'session');
      t.diagnostic(`revoked browser sessions: ${revoked}; consent revocation HTTP ${status}; MCP ${atRevocation.status} with ${secondsLeft(revokedToken)} s left; ended session ${sessionAfterRevocation.status}`);

      // Each access token of these sessions was issued before the second sign-in ended, or at the refresh of the first read.
      await sleep(Math.max(0, ended.signedInAt + tokenLifetimeWait - Date.now()));
      const refreshed = await serverGet(page, 'session');
      const afterExpiry = JSON.parse(refreshed.body) as Readonly<Record<string, unknown>>;
      const endedAfterExpiry = await serverGet(ended.page, 'session');
      await sleep(Math.max(0, (revokedToken.claims.exp ?? 0) * 1000 + 2_000 - Date.now()));
      const revokedAfterExpiry = await mcpStatus(grant.tokens.accessToken);
      t.diagnostic(`after expiry: session ${refreshed.status} with ${refreshed.setCookies.length} Set-Cookie; ended session ${endedAfterExpiry.status}; revoked MCP grant ${revokedAfterExpiry.status}`);

      assert.ok(revoked > 0, 'The second user had no active session to revoke.');
      assert.ok(status >= 200 && status < 300, `The consent revocation gave HTTP ${status}.`);
      assert.equal(atRevocation.status, 200, 'The MCP grant stopped before its access token expired.');
      assert.equal(sessionAfterRevocation.status, 200, 'The ended session stopped before its access token expired.');
      assert.equal(refreshed.status, 200);
      assert.equal(refreshed.setCookies.filter((cookie) => cookie.startsWith(`${sessionCookie}=`) && !/Max-Age=0/i.test(cookie)).length, 1, 'The refresh sent no new session cookie.');
      assert.equal(afterExpiry.csrfToken, before.csrfToken, 'The form token changed at the refresh.');
      assert.equal(endedAfterExpiry.status, 401);
      assert.ok(endedAfterExpiry.setCookies.some((cookie) => cookie.startsWith(`${sessionCookie}=`) && /Max-Age=0/i.test(cookie)), 'The ended session kept its cookie.');
      assert.equal(revokedAfterExpiry.status, 401);
      await ended.page.context().close();
    });
  });
}

async function activeSessionsOf(run: LiveRun, userId: string): Promise<number> {
  const sessions = await (await run.workos.userManagement.listSessions(userId)).autoPagination();
  return sessions.filter(({ status }) => status === 'active').length;
}

// The operator ends each active browser session of the user through the WorkOS API.
async function revokeActiveSessionsOf(run: LiveRun, userId: string): Promise<number> {
  const sessions = await (await run.workos.userManagement.listSessions(userId)).autoPagination();
  const active = sessions.filter(({ status }) => status === 'active');
  for (const { id } of active) await run.workos.userManagement.revokeSession({ sessionId: id });
  return active.length;
}
