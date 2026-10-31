import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import { openWorkOSConnection } from '../../../src/app/hosted-workos-application.ts';
import type { RequestServerBuilder } from '../../../src/interfaces/mcp/mcp-server.ts';
import { HostedBrowser, type BrowserAnswer } from '../../support/drivers/browser/hosted-browser.ts';
import { hostedConfig } from '../../support/fixtures/hosted-config.ts';
import { hostedStartupLine, workOSSettingsFor } from '../../support/fixtures/hosted-placeholder.ts';
import { signInThroughServer } from '../../support/dsl/workos-sign-in.ts';
import { OperatorLogSpy } from '../../support/doubles/application/operator-log-spy.ts';
import { nowInSeconds } from '../../support/doubles/workos/jwt-signing-key.ts';
import type { FakeUser } from '../../support/doubles/workos/workos-fake.ts';
import { mcpRequest, rpcResult } from '../../support/drivers/mcp/mcp-http-request.ts';
import { ContextReportToolSpy } from '../../support/doubles/mcp/context-report-tool-spy.ts';
import { serveWorkOSSite, type WorkOSSite } from '../../support/in-process/workos-site.ts';

// A local fake stands in for WorkOS, so these specifications prove the application side only. The hosted live gate
// proves the same flows against WorkOS.
const sessionCookie = '__Host-thermus-session';
const signInCookie = '__Host-thermus-sign-in';
const organizationA = 'org_01ACME';
const organizationB = 'org_01GLOBEX';

const ada: FakeUser = { id: 'user_01ADA', email: 'ada@example.com', firstName: 'Ada' };
const ben: FakeUser = { id: 'user_01BEN', email: 'ben@example.com', firstName: 'Ben' };
const cid: FakeUser = { id: 'user_01CID', email: 'cid@example.com', firstName: 'Cid' };
const dee: FakeUser = { id: 'user_01DEE', email: 'dee@example.com', firstName: 'Dee' };
const eve: FakeUser = { id: 'user_01EVE', email: 'eve@example.com', firstName: 'Eve' };

const openSite = (t: TestContext, buildServer?: RequestServerBuilder) => serveWorkOSSite(t, {
  organizations: [organizationA, organizationB],
  buildServer,
  setUp: (world) => {
    world.memberships = [
      { userId: ada.id, organizationId: organizationA, roles: ['user', 'admin'] },
      { userId: ada.id, organizationId: organizationB, roles: ['user'] },
      { userId: ben.id, organizationId: organizationA, roles: ['admin'] },
      { userId: cid.id, organizationId: organizationA, roles: [] },
      { userId: eve.id, organizationId: organizationA, roles: ['admin'] },
      { userId: eve.id, organizationId: organizationB, roles: ['user'] },
    ];
  },
});

function cookieNamed(answer: BrowserAnswer, name: string): string | undefined {
  return answer.cookies.find((cookie) => cookie.startsWith(`${name}=`));
}

async function json(browser: HostedBrowser, path: string): Promise<{ status: number; body: Record<string, unknown>; answer: BrowserAnswer }> {
  const answer = await browser.open(path, { Accept: 'application/json' });
  const body = answer.headers.get('Content-Type')?.includes('json') ? JSON.parse(answer.body) as Record<string, unknown> : {};
  return { status: answer.status, body, answer };
}

