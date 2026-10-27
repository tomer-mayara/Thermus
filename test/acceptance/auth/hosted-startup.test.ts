import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { hostedFetchSettings, workOSSettings } from '../../support/fixtures/hosted-placeholder.ts';
import { tenantProvisioningSettings } from '../../support/fixtures/control-plane-tenants.ts';
import { gatewayKeyPairOf, tenantSettingsOf } from '../../support/fixtures/hosted-tenant.ts';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { withPreload } from '../../support/processes/server-preloads.ts';
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

  test('Given valid WorkOS settings and trusted rules but a missing renderer, when the hosted server starts, then it stops before listening with a safe renderer setup message and uses no network', { timeout: 60_000 }, async (t) => {
    const LIGHTPANDA_BIN = '/missing/private-renderer-secret';
    const server = ServerProcess.launch(t, { ...hostedSettings, ...workOSSettings, LIGHTPANDA_BIN });

    await assertStopsBeforeListening(server, /FATAL.*Hosted renderer setup failed: LIGHTPANDA_BIN/);
    assert.ok(!server.output.includes(LIGHTPANDA_BIN), server.output);
    assert.equal(server.attemptedOutboundAccess, false, server.output);
  });

  for (const portal of ['missing', 'invalid'] as const) {
    test(`Given valid hosted settings but a ${portal} portal build, when the server starts, then it stops before listening with a safe build message and uses no network`, { timeout: 60_000 }, async (t) => {
      const directory = dataDirectory(t);
      const index = join(directory, 'index.html');
      if (portal === 'invalid') {
        mkdirSync(join(directory, 'assets'));
        writeFileSync(index, '<!doctype html><script type="module" src="/assets/missing.js"></script>');
      }
      const preload = `data:text/javascript,${encodeURIComponent(`import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === '#hosted-portal/index.html') return { url: ${JSON.stringify(pathToFileURL(index).href)}, shortCircuit: true };
  return nextResolve(specifier, context);
} });`)}`;
      const server = ServerProcess.launch(t, withPreload({ ...hostedSettings, ...workOSSettings }, preload));

      await assertStopsBeforeListening(server, /FATAL.*The hosted portal build is missing or invalid\. Run npm run build:user-portal before startup\./);
      assert.ok(!server.output.includes(directory), server.output);
      assertShowsNoSecret(server, workOSSettings);
      assert.equal(server.attemptedOutboundAccess, false, server.output);
    });
  }

  test('Given valid WorkOS settings and outbound access denied, when MCP, account, organization, and billing operations arrive with forged bearer tokens, cookies, organization IDs, and form input, then none gets access or a session: MCP asks for a token, each account path asks for a sign-in, a forged callback is refused, and the server uses no network', { timeout: 60_000 }, async (t) => {
    const settings = { ...hostedSettings, ...workOSSettings };
    const server = await ServerProcess.start(t, settings);

    const portal = await answerOf(server, '/', { headers: { Cookie: forgedCookie } });
    const mcp = [await answerOf(server, '/mcp', mcpCall(forgedToken)), await answerOf(server, '/mcp', mcpCall())];
    const accounts = [];
    for (const operation of accountOperations) accounts.push(await answerOf(server, operation.path, operation.init));
    const callback = await answerOf(server, '/auth/callback?code=forged-code&state=forged-state', { headers: { Cookie: forgedCookie } });
    await server.stop();

    assert.equal(portal.status, 200);
    assert.match(portal.body, /Thermus hosted portal fixture/);
    assertNoSession(portal, 'public portal');
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
    // The capacity rule ends its FATAL line, so that line holds no value. A value of one character, such as 0, can
    // also be part of the time stamp or the rule, so only the line end shows that the value is absent.
    const capacityRule = /FATAL\S* (?:\[[^\]]*\]: )?OPERATION_CAPACITY must be a whole number from 1 to 100\.$/m;
    const invalidSettings: ReadonlyArray<[ServerSettings, RegExp]> = [
      [{ PUBLIC_BASE_URL: 'http://localhost:8080' }, /FATAL.*PUBLIC_BASE_URL must use https\./],
      [{ PUBLIC_BASE_URL: 'https://thermus.example/?tenant=acme' }, /FATAL.*PUBLIC_BASE_URL must not contain a query\./],
      [{ PUBLIC_BASE_URL: 'https://thermus.example/team/', WORKOS_REDIRECT_URI: 'https://thermus.example/team/callback' }, /FATAL.*The hosted portal requires PUBLIC_BASE_URL with the base path \/\./],
      [{ PUBLIC_BASE_URL: 'https://operator:hunter2@thermus.example' }, /FATAL.*PUBLIC_BASE_URL must not contain a username or password\./],
      [{ PUBLIC_BASE_URL: '' }, /FATAL.*PUBLIC_BASE_URL is required\./],
      [{ LISTEN_PORT: '80.5' }, /FATAL.*LISTEN_PORT must be a whole number/],
      ...['0', '101', '1.5', 'abc', ' 5'].map((value): [ServerSettings, RegExp] => [{ OPERATION_CAPACITY: value }, capacityRule]),
    ];

    for (const [overrides, message] of invalidSettings) {
      const server = ServerProcess.launch(t, { ...hostedSettings, ...workOSSettings, ...overrides });

      await assertStopsBeforeListening(server, message);
      for (const value of Object.values(overrides).filter((setting) => setting.length > 1)) assert.ok(!server.output.includes(value), server.output);
    }
  });

  test('Given MCP_TENANTS_ENABLED with a value other than true or false, or on with an invalid tenant setting, when the server starts, then it stops before it listens with a FATAL line that names the setting and the rule but not the value', { timeout: 60_000 }, async (t) => {
    const invalidSettings: ReadonlyArray<[ServerSettings, RegExp]> = [
      [{ MCP_TENANTS_ENABLED: 'yes' }, /FATAL\S* (?:\[[^\]]*\]: )?MCP_TENANTS_ENABLED must be exactly true or false\.$/m],
      [{ ...tenantProvisioningSettings, RENDER_API_KEY: '' }, /FATAL\S* (?:\[[^\]]*\]: )?RENDER_API_KEY is required when MCP_TENANTS_ENABLED is true\.$/m],
      [{ ...tenantProvisioningSettings, RENDER_OWNER_ID: 'srv-notaworkspace' }, /FATAL\S* (?:\[[^\]]*\]: )?RENDER_OWNER_ID must be the ID of a Render workspace, such as tea-<lowercase letters and digits>\.$/m],
      [{ ...tenantProvisioningSettings, TENANT_IMAGE: 'ghcr.io/tomer-mayara/thermus-hosted:latest' }, /FATAL\S* (?:\[[^\]]*\]: )?TENANT_IMAGE must be an image reference by digest/m],
      [{ ...tenantProvisioningSettings, GATEWAY_PUBLIC_KEY: 'not-a-public-key' }, /FATAL\S* (?:\[[^\]]*\]: )?GATEWAY_PUBLIC_KEY must hold one or more PEM public keys of type Ed25519, separated by commas\.$/m],
      [{ ...tenantProvisioningSettings, CONTROL_PLANE_INTERNAL_URL: 'http://thermus-control-plane:8080/private-path' }, /FATAL\S* (?:\[[^\]]*\]: )?CONTROL_PLANE_INTERNAL_URL must be the http or https origin of the control plane/m],
    ];

    for (const [overrides, message] of invalidSettings) {
      const server = ServerProcess.launch(t, { ...hostedSettings, ...workOSSettings, ...overrides });

      await assertStopsBeforeListening(server, message);
      for (const name of ['MCP_TENANTS_ENABLED', 'RENDER_OWNER_ID', 'TENANT_IMAGE', 'GATEWAY_PUBLIC_KEY', 'CONTROL_PLANE_INTERNAL_URL']) {
        const value = overrides[name];
        if (value !== undefined && value.length > 3 && value !== tenantProvisioningSettings[name]) assert.ok(!server.output.includes(value), server.output);
      }
      assert.ok(!server.output.includes(tenantProvisioningSettings.RENDER_API_KEY ?? ''), 'The output shows no Render API key');
      assert.equal(server.attemptedOutboundAccess, false, server.output);
    }
  });

  test('Given MCP_TENANTS_ENABLED=true and valid tenant settings without the private hosted storage, when the server starts, then it stops before it listens, because the provisioner needs the tenant registry', { timeout: 60_000 }, async (t) => {
    const server = ServerProcess.launch(t, { ...hostedSettings, ...workOSSettings, ...tenantProvisioningSettings });

    await assertStopsBeforeListening(server, /FATAL.*MCP_TENANTS_ENABLED=true needs the tenant registry: DATABASE_URL and LOGGING_DESTINATION_ENCRYPTION_KEY must be valid\./);
    assert.ok(!server.output.includes(tenantProvisioningSettings.RENDER_API_KEY ?? ''), 'The output shows no Render API key');
    assert.equal(server.attemptedOutboundAccess, false, server.output);
  });

  test('Given MCP_TENANTS_ENABLED off, also with invalid tenant settings, when the server starts, then it listens, reads no tenant setting, and starts no provisioner', { timeout: 60_000 }, async (t) => {
    const invalidTenantSettings = { RENDER_API_KEY: 'a key with spaces', RENDER_OWNER_ID: 'srv-notaworkspace', TENANT_IMAGE: 'latest', GATEWAY_PUBLIC_KEY: 'not-a-public-key', CONTROL_PLANE_INTERNAL_URL: 'not-a-url' };
    for (const MCP_TENANTS_ENABLED of ['false', '']) {
      const server = await ServerProcess.start(t, { ...hostedSettings, ...workOSSettings, ...invalidTenantSettings, MCP_TENANTS_ENABLED });
      await server.stop();

      assert.doesNotMatch(server.output, /FATAL|tenant provisioner/i);
      assert.equal(server.attemptedOutboundAccess, false, server.output);
    }
  });
});

