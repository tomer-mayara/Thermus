import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import { completeAuthKit } from '../../../support/hosted-live/authkit-driver.ts';
import { refreshedAccessToken } from '../../../support/hosted-live/browser-session.ts';
import { serverGet, sessionJson, signInThroughPortal, waitForPortal } from '../../../support/hosted-live/portal-visit.ts';
import { authorizeWithConnect, type ConnectGrant } from '../../../support/hosted-live/connect-grant.ts';
import { issuedTokens, requestMachineTokens } from '../../../support/hosted-live/connect-client.ts';
import { once, type LiveRun } from '../../../support/hosted-live/live-run.ts';
import { nextNavigation, originAndPath, recordNavigations } from '../../../support/hosted-live/navigations.ts';
import { initiateLoginUri, localOrigin, mcpResource, signOutUri } from '../../../support/hosted-live/settings.ts';
import { readToken, secondsLeft } from '../../../support/hosted-live/tokens.ts';
import { deleteWorkOSResource } from '../../../support/hosted-live/workos-api.ts';
import { mcpRequest } from '../../../support/drivers/mcp/mcp-http-request.ts';

const signInOptions = { timeout: 240_000 };
const expiryOptions = { timeout: 600_000 };
const redirectTimeout = 15_000;
const sessionCookie = '__Host-thermus-session';
const signInCookie = '__Host-thermus-sign-in';
// A browser access token and a Connect access token live for 300 seconds; a little more lets both expire.
const tokenLifetimeWait = 305_000;

