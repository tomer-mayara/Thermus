import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { mcpUnavailableAnswer, unavailableNotice as notice, workOSSettings } from '../../support/hosted-placeholder.ts';
import { ServerProcess, type ServerSettings } from '../../support/server-process.ts';

const hostedSettings: ServerSettings = {
  DEPLOYMENT: 'hosted',
  PUBLIC_BASE_URL: 'https://thermus.example',
  LISTEN_HOST: '127.0.0.1',
  LISTEN_PORT: '0',
};
const forgedOrganization = 'org_01FORGEDORGANIZATION';
const forgedCookie = 'wos-session=Fe26.2*forged-sealed-session; better-auth.session_token=forged-local-session';
const forgedToken = forgedJwt({
  iss: 'https://thermus-test.authkit.app',
  sub: 'user_01FORGEDUSER',
  org_id: forgedOrganization,
  role: 'user',
  permissions: ['product:access', 'billing:manage'],
  exp: 4_102_444_800,
});

interface ProtectedOperation {
  readonly area: 'MCP' | 'account' | 'organization' | 'billing';
  readonly path: string;
  readonly init: RequestInit;
}

const protectedOperations: readonly ProtectedOperation[] = [
  { area: 'MCP', path: '/mcp', init: mcpCall(forgedToken) },
  { area: 'MCP', path: '/mcp', init: mcpCall() },
  { area: 'MCP', path: '/mcp', init: { headers: { Accept: 'text/event-stream', Authorization: `Bearer ${forgedToken}`, 'Mcp-Session-Id': 'forged-session-id' } } },
  { area: 'MCP', path: '/mcp', init: { method: 'DELETE', headers: { Authorization: `Bearer ${forgedToken}`, 'Mcp-Session-Id': 'forged-session-id' } } },
  { area: 'MCP', path: '/.well-known/oauth-protected-resource/mcp', init: { headers: { Cookie: forgedCookie } } },
  { area: 'MCP', path: '/.well-known/oauth-protected-resource', init: {} },
  { area: 'account', path: '/', init: { headers: { Cookie: forgedCookie } } },
  { area: 'account', path: '/account', init: { headers: { Cookie: forgedCookie, Authorization: `Bearer ${forgedToken}` } } },
  { area: 'account', path: '/auth/sign-in', init: {} },
  { area: 'account', path: '/auth/callback?code=forged-code&state=forged-state', init: { headers: { Cookie: forgedCookie } } },
  { area: 'account', path: '/onboarding', init: { headers: { Cookie: forgedCookie } } },
  { area: 'organization', path: `/organizations?organizationId=${forgedOrganization}`, init: { headers: { Cookie: forgedCookie, 'X-Organization-Id': forgedOrganization } } },
  { area: 'organization', path: '/organizations/select', init: formPost({ organizationId: forgedOrganization }) },
  { area: 'organization', path: '/organizations/grants', init: formPost({ organizationId: forgedOrganization, userId: 'user_01FORGEDUSER', role: 'admin' }) },
  { area: 'organization', path: '/organizations/invitations', init: formPost({ organizationId: forgedOrganization, email: 'eve@example.com', role: 'user' }) },
  { area: 'organization', path: `/members?organizationId=${forgedOrganization}`, init: { headers: { Cookie: forgedCookie, 'X-Organization-Id': forgedOrganization } } },
  { area: 'organization', path: '/members/grants', init: formPost({ csrf_token: 'forged-token', organization_id: forgedOrganization, membership_id: 'om_01FORGED', revision: 'r1', role: 'super-admin', action: 'grant' }) },
  { area: 'organization', path: '/invitations', init: { headers: { Cookie: forgedCookie } } },
  { area: 'organization', path: '/invitations/send', init: formPost({ csrf_token: 'forged-token', organization_id: forgedOrganization, role: 'admin', email: 'eve@example.com' }) },
  { area: 'organization', path: '/invitations/resend', init: formPost({ csrf_token: 'forged-token', organization_id: forgedOrganization, invitation_id: 'invitation_01FORGED' }) },
  { area: 'organization', path: '/invitations/revoke', init: formPost({ csrf_token: 'forged-token', organization_id: forgedOrganization, invitation_id: 'invitation_01FORGED' }) },
  { area: 'billing', path: `/billing?organizationId=${forgedOrganization}`, init: { headers: { Cookie: forgedCookie } } },
  { area: 'billing', path: '/billing/seats', init: formPost({ organizationId: forgedOrganization, seatCount: '5' }) },
];