// The same image in the tenant role (SO-03): only the tenant settings of plan section 4.1, no WorkOS secret, no
// database setting, and no Render or Stripe setting.
describe('Hosted image in the tenant role', () => {
  const tenantSettings: ServerSettings = {
    ...hostedFetchSettings,
    ...tenantSettingsOf(gatewayKeyPairOf().publicKeyPem, 'http://thermus-control-plane:8080'),
    LISTEN_HOST: '127.0.0.1',
    LISTEN_PORT: '0',
  };
  const { THERMUS_ROLE: _role, ...controlPlaneSettings } = tenantSettings;

  test('Given THERMUS_ROLE=tenant with its settings and without a WorkOS secret or a database setting, when the hosted application starts, then it listens, /healthz answers 200 with ok, another path answers 404, an MCP call without a context gets 403, and it uses no network', { timeout: 60_000 }, async (t) => {
    const server = await ServerProcess.start(t, tenantSettings);

    const health = await answerOf(server, '/healthz');
    const portal = await answerOf(server, '/');
    const mcp = await answerOf(server, '/mcp', mcpCall(forgedToken));
    await server.stop();

    assert.deepEqual([health.status, health.body], [200, 'ok\n']);
    assert.equal(portal.status, 404);
    assert.equal(mcp.status, 403);
    assert.equal(server.attemptedOutboundAccess, false, server.output);
  });

  test('Given THERMUS_ROLE=tenant without one of its four settings, when the application starts, then it stops before it listens with a FATAL line that names the setting', { timeout: 60_000 }, async (t) => {
    for (const name of ['TENANT_ORGANIZATION_ID', 'GATEWAY_PUBLIC_KEY', 'CONTROL_PLANE_INTERNAL_URL', 'WORKOS_AUTHKIT_ISSUER']) {
      const { [name]: _missing, ...settings } = tenantSettings;
      const server = ServerProcess.launch(t, settings);

      await assertStopsBeforeListening(server, new RegExp(`FATAL.*${name} is required\\.`));
      assert.equal(server.attemptedOutboundAccess, false, server.output);
    }
  });

  test('Given an unknown value of THERMUS_ROLE, when the application starts, then it stops before it listens with a FATAL line that names the setting', { timeout: 60_000 }, async (t) => {
    for (const role of ['worker', 'Tenant', ' tenant']) {
      const server = ServerProcess.launch(t, { ...tenantSettings, THERMUS_ROLE: role });

      await assertStopsBeforeListening(server, /FATAL.*THERMUS_ROLE must be control-plane or tenant\./);
    }
  });

  test('Given a secret of the control plane in the tenant environment, when the application starts, then it stops before it listens with a FATAL line that names the setting but not the value', { timeout: 60_000 }, async (t) => {
    const secrets = ['WORKOS_API_KEY', 'WORKOS_CLIENT_SECRET', 'DATABASE_URL', 'RENDER_API_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'];
    for (const name of secrets) {
      const value = `private-value-of-${name.toLowerCase()}`;
      const server = ServerProcess.launch(t, { ...tenantSettings, [name]: value });

      await assertStopsBeforeListening(server, new RegExp(`FATAL.*The tenant role refuses ${name}`));
      assert.ok(!server.output.includes(value), server.output);
    }
  });

  test('Given THERMUS_ROLE=control-plane, when the hosted server starts with the WorkOS settings, then it serves the portal and the MCP challenge as without the setting', { timeout: 60_000 }, async (t) => {
    const server = await ServerProcess.start(t, { ...controlPlaneSettings, ...workOSSettings, THERMUS_ROLE: 'control-plane' });

    const portal = await answerOf(server, '/');
    const mcp = await answerOf(server, '/mcp', mcpCall());
    await server.stop();

    assert.equal(portal.status, 200);
    assert.equal(mcp.status, 401);
    assert.equal(server.attemptedOutboundAccess, false, server.output);
  });
});