describe('Hosted WorkOS edition: browser sign-in, the portal session, and current access', () => {
  test('Given the hosted WorkOS edition, when a user signs in through the server and AuthKit sends the code back, then the browser gets one sealed HttpOnly, Secure, SameSite=Lax session cookie and no sign-in cookie, and the portal session shows the profile, the organization, no MFA evidence, and a form token', async (t) => {
    const site = await openSite(t);
    const { browser, start, callback } = await signInThroughServer(site, ada, organizationA);
    const session = await json(browser, 'session');

    assert.equal(start.status, 303);
    assert.equal(start.location?.pathname, '/user_management/authorize');
    assert.equal(start.location?.searchParams.get('redirect_uri'), 'https://thermus.example/team/callback');
    assert.equal(start.location?.searchParams.get('code_challenge_method'), 'S256');
    assert.match(cookieNamed(start, signInCookie) ?? '', /; HttpOnly/i);
    assert.equal(callback.status, 303);
    assert.equal(callback.location?.href, 'https://thermus.example/team/');
    const cookie = cookieNamed(callback, sessionCookie) ?? '';
    for (const attribute of [/; HttpOnly/i, /; Secure/i, /; SameSite=Lax/i, /; Path=\//i, /; Max-Age=\d+/i]) assert.match(cookie, attribute);
    assert.match(cookieNamed(callback, signInCookie) ?? '', /Max-Age=0/i);
    assert.equal(session.status, 200);
    assert.deepEqual({ ...session.body, csrfToken: typeof session.body.csrfToken }, {
      signedIn: true, email: ada.email, name: 'Ada Example', organizationId: organizationA, mfaCompleted: false, csrfToken: 'string',
    });
  });

  test('Given a callback with another state, without the sign-in cookie, with an AuthKit error, or with a refused code, when it arrives, then the server answers 400, makes no session, and clears the sign-in cookie', async (t) => {
    const site = await openSite(t);
    const browser = new HostedBrowser(site.transport, hostedConfig.publicBaseUrl);
    const start = await browser.open('login');
    const state = start.location?.searchParams.get('state') ?? '';
    const answers = [
      await browser.open(`callback?code=${site.world.codeFor(ada)}&state=another-state`),
      await new HostedBrowser(site.transport, hostedConfig.publicBaseUrl).open(`callback?code=${site.world.codeFor(ada)}&state=${state}`),
      await browser.open(`callback?error=access_denied&state=${state}`),
      await browser.open(`callback?code=refused-code&state=${state}`),
    ];

    for (const answer of answers) {
      assert.equal(answer.status, 400, answer.body);
      assert.equal(cookieNamed(answer, sessionCookie), undefined);
    }
    assert.equal((await browser.open('session')).status, 401);
  });

  test('Given a User of organization A, an Admin, a default-role member, and a user without a membership, when each opens the protected portal request, then the User and Admin get product access, and only from a current grant read', async (t) => {
    const site = await openSite(t);
    const results = [];
    for (const [user, organizationId] of [[ada, organizationA], [ben, organizationA], [cid, organizationA], [dee, undefined]] as const) {
      const { browser } = await signInThroughServer(site, user, organizationId);
      results.push([user.firstName, (await json(browser, 'portal/access')).status]);
    }
    const { browser } = await signInThroughServer(site, ada, organizationA);
    const access = await json(browser, 'portal/access');

    assert.deepEqual(results, [['Ada', 200], ['Ben', 200], ['Cid', 403], ['Dee', 403]]);
    assert.deepEqual(access.body, { organizationId: organizationA, organizationName: organizationA, roles: ['user', 'admin'], plan: 'free', memberLimit: 5, mcpUrl: hostedConfig.mcpResourceUrl });
    site.world.memberships = site.world.memberships.filter(({ userId, organizationId }) => !(userId === ada.id && organizationId === organizationA));
    assert.equal((await json(browser, 'portal/access')).status, 403, 'A removed membership still gave access to an existing session.');
  });

  test('Given a signed-in user without an active membership, when the organization page opens, then it gives the onboarding guidance, and each tenant page stays refused', async (t) => {
    const site = await openSite(t);
    const { browser } = await signInThroughServer(site, dee);

    const onboarding = await browser.open('organizations');
    assert.equal(onboarding.status, 200);
    assert.match(onboarding.body, /Your account has no active access to an organization\./);
    for (const path of ['portal/access', 'members', 'invitations']) assert.equal((await browser.open(path)).status, 403, path);
  });

  test('Given a session whose access token expired, when the next request arrives, then the server refreshes it with WorkOS, sends one new session cookie, and keeps the form token', async (t) => {
    const site = await openSite(t);
    site.world.expireAccessTokens();
    const { browser } = await signInThroughServer(site, ada, organizationA);
    const first = await json(browser, 'session');
    const second = await json(browser, 'session');

    assert.equal(first.status, 200);
    assert.equal(first.answer.cookies.filter((cookie) => cookie.startsWith(`${sessionCookie}=`)).length, 1, 'The refresh sent no new session cookie.');
    assert.equal(second.body.csrfToken, first.body.csrfToken);
  });

  test('Given an expired session that WorkOS ended, when the next request arrives, then the server answers 401 and clears the cookie; when the refresh service fails instead, then the answer is 500, the cookie stays, and the session works again after the outage', async (t) => {
    const site = await openSite(t);
    site.world.expireAccessTokens();
    const ended = await signInThroughServer(site, ben, organizationA);
    const recovering = await signInThroughServer(site, ada, organizationA);
    site.world.endSessionsOf(ben);
    const endedAnswer = await ended.browser.open('session');

    site.world.refreshOutage = { status: 500, body: { message: 'Internal error' } };
    const outage = await recovering.browser.open('session');
    site.world.refreshOutage = undefined;
    const recovered = await recovering.browser.open('session');

    assert.equal(endedAnswer.status, 401);
    assert.match(cookieNamed(endedAnswer, sessionCookie) ?? '', /Max-Age=0/i);
    assert.equal(outage.status, 500);
    assert.equal(cookieNamed(outage, sessionCookie), undefined, 'An outage changed the session cookie.');
    assert.equal(recovered.status, 200);
  });

  test('Given the signed-in portal, when the user posts the sign-out form with the form token from the site, then the server clears the session cookie and sends the browser to the WorkOS logout URL of the session; another origin or another token changes nothing', async (t) => {
    const site = await openSite(t);
    const { browser } = await signInThroughServer(site, ada, organizationA);
    const token = String((await json(browser, 'session')).body.csrfToken);

    const foreign = await browser.post('logout', { csrf_token: token }, { origin: 'https://evil.example' });
    const forged = await browser.post('logout', { csrf_token: 'forged-token' });
    const stillSignedIn = (await browser.open('session')).status;
    const signOut = await browser.post('logout', { csrf_token: token });

    assert.deepEqual([foreign.status, forged.status, stillSignedIn], [403, 403, 200]);
    assert.equal(signOut.status, 303);
    assert.equal(signOut.location?.pathname, '/user_management/sessions/logout');
    assert.equal(signOut.location?.searchParams.get('session_id'), `session_${ada.id}`);
    assert.match(cookieNamed(signOut, sessionCookie) ?? '', /Max-Age=0/i);
    assert.equal((await browser.open('session')).status, 401);
  });
});

describe('Hosted WorkOS edition: Connect tokens at the MCP endpoint', () => {
  test('Given Connect tokens, when the MCP endpoint gets them, then a User or Admin of the organization of the token is served; the default role, a missing organization, and an inactive membership get 403, and no MCP work runs for them', async (t) => {
    const site = await openSite(t);
    const statuses = [];
    for (const [user, organizationId] of [[ada, organizationA], [ada, organizationB], [ben, organizationA], [cid, organizationA], [ada, undefined], [dee, organizationA]] as const) {
      const token = await site.world.connectToken(user, organizationId === undefined ? {} : { org_id: organizationId });
      statuses.push([user.firstName, organizationId ?? 'none', (await site.discover(token)).status]);
    }

    assert.deepEqual(statuses, [['Ada', organizationA, 200], ['Ada', organizationB, 200], ['Ben', organizationA, 200], ['Cid', organizationA, 403], ['Ada', 'none', 403], ['Dee', organizationA, 403]]);
  });

  test('Given a browser token, an M2M-shaped token, an expired token, a token for another resource, and no token, when each reaches the MCP endpoint, then each gets 401 with a Bearer challenge that names the protected-resource metadata', async (t) => {
    const site = await openSite(t);
    const tokens = [
      await site.world.browserToken(ada, organizationA),
      await site.world.connectToken(ada, { org_id: organizationA, sid: undefined, sub: 'client_01MCPCLIENT' }),
      await site.world.authkitKey.sign({ sub: ada.id, client_id: 'client_01MCPCLIENT', sid: 'app_consent_1', scope: 'openid', org_id: organizationA }, {
        issuer: site.world.fake.authkitIssuer, audience: hostedConfig.mcpResourceUrl, issuedAtUnixSeconds: nowInSeconds() - 900, expiresAtUnixSeconds: nowInSeconds() - 600,
      }),
      await site.world.authkitKey.sign({ sub: ada.id, client_id: 'client_01MCPCLIENT', sid: 'app_consent_1', scope: 'openid', org_id: organizationA }, {
        issuer: site.world.fake.authkitIssuer, audience: 'https://other.example/mcp',
      }),
      undefined,
    ];

    for (const token of tokens) {
      const response = await site.discover(token);
      assert.equal(response.status, 401);
      assert.match(response.headers.get('WWW-Authenticate') ?? '', /resource_metadata="https:\/\/thermus\.example\/\.well-known\/oauth-protected-resource\/team\/mcp"/);
    }
  });

  test('Given the protected-resource metadata of the MCP resource, when a client reads it, then it names the MCP resource and the AuthKit issuer as its only authorization server', async (t) => {
    const site = await openSite(t);
    const response = await site.transport(new Request('https://thermus.example/.well-known/oauth-protected-resource/team/mcp'));
    const metadata = await response.json() as Record<string, unknown>;

    assert.equal(response.status, 200);
    assert.equal(metadata.resource, hostedConfig.mcpResourceUrl);
    assert.deepEqual(metadata.authorization_servers, [site.world.settings.authkitIssuer]);
  });

  test('Given a member with Admin in A and User in B, when the browser session is in A and the MCP token is in B, then each credential keeps its own organization, also after access in A is removed', async (t) => {
    const site = await openSite(t);
    const { browser } = await signInThroughServer(site, eve, organizationA);
    const token = await site.world.connectToken(eve, { org_id: organizationB });

    const portal = await json(browser, 'portal/access');
    assert.equal(portal.status, 200);
    assert.equal(portal.body.organizationId, organizationA);
    assert.equal((await site.discover(token)).status, 200);
    assert.equal((await json(browser, 'session')).body.organizationId, organizationA);
    site.world.setStatus(eve, organizationA, 'inactive');
    assert.equal((await json(browser, 'portal/access')).status, 403);
    assert.equal((await site.discover(token)).status, 200);
  });

  test('Given a membership read or key-set outage, when a request with a valid credential arrives, then the server answers 500 without protected work and reports the failure to the operator, without a token in the report', async (t) => {
    const site = await openSite(t);
    const token = await site.world.connectToken(ada, { org_id: organizationA });
    const { browser } = await signInThroughServer(site, ada, organizationA);
    site.world.membershipOutage = { status: 500, body: { message: 'Internal error' } };

    const mcpAnswer = await site.discover(token);
    const portalAnswer = await browser.open('portal/access');

    assert.equal(mcpAnswer.status, 500);
    assert.equal(portalAnswer.status, 500);
    assert.ok(site.log.lines.some((line) => line.startsWith('ERROR An MCP request failed unexpectedly in access-resolution')), site.log.lines.join('\n'));
    assert.ok(site.log.lines.some((line) => line.startsWith('ERROR An account request failed unexpectedly for /team/portal/access')), site.log.lines.join('\n'));
    assert.ok(site.log.lines.every((line) => !line.includes(token)), 'A report holds the token.');
  });

  test('Given the hosted composition with a buildServer that gives a test-only tool, when a Connect token of a User lists the tools, then the list has that tool; given the composition without a buildServer, then the endpoint has no tool list and answers that the method is not found', async (t) => {
    const listTools = async (site: WorkOSSite): Promise<Response> => {
      const token = await site.world.connectToken(ada, { org_id: organizationA });
      return site.transport(mcpRequest({ url: hostedConfig.mcpResourceUrl, method: 'tools/list', token }));
    };

    const withTool = await listTools(await openSite(t, new ContextReportToolSpy().buildServer));
    const withoutTool = await listTools(await openSite(t));

    assert.equal(withTool.status, 200);
    const { tools } = await rpcResult(withTool) as { tools: ReadonlyArray<{ name: string }> };
    assert.deepEqual(tools.map(({ name }) => name), [ContextReportToolSpy.reportTool]);
    assert.equal(withoutTool.status, 404);
    assert.deepEqual((await withoutTool.json() as { error: unknown }).error, { code: -32601, message: 'Method not found' });
  });
});

describe('Hosted WorkOS edition: the connection to WorkOS', () => {
  test('Given the WorkOS settings of an environment, when the connection opens, then it gives those settings and writes one operator line that names the client and the AuthKit issuer; given no WorkOS settings, then it rejects and writes no line', async () => {
    const environment = workOSSettingsFor(hostedConfig.publicBaseUrl);
    const opened = new OperatorLogSpy();
    const refused = new OperatorLogSpy();

    const connection = await openWorkOSConnection(hostedConfig, opened, environment);
    await assert.rejects(openWorkOSConnection(hostedConfig, refused, {}), /^WorkOSSettingsError: The hosted edition cannot start: the WorkOS settings are not valid\./);

    assert.deepEqual([connection.settings.clientId, connection.settings.authkitIssuer], [environment.WORKOS_CLIENT_ID, environment.WORKOS_AUTHKIT_ISSUER]);
    assert.deepEqual(opened.lines, [`INFO ${hostedStartupLine}`]);
    assert.deepEqual(refused.lines, []);
  });
});
