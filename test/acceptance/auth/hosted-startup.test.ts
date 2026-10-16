import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { hostedFetchSettings, workOSSettings } from '../../support/fixtures/hosted-placeholder.ts';
import { ServerProcess, type ServerSettings } from '../../support/processes/server-process.ts';

// The built server with the hosted edition and outbound access denied. These specifications show the start of the
// WorkOS provider and the refusal of forged credentials without a WorkOS call. The hosted live gate proves the flows
// with WorkOS.

const hostedSettings: ServerSettings = {
  ...hostedFetchSettings,
  DEPLOYMENT: 'hosted',
  PUBLIC_BASE_URL: 'https://thermus.example',
  LISTEN_HOST: '127.0.0.1',
  LISTEN_PORT: '0',
};
const secretSettings = ['WORKOS_API_KEY', 'WORKOS_COOKIE_PASSWORD'] as const;
const forgedOrganization = 'org_01FORGEDORGANIZATION';
const forgedCookie = 'wos-session=Fe26.2*forged-sealed-session; better-auth.session_token=forged-local-session; __Host-thermus-session=forged-envelope';
const forgedToken = forgedJwt({
  iss: 'https://thermus-test.authkit.app',
  aud: 'https://thermus.example/mcp',
  sub: 'user_01FORGEDUSER',
  sid: 'app_consent_01FORGED',
  client_id: 'client_01FORGED',
  scope: 'openid',
  org_id: forgedOrganization,
  permissions: ['product:access', 'billing:manage'],
  iat: 1_700_000_000,
  exp: 4_102_444_800,
});

interface ForgedOperation {
  readonly area: 'MCP' | 'account' | 'organization' | 'billing';
  readonly path: string;
  readonly init: RequestInit;
}

const accountOperations: readonly ForgedOperation[] = [
  { area: 'account', path: '/', init: { headers: { Cookie: forgedCookie } } },
  { area: 'account', path: '/account', init: { headers: { Cookie: forgedCookie, Authorization: `Bearer ${forgedToken}` } } },
  { area: 'account', path: '/portal/access', init: { headers: { Cookie: forgedCookie, 'X-Organization-Id': forgedOrganization } } },
  { area: 'account', path: '/onboarding', init: { headers: { Cookie: forgedCookie } } },
  { area: 'organization', path: `/organizations?organizationId=${forgedOrganization}`, init: { headers: { Cookie: forgedCookie, 'X-Organization-Id': forgedOrganization } } },
  { area: 'organization', path: '/organizations/select', init: formPost({ csrf_token: 'forged-token', organization_id: forgedOrganization, return_to: '/' }) },
  { area: 'organization', path: `/members?organizationId=${forgedOrganization}`, init: { headers: { Cookie: forgedCookie, 'X-Organization-Id': forgedOrganization } } },
  { area: 'organization', path: '/members/grants', init: formPost({ csrf_token: 'forged-token', organization_id: forgedOrganization, membership_id: 'om_01FORGED', revision: 'r1', role: 'super-admin', action: 'grant' }) },
  { area: 'organization', path: '/invitations', init: { headers: { Cookie: forgedCookie } } },
  { area: 'organization', path: '/invitations/send', init: formPost({ csrf_token: 'forged-token', organization_id: forgedOrganization, role: 'admin', email: 'eve@example.com' }) },
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
  readonly cookies: readonly string[];
  readonly challenge: string | null;
  readonly location: string | null;
  readonly body: string;
}

async function answerOf(server: ServerProcess, path: string, init: RequestInit = {}): Promise<Answer> {
  const response = await server.request(path, { redirect: 'manual', ...init });
  return {
    status: response.status,
    cookies: response.headers.getSetCookie(),
    challenge: response.headers.get('WWW-Authenticate'),
    location: response.headers.get('Location'),
    body: await response.text(),
  };
}

