import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test, type TestContext } from 'node:test';
import { Client, SdkHttpError, StreamableHTTPClientTransport, UnauthorizedError } from '@modelcontextprotocol/client';
import {
  createRequestContext,
  type AccessDecision,
  type AuthenticatedUser,
} from '../../../src/auth/access-context.ts';
import type { VerifiedIdentity } from '../../../src/auth/identity-verifier.ts';
import { MCPServer } from '../../../src/mcp/mcp-server.ts';
import { RequestContextProbe, type ProbeReport } from '../../support/request-context-probe.ts';
import { AccessResolverMock } from '../../unit/mcp/fixtures/access-resolver-mock.ts';
import { IdentityVerifierMock } from '../../unit/mcp/fixtures/identity-verifier-mock.ts';

const resourceUrl = 'https://magumagu.example/mcp';
const resourceMetadataUrl = 'https://magumagu.example/.well-known/oauth-protected-resource/mcp';
const authority = 'https://auth.magumagu.example';
const productAccess = RequestContextProbe.requiredPermission;
const nowSeconds = Math.floor(Date.now() / 1_000);

function member(subject: string, organizationId: string): AuthenticatedUser {
  return { authority, subject, selectedOrganizationId: organizationId };
}

function identityFor(user: AuthenticatedUser): VerifiedIdentity {
  return {
    user,
    issuer: authority,
    clientId: 'shared-mcp-client',
    scopes: ['openid'],
    issuedAtUnixSeconds: nowSeconds - 60,
    expiresAtUnixSeconds: nowSeconds + 3_600,
    resource: new URL(resourceUrl),
  };
}

function allowed(user: AuthenticatedUser, tenantId: string, roles: Record<string, readonly string[]>): AccessDecision {
  const grants = Object.entries(roles).map(([role, permissions]) => ({ role, permissions }));
  return {
    allowed: true,
    context: createRequestContext({ user, tenantId, organizationId: user.selectedOrganizationId, grants }),
  };
}