export function describeHostedServerCases(run: LiveRun): void {
  const { settings } = run;
  const authkitHost = new URL(settings.authkitIssuer).host;

  async function mcpStatus(token: string | undefined): Promise<{ status: number; challenge: string | null; body: string }> {
    const site = await run.site();
    const response = await fetch(mcpRequest({ url: new URL('mcp', site.thermusUrl).href, method: 'server/discover', ...(token === undefined ? {} : { token }) }));
    return { status: response.status, challenge: response.headers.get('WWW-Authenticate'), body: await response.text() };
  }

  const admin = once(async () => {
    const { twoOrganizationUser, organizationA } = await run.fixtures();
    return signInThroughPortal(run, twoOrganizationUser, organizationA.name);
  });
  const mixedGrantInB = once(async (): Promise<ConnectGrant> => {
    const { mixedUser, organizationB, oauthApplication } = await run.fixtures();
    return authorizeWithConnect(run, { user: mixedUser, organizationName: organizationB.name, clientId: oauthApplication.clientId });
  });

  describe(`Hosted live gate (AUTH-06): the hosted server at ${localOrigin}/ with WorkOS`, () => {
    test('Given a member with User and Admin in organization A, when the member signs in with a password and chooses A, then no MFA is demanded, the sealed cookie is HttpOnly, Secure, and SameSite=Lax, the session has no MFA evidence, and the portal shows current product access in A', signInOptions, async (t) => {
      const { organizationA } = await run.fixtures();
      const { page, pages } = await admin();
      const cookies = await page.context().cookies(localOrigin);
      const session = cookies.find(({ name }) => name === sessionCookie);
      t.diagnostic(`AuthKit pages: ${pages.join(' > ')}`);
      t.diagnostic(`cookies: ${cookies.map(({ name, httpOnly, secure, sameSite, path, value }) => `${name} (${value.length} characters, HttpOnly ${httpOnly}, Secure ${secure}, SameSite ${sameSite}, Path ${path})`).join(', ')}`);

      assert.ok(pages.some((path) => path.startsWith('/password')), 'The live sign-in did not complete a password page.');
      assert.equal(pages.some((path) => path.startsWith('/mfa/')), false, 'Password sign-in reached an MFA page.');
      assert.ok(session, 'The server set no session cookie.');
      assert.deepEqual([session.httpOnly, session.secure, session.sameSite, session.path], [true, true, 'Lax', '/']);
      assert.equal(cookies.some(({ name }) => name === signInCookie), false, 'The sign-in cookie stayed after the callback.');
      assert.match(await page.locator('.product-access').textContent() ?? '', new RegExp(`You have product access in organization ${organizationA.id}\\. Roles: admin, user\\.`));
      const json = await sessionJson(page);
      assert.equal(json.mfaCompleted, false, 'The password session must not infer MFA evidence.');
      assert.equal(json.organizationId, organizationA.id);
    });

    test('Given a signed-in user without an active membership, when the portal and the organization page open, then the portal shows no product access, the protected portal request gives 403, and the organization page gives the onboarding guidance', signInOptions, async () => {
      const { newUser } = await run.fixtures();
      const { page } = await signInThroughPortal(run, newUser, undefined, 'organizations');
      await page.goto(`${localOrigin}/`);
      await waitForPortal(page);

      assert.match(await page.locator('.product-access').innerText(), /no product access in the selected organization/);
      assert.equal((await serverGet(page, 'portal/access')).status, 403);
      const onboarding = await serverGet(page, 'organizations');
      assert.equal(onboarding.status, 200);
      assert.match(onboarding.body, /Your account has no active access to an organization\./);
      await page.context().close();
    });

    test('Given an Admin-only member and a default-role member of organization A, when each signs in, then Admin has product access and the default role is refused', signInOptions, async () => {
      const { adminOnlyUser, defaultRoleUser } = await run.fixtures();
      for (const [user, expected] of [[adminOnlyUser, 200], [defaultRoleUser, 403]] as const) {
        const { page } = await signInThroughPortal(run, user, undefined, expected === 200 ? 'portal' : 'organizations');
        if (expected === 403) {
          await page.goto(`${localOrigin}/`);
          await waitForPortal(page);
        }
        assert.equal((await serverGet(page, 'portal/access')).status, expected);
        if (expected === 200) await page.locator('.access-details > summary').filter({ hasText: /^Details$/ }).click();
        assert.match(await page.locator('.product-access').innerText(), expected === 200 ? /You have product access/ : /no product access/);
        await page.context().close();
      }
    });

    test('Given the Connect grant of a User in organization A, when its MCP client calls the MCP endpoint, then the call succeeds; without a token the answer is 401 with a Bearer challenge that names the protected-resource metadata, which names the AuthKit issuer', signInOptions, async (t) => {
      const site = await run.site();
      const { connectUser, organizationA, oauthApplication } = await run.fixtures();
      // A fresh grant keeps this case independent of earlier consent changes and token expiry.
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
      assert.equal(/resource_metadata="([^"]*)"/.exec(String(missing.challenge))?.[1], `${localOrigin}/.well-known/oauth-protected-resource/mcp`);
      assert.equal(metadata.resource, mcpResource);
      assert.deepEqual(metadata.authorization_servers, [settings.authkitIssuer]);
    });

    test('Given a browser access token and an M2M token, when each is sent to the MCP endpoint, then each gets 401 and no MCP work', signInOptions, async () => {
      const { machineApplication } = await run.fixtures();
      // A fresh browser token makes this refusal depend on token kind, without expiry or revocation.
      const { session } = await run.newUserSignIn();
      const browserToken = refreshedAccessToken(await session.refresh());
      const machine = issuedTokens(await requestMachineTokens(settings.authkitIssuer, machineApplication, mcpResource), 'The M2M token request');

      assert.equal((await mcpStatus(browserToken)).status, 401);
      assert.equal((await mcpStatus(machine.accessToken)).status, 401);
    });

    test('Given a member with Admin only in organization A and User in organization B, when the browser session is in A and the MCP grant is in B, then each opens in its own organization; deactivating the A membership closes portal access while MCP in B still works', signInOptions, async (t) => {
      const { mixedUser, organizationA, organizationB, memberships } = await run.fixtures();
      const grant = await mixedGrantInB();
      const browser = await signInThroughPortal(run, mixedUser, organizationA.name);
      t.diagnostic(`Connect grant pages: ${grant.visit.pages.join(' > ')}; token org_id is B: ${String(readToken(grant.tokens.accessToken).claims.org_id === organizationB.id)}`);

      assert.equal(readToken(grant.tokens.accessToken).claims.org_id, organizationB.id);
      assert.equal((await sessionJson(browser.page)).organizationId, organizationA.id);
      const portal = await serverGet(browser.page, 'portal/access');
      assert.equal(portal.status, 200, portal.body);
      assert.deepEqual(JSON.parse(portal.body), { organizationId: organizationA.id, organizationName: organizationA.name, roles: ['admin'], plan: 'free', memberLimit: 5, mcpUrl: mcpResource });
      assert.equal((await mcpStatus(grant.tokens.accessToken)).status, 200);
      await run.workos.userManagement.deactivateOrganizationMembership(memberships.mixedAdminInA);
      assert.equal((await serverGet(browser.page, 'portal/access')).status, 403);
      assert.equal((await sessionJson(browser.page)).organizationId, organizationA.id);
      assert.equal((await mcpStatus(grant.tokens.accessToken)).status, 200);
      await browser.page.context().close();
    });

    test('Given an Admin-only member of organization A with a Connect grant, when its MCP client calls the MCP endpoint, then it succeeds because Admin includes product access', signInOptions, async () => {
      const { adminOnlyUser, organizationA, oauthApplication } = await run.fixtures();
      const grant = await authorizeWithConnect(run, { user: adminOnlyUser, organizationName: organizationA.name, clientId: oauthApplication.clientId });
      const answer = await mcpStatus(grant.tokens.accessToken);

      assert.equal(answer.status, 200, answer.body);
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
      const { page } = await signInThroughPortal(run, twoOrganizationUser, organizationB.name);
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
      await page.getByRole('link', { name: 'Sign in', exact: true }).waitFor();
      await page.context().close();
    });

    test('Given a signed-in session, an ended session, and an MCP grant whose consent was revoked, when their 300-second access tokens expire, then the session refreshes with a new cookie and the same form token, the ended session gives 401 with a cleared cookie, and the revoked grant works until its token expires and then gives 401', expiryOptions, async (t) => {
      const { mixedUser, connectUser, organizationB, oauthApplication } = await run.fixtures();
      const { page } = await admin();
      const before = await sessionJson(page);
      const ended = await signInThroughPortal(run, connectUser);
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
      assert.equal(afterExpiry.mfaCompleted, false, 'A refresh must not infer MFA evidence.');
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

async function revokeActiveSessionsOf(run: LiveRun, userId: string): Promise<number> {
  const sessions = await (await run.workos.userManagement.listSessions(userId)).autoPagination();
  const active = sessions.filter(({ status }) => status === 'active');
  for (const { id } of active) await run.workos.userManagement.revokeSession({ sessionId: id });
  return active.length;
}