// A forged cookie at most clears a cookie of the server; it never sets a session.
function assertNoSession(answer: Answer, label: string): void {
  for (const cookie of answer.cookies) assert.match(cookie, /^__Host-thermus-(?:session|sign-in)=; .*Max-Age=0/i, `${label} sets a cookie: ${cookie}`);
}

async function assertStopsBeforeListening(server: ServerProcess, message: RegExp): Promise<void> {
  assert.equal(await server.listeningOrExit(), undefined, server.output);
  assert.notEqual((await server.exited()).code, 0);
  assert.match(server.output, message);
}

function assertShowsNoSecret(server: ServerProcess, settings: Readonly<Record<string, string>>): void {
  for (const name of secretSettings) {
    const value = settings[name] ?? '';
    if (value !== '') assert.ok(!server.output.includes(value), `The output shows the value of ${name}.`);
  }
}

describe('Hosted edition with the WorkOS provider', () => {
  test('Given hosted settings without WorkOS settings, when the server starts, then it stops before it listens with a FATAL line that names each missing WorkOS setting, gives no access, and uses no network', { timeout: 60_000 }, async (t) => {
    const server = ServerProcess.launch(t, hostedSettings);

    await assertStopsBeforeListening(server, /FATAL.*The hosted edition cannot start: the WorkOS settings are not valid\./);
    for (const name of Object.keys(workOSSettings)) assert.match(server.output, new RegExp(`${name} is not valid: it is missing or empty\\.`));
    assert.equal(server.attemptedOutboundAccess, false, server.output);
  });

  test('Given refused WorkOS values, when the server starts, then it stops before it listens with a line that names each setting and its rule but not the value', { timeout: 60_000 }, async (t) => {
    const refused = {
      WORKOS_API_KEY: 'client_01NOTAKEY',
      WORKOS_AUTHKIT_ISSUER: 'http://thermus-test.authkit.app',
      WORKOS_REDIRECT_URI: 'https://evil.example/auth/callback',
      WORKOS_COOKIE_PASSWORD: 'too-short',
    };
    const server = ServerProcess.launch(t, { ...hostedSettings, ...workOSSettings, ...refused });

    await assertStopsBeforeListening(server, /FATAL.*The hosted edition cannot start/);
    for (const name of Object.keys(refused)) assert.match(server.output, new RegExp(`${name} is not valid: `));
    for (const value of Object.values(refused)) assert.ok(!server.output.includes(value), `The output shows ${value}.`);
    assert.equal(server.attemptedOutboundAccess, false, server.output);
  });

  test('Given valid WorkOS settings without readable trusted rules, when the hosted server starts, then it stops before listening and names only the rules setting and failure', { timeout: 60_000 }, async (t) => {
    for (const AD_RULES_FILE of ['', '/missing/private-rules.txt']) {
      const server = ServerProcess.launch(t, { ...hostedSettings, ...workOSSettings, AD_RULES_FILE });
      await assertStopsBeforeListening(server, /FATAL.*AD_RULES_FILE/);
      assert.ok(!server.output.includes('/missing/private-rules.txt'), server.output);
      assert.equal(server.attemptedOutboundAccess, false, server.output);
    }
  });

  test('Given valid WorkOS settings and outbound access denied, when MCP, account, organization, and billing operations arrive with forged bearer tokens, cookies, organization IDs, and form input, then none gets access or a session: MCP asks for a token, each account path asks for a sign-in, a forged callback is refused, and the server uses no network', { timeout: 60_000 }, async (t) => {
    const settings = { ...hostedSettings, ...workOSSettings };
    const server = await ServerProcess.start(t, settings);

    const mcp = [await answerOf(server, '/mcp', mcpCall(forgedToken)), await answerOf(server, '/mcp', mcpCall())];
    const accounts = [];
    for (const operation of accountOperations) accounts.push(await answerOf(server, operation.path, operation.init));
    const callback = await answerOf(server, '/auth/callback?code=forged-code&state=forged-state', { headers: { Cookie: forgedCookie } });
    await server.stop();

    for (const answer of mcp) {
      assert.equal(answer.status, 401);
      assert.match(answer.challenge ?? '', /^Bearer .*resource_metadata="https:\/\/thermus\.example\/\.well-known\/oauth-protected-resource\/mcp"/);
      assertNoSession(answer, 'MCP');
    }
    for (const [index, answer] of accounts.entries()) {
      const label = `${accountOperations[index]?.area} ${accountOperations[index]?.path}`;
      assert.equal(answer.status, 401, label);
      assert.match(answer.body, /Sign-in required/, label);
      assertNoSession(answer, label);
    }
    assert.equal(callback.status, 400);
    assertNoSession(callback, 'callback');
    assert.doesNotMatch(server.output, /tenant|org_01FORGED/);
    assertShowsNoSecret(server, settings);
    assert.equal(server.attemptedOutboundAccess, false, server.output);
  });

  test('Given valid WorkOS settings, when a browser starts the sign-in, then the server sends it to the AuthKit sign-in of WorkOS with PKCE, its state, and the registered redirect URI, sets a short sign-in cookie, and uses no network; the protected-resource metadata names the AuthKit issuer', { timeout: 60_000 }, async (t) => {
    const server = await ServerProcess.start(t, { ...hostedSettings, ...workOSSettings });

    const signIn = await answerOf(server, '/login');
    const metadata = await answerOf(server, '/.well-known/oauth-protected-resource/mcp');
    await server.stop();

    const location = new URL(signIn.location ?? 'about:blank');
    assert.equal(signIn.status, 303);
    assert.equal(`${location.origin}${location.pathname}`, 'https://api.workos.com/user_management/authorize');
    assert.equal(location.searchParams.get('client_id'), workOSSettings.WORKOS_CLIENT_ID);
    assert.equal(location.searchParams.get('redirect_uri'), workOSSettings.WORKOS_REDIRECT_URI);
    assert.equal(location.searchParams.get('code_challenge_method'), 'S256');
    assert.ok(location.searchParams.get('state'));
    assert.match(signIn.cookies.join('\n'), /^__Host-thermus-sign-in=[^;]+; .*HttpOnly/im);
    assert.equal(metadata.status, 200);
    assert.deepEqual(JSON.parse(metadata.body).authorization_servers, [workOSSettings.WORKOS_AUTHKIT_ISSUER]);
    assert.match(server.output, /INFO.*Hosted authentication uses WorkOS: the client client_placeholder and the AuthKit issuer https:\/\/thermus-test\.authkit\.app\./);
    assert.equal(server.attemptedOutboundAccess, false, server.output);
  });

  test('Given test and demonstration settings, when the onboarding page, the organization list, and a selection arrive with the session cookie, form token, organization, and return destination that the test doubles accept, then each asks for a sign-in, and the server reports no organization or tenant and uses no network', { timeout: 60_000 }, async (t) => {
    const demonstrationSettings = { NODE_ENV: 'test', AUTH_MODE: 'mock', THERMUS_DEMO: 'true', HOSTED_TEST_SESSION: 'session=user-ann' };
    const server = await ServerProcess.start(t, { ...hostedSettings, ...workOSSettings, ...demonstrationSettings });
    const cookie = 'session=00000000-0000-4000-8000-000000000000';
    const selection = { csrf_token: 'csrf-token-of-user-ann', organization_id: 'org-a', return_to: '/billing' };

    const answers = [
      await answerOf(server, '/organizations', { headers: { Cookie: cookie } }),
      await answerOf(server, '/organizations?return_to=/billing', { headers: { Cookie: cookie, 'X-Organization-Id': 'org-a' } }),
      await answerOf(server, '/organizations/select', formPost(selection, cookie)),
      await answerOf(server, '/billing', { headers: { Cookie: cookie } }),
    ];
    await server.stop();

    for (const answer of answers) {
      assert.equal(answer.status, 401);
      assert.deepEqual(answer.cookies, []);
    }
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