describe('Trusted access context for MCP HTTP requests', () => {
  const alice = member('user-alice', 'org-a');
  const bob = member('user-bob', 'org-b');
  const dana = member('user-dana', 'org-a');
  const erin = member('user-erin', 'org-a');
  const owen = member('user-owen', 'org-a');
  const uma = member('user-uma', 'org-a');
  let resolver: AccessResolverMock;
  let probe: RequestContextProbe;
  let server: MCPServer;

  beforeEach(() => {
    const verifier = new IdentityVerifierMock(new Map(
      [alice, bob, dana, erin, owen, uma].map((user) => [`${user.subject}-token`, identityFor(user)]),
    ));
    resolver = new AccessResolverMock(new Map<string, AccessDecision | Error>([
      [alice.subject, allowed(alice, 'tenant-org-a', { user: [productAccess] })],
      [bob.subject, allowed(bob, 'tenant-org-b', { user: [productAccess] })],
      [dana.subject, { allowed: false, reason: 'membership-inactive' }],
      [erin.subject, allowed(erin, 'tenant-org-a', { admin: ['user-grants:manage'], 'super-admin': ['admin-grants:manage', 'billing:manage'] })],
      [owen.subject, allowed(owen, 'tenant-org-a', { 'super-admin': ['admin-grants:manage', 'billing:manage'], user: [productAccess] })],
      [uma.subject, new Error('private membership lookup failure for user-uma')],
    ]));
    probe = new RequestContextProbe();
    server = new MCPServer({
      auth: { verifier, accessResolver: resolver, resourceMetadataUrl, expectedResource: new URL(resourceUrl) },
      registerTools: probe.register,
      reportFailure: () => {},
    });
  });

  afterEach(async () => {
    await server.close();
  });

  async function connect(t: TestContext, token: string | undefined, headers: Record<string, string> = {}): Promise<Client> {
    const client = new Client(
      { name: 'magumagu-acceptance', version: '0.0.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' }, probe: { timeoutMs: 5_000, maxRetries: 0 } } },
    );
    const transport = new StreamableHTTPClientTransport(new URL(resourceUrl), {
      authProvider: { token: async () => token },
      requestInit: { headers },
      fetch: (url, init) => server.fetch(new Request(url, init)),
    });
    t.after(() => client.close());
    await client.connect(transport, { timeout: 5_000, signal: t.signal });
    return client;
  }

  async function callProbe(client: Client, args: Record<string, string>) {
    const result = await client.callTool({ name: RequestContextProbe.toolName, arguments: args });
    const [content] = result.content;
    assert.equal(content?.type, 'text');
    return { isError: result.isError === true, text: content.text };
  }

  async function probeReport(client: Client, args: Record<string, string>): Promise<ProbeReport> {
    const { isError, text } = await callProbe(client, args);
    assert.equal(isError, false, text);
    return JSON.parse(text);
  }

  test('Given two members of different organizations, when each calls the protected tool with forged tenant headers and arguments, then each call uses only its verified user and trusted tenant', { timeout: 20_000 }, async (t) => {
    const forged = { tenantId: 'tenant-org-b', organizationId: 'org-b', subject: 'user-bob' };
    const aliceClient = await connect(t, 'user-alice-token', {
      'X-Tenant-Id': forged.tenantId,
      'X-Organization-Id': forged.organizationId,
      'X-Forwarded-User': forged.subject,
    });
    const bobClient = await connect(t, 'user-bob-token');

    const [aliceReport, bobReport] = await Promise.all([
      probeReport(aliceClient, { url: 'https://example.com/a', ...forged }),
      probeReport(bobClient, { url: 'https://example.com/b' }),
    ]);

    assert.deepEqual(aliceReport.context, {
      user: alice,
      tenantId: 'tenant-org-a',
      organizationId: 'org-a',
      grants: [{ role: 'user', permissions: [productAccess] }],
      permissions: [productAccess],
    });
    assert.deepEqual(aliceReport.arguments, { url: 'https://example.com/a', ...forged });
    assert.deepEqual(aliceReport.claims, {
      user: alice,
      issuer: authority,
      clientId: 'shared-mcp-client',
      scopes: ['openid'],
      issuedAt: nowSeconds - 60,
      expiresAt: nowSeconds + 3_600,
      audience: resourceUrl,
    });
    assert.equal(bobReport.context.user.subject, bob.subject);
    assert.equal(bobReport.context.tenantId, 'tenant-org-b');
    assert.deepEqual(new Set(probe.work.map(({ step, subject, tenantId }) => `${step}:${subject}:${tenantId}`)), new Set([
      'fetch:user-alice:tenant-org-a', 'clean:user-alice:tenant-org-a',
      'fetch:user-bob:tenant-org-b', 'clean:user-bob:tenant-org-b',
    ]));
    assert.deepEqual(new Set(resolver.calls.map(({ subject }) => subject)), new Set([alice.subject, bob.subject]));
  });

  test('Given a member with independent Super Admin and User grants, when the member calls the protected tool, then the context holds both grants and every permission they give', { timeout: 20_000 }, async (t) => {
    const client = await connect(t, 'user-owen-token');

    const report = await probeReport(client, { url: 'https://example.com/' });

    assert.deepEqual(report.context.grants.map(({ role }) => role), ['super-admin', 'user']);
    assert.deepEqual([...report.context.permissions].sort(), ['admin-grants:manage', 'billing:manage', productAccess].sort());
    assert.equal(probe.work.length, 2);
  });

  test('Given a member with Admin and Super Admin grants but no User grant, when the member calls the protected tool, then the tool refuses before any fetch or clean step', { timeout: 20_000 }, async (t) => {
    const client = await connect(t, 'user-erin-token');

    const result = await callProbe(client, { url: 'https://example.com/' });

    assert.deepEqual(result, { isError: true, text: 'Access denied' });
    assert.deepEqual(probe.work, []);
  });

  test('Given a member whose organization membership is inactive, when the member connects, then the server denies access with HTTP 403 before any request tool exists', { timeout: 20_000 }, async (t) => {
    await assert.rejects(connect(t, 'user-dana-token'), (error) => error instanceof SdkHttpError && error.status === 403);

    assert.deepEqual(probe.contexts, []);
    assert.deepEqual(probe.work, []);
  });

  for (const { label, token } of [
    { label: 'no access token', token: undefined },
    { label: 'a rejected access token', token: 'forged-token' },
  ]) {
    test(`Given ${label}, when a client connects, then the server requires authentication before access resolution and no protected work runs`, { timeout: 20_000 }, async (t) => {
      await assert.rejects(connect(t, token), UnauthorizedError);

      assert.deepEqual(resolver.calls, []);
      assert.deepEqual(probe.contexts, []);
      assert.deepEqual(probe.work, []);
    });
  }

  test('Given an access lookup outage, when a member connects, then the client gets a generic server error and no protected work runs', { timeout: 20_000 }, async (t) => {
    await assert.rejects(connect(t, 'user-uma-token'), (error) => {
      assert.ok(error instanceof SdkHttpError);
      assert.equal(error.status, 500);
      assert.doesNotMatch(error.message, /private membership lookup failure/);
      return true;
    });

    assert.deepEqual(probe.contexts, []);
    assert.deepEqual(probe.work, []);
  });
});