function forgedJwt(claims: Readonly<Record<string, unknown>>): string {
  const part = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'none', typ: 'JWT' })}.${part(claims)}.`;
}

function mcpCall(token?: string): RequestInit {
  const headers = new Headers({
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    Cookie: forgedCookie,
    'X-Organization-Id': forgedOrganization,
  });
  if (token !== undefined) headers.set('Authorization', `Bearer ${token}`);
  const call = { name: 'fetch', arguments: { url: 'https://example.com/', organizationId: forgedOrganization } };
  return { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: call }) };
}

function formPost(fields: Readonly<Record<string, string>>, cookie = forgedCookie): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: hostedSettings.PUBLIC_BASE_URL ?? '', Cookie: cookie },
    body: new URLSearchParams(fields).toString(),
  };
}

interface Answer {
  readonly status: number;
  readonly type: string | null;
  readonly caching: string | null;
  readonly cookie: string | null;
  readonly challenge: string | null;
  readonly body: string;
}

async function answerOf(server: ServerProcess, path: string, init: RequestInit = {}): Promise<Answer> {
  const response = await server.request(path, init);
  const { headers } = response;
  return {
    status: response.status,
    type: headers.get('Content-Type'),
    caching: headers.get('Cache-Control'),
    cookie: headers.get('Set-Cookie'),
    challenge: headers.get('WWW-Authenticate'),
    body: await response.text(),
  };
}

function assertUnavailable(answer: Answer, operation: Pick<ProtectedOperation, 'area' | 'path'>): void {
  const label = `${operation.area} ${operation.path}`;
  assert.equal(answer.status, 503, label);
  assert.equal(answer.cookie, null, `${label} sets a cookie`);
  assert.equal(answer.challenge, null, `${label} sends a Bearer challenge`);
  assert.equal(answer.caching, 'no-store', label);
  if (operation.area === 'MCP') {
    assert.match(answer.type ?? '', /^application\/json/, label);
    assert.deepEqual(JSON.parse(answer.body), mcpUnavailableAnswer, label);
  } else {
    assert.match(answer.type ?? '', /^text\/html/, label);
    assert.match(answer.body, notice, label);
    assert.doesNotMatch(answer.body, /<form|<input|password/i, `${label} asks for a credential`);
  }
}

async function assertStopsBeforeListening(server: ServerProcess, message: RegExp): Promise<void> {
  assert.equal(await server.listeningOrExit(), undefined, server.output);
  assert.notEqual((await server.exited()).code, 0);
  assert.match(server.output, message);
}

describe('Hosted edition with the authentication placeholder', () => {
  test('Given hosted settings with an HTTPS public URL and no WorkOS settings, when the server starts, then it listens, serves the authentication-unavailable notice without a credential prompt or cookie, reports no tenant, uses no network, and stops cleanly', { timeout: 60_000 }, async (t) => {
    const server = await ServerProcess.start(t, hostedSettings);

    const answer = await answerOf(server, '/');
    const exit = await server.stop();

    assertUnavailable(answer, { area: 'account', path: '/' });
    assert.match(server.output, /INFO.*Hosted authentication is not available yet\./);
    assert.doesNotMatch(server.output, /tenant/);
    assert.equal(server.attemptedOutboundAccess, false, server.output);
    assert.deepEqual(exit, { code: 0, signal: null });
  });

  test('Given the hosted placeholder, when MCP, account, organization, and billing operations are requested with forged bearer tokens, cookies, organization IDs, and form input, then each gets the explicit unavailable answer, with no cookie and no Bearer challenge, and the server uses no network', { timeout: 60_000 }, async (t) => {
    const server = await ServerProcess.start(t, hostedSettings);

    const answers = [];
    for (const operation of protectedOperations) answers.push(await answerOf(server, operation.path, operation.init));
    await server.stop();

    for (const [index, answer] of answers.entries()) assertUnavailable(answer, protectedOperations[index] as ProtectedOperation);
    assert.equal(server.attemptedOutboundAccess, false, server.output);
  });

  test('Given a value for each WorkOS setting, when the hosted server starts, then no setting turns on a provider or access: MCP and account operations get the same unavailable answers, the output shows no setting value, and the server uses no network', { timeout: 60_000 }, async (t) => {
    const server = await ServerProcess.start(t, { ...hostedSettings, ...workOSSettings });

    const mcp = await answerOf(server, '/mcp', mcpCall(forgedToken));
    const account = await answerOf(server, '/account', { headers: { Cookie: forgedCookie } });
    await server.stop();

    assertUnavailable(mcp, { area: 'MCP', path: '/mcp' });
    assertUnavailable(account, { area: 'account', path: '/account' });
    for (const value of Object.values(workOSSettings)) assert.ok(!server.output.includes(value), `The output shows ${value}`);
    assert.equal(server.attemptedOutboundAccess, false, server.output);
  });

  test('Given test and demonstration settings, when the onboarding page, the organization list, and a selection arrive with the session cookie, form token, organization, and return destination that the test doubles accept, then each gets the unavailable notice without a cookie, and the server reports no organization or tenant and uses no network', { timeout: 60_000 }, async (t) => {
    const demonstrationSettings = { NODE_ENV: 'test', AUTH_MODE: 'mock', THERMUS_DEMO: 'true', HOSTED_TEST_SESSION: 'session=user-ann' };
    const server = await ServerProcess.start(t, { ...hostedSettings, ...demonstrationSettings });
    const cookie = 'session=00000000-0000-4000-8000-000000000000';
    const selection = { csrf_token: 'csrf-token-of-user-ann', organization_id: 'org-a', return_to: '/billing' };

    const answers = [
      await answerOf(server, '/organizations', { headers: { Cookie: cookie } }),
      await answerOf(server, '/organizations?return_to=/billing', { headers: { Cookie: cookie, 'X-Organization-Id': 'org-a' } }),
      await answerOf(server, '/organizations/select', formPost(selection, cookie)),
      await answerOf(server, '/billing', { headers: { Cookie: cookie } }),
    ];
    await server.stop();

    for (const answer of answers) assertUnavailable(answer, { area: 'organization', path: '/organizations' });
    assert.doesNotMatch(server.output, /org-a|tenant|user-ann/);
    assert.equal(server.attemptedOutboundAccess, false, server.output);
  });

  test('Given hosted settings with an invalid common setting, also with every WorkOS setting, when the server starts, then it stops before it listens with a FATAL line that names the setting and the rule but not the value', { timeout: 60_000 }, async (t) => {
    const invalidSettings: ReadonlyArray<[ServerSettings, RegExp]> = [
      [{ PUBLIC_BASE_URL: 'http://localhost:8080' }, /FATAL.*PUBLIC_BASE_URL must use https\./],
      [{ PUBLIC_BASE_URL: 'https://thermus.example/?tenant=acme' }, /FATAL.*PUBLIC_BASE_URL must not contain a query\./],
      [{ PUBLIC_BASE_URL: 'https://operator:hunter2@thermus.example' }, /FATAL.*PUBLIC_BASE_URL must not contain a username or password\./],
      [{ PUBLIC_BASE_URL: '' }, /FATAL.*PUBLIC_BASE_URL is required\./],
      [{ LISTEN_PORT: '80.5' }, /FATAL.*LISTEN_PORT must be a whole number/],
    ];

    for (const [overrides, message] of invalidSettings) {
      const server = ServerProcess.launch(t, { ...hostedSettings, ...workOSSettings, ...overrides });

      await assertStopsBeforeListening(server, message);
      for (const value of Object.values(overrides).filter((setting) => setting !== '')) assert.ok(!server.output.includes(value), server.output);
    }
  });
});
