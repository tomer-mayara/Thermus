import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test, type TestContext } from 'node:test';
import { inspect } from 'node:util';
import {
  Client,
  InsufficientScopeError,
  SdkHttpError,
  StreamableHTTPClientTransport,
  UnauthorizedError,
} from '@modelcontextprotocol/client';
import type { AccessDecision } from '../../../src/auth/access-context.ts';
import type { VerifiedIdentity } from '../../../src/mcp/identity-verifier.ts';
import { MCPServer } from '../../../src/mcp/mcp-server.ts';
import { AccessResolverMock } from '../../unit/mcp/fixtures/access-resolver-mock.ts';
import { FailureReporterMock } from '../../unit/mcp/fixtures/failure-reporter-mock.ts';
import { IdentityVerifierMock } from '../../unit/mcp/fixtures/identity-verifier-mock.ts';

const resourceUrl = 'https://magumagu.example/mcp';
const authority = 'https://auth.magumagu.example';
const nowSeconds = Math.floor(Date.now() / 1_000);
const session = 'session=secret-session-cookie';

function identityFor(subject: string): VerifiedIdentity {
  return {
    user: { authority, subject, selectedOrganizationId: 'org-a' },
    issuer: authority,
    clientId: 'shared-mcp-client',
    scopes: ['openid'],
    issuedAtUnixSeconds: nowSeconds - 60,
    expiresAtUnixSeconds: nowSeconds + 3_600,
    resource: new URL(resourceUrl),
  };
}

describe('Operator reports of unexpected MCP failures', () => {
  const identityOutage = new Error('identity provider unavailable');
  const lookupOutage = new Error('private membership lookup failure for user-uma');
  let reporter: FailureReporterMock;
  let server: MCPServer;

  beforeEach(() => {
    const verifier = new IdentityVerifierMock(new Map<string, VerifiedIdentity | Error>([
      ['secret-outage-token', identityOutage],
      ['secret-uma-token', identityFor('user-uma')],
      ['secret-dana-token', identityFor('user-dana')],
      ['secret-scopeless-token', { ...identityFor('user-uma'), scopes: [] }],
    ]));
    const resolver = new AccessResolverMock(new Map<string, AccessDecision | Error>([
      ['user-uma', lookupOutage],
      ['user-dana', { allowed: false, reason: 'membership-inactive' }],
    ]));
    reporter = new FailureReporterMock();
    server = new MCPServer({
      auth: {
        verifier,
        accessResolver: resolver,
        resourceMetadataUrl: 'https://magumagu.example/.well-known/oauth-protected-resource/mcp',
        expectedResource: new URL(resourceUrl),
        requiredScopes: ['openid'],
      },
      reportFailure: reporter.report,
    });
  });

  afterEach(async () => {
    await server.close();
  });

  async function connect(t: TestContext, token: string): Promise<Client> {
    const client = new Client(
      { name: 'magumagu-acceptance', version: '0.0.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' }, probe: { timeoutMs: 5_000, maxRetries: 0 } } },
    );
    const transport = new StreamableHTTPClientTransport(new URL(resourceUrl), {
      authProvider: { token: async () => token },
      requestInit: { headers: { Cookie: session } },
      fetch: (url, init) => server.fetch(new Request(url, init)),
    });
    t.after(() => client.close());
    await client.connect(transport, { timeout: 5_000, signal: t.signal });
    return client;
  }

  for (const { label, token, step, cause } of [
    { label: 'an identity provider outage', token: 'secret-outage-token', step: 'token-verification', cause: identityOutage },
    { label: 'an access lookup outage', token: 'secret-uma-token', step: 'access-resolution', cause: lookupOutage },
  ]) {
    test(`Given ${label}, when a member connects with a bearer token and a session cookie, then the client gets a generic server error and the operator gets one ${step} report that keeps the cause and holds no credential`, { timeout: 20_000 }, async (t) => {
      await assert.rejects(connect(t, token), (error) => error instanceof SdkHttpError && error.status === 500);

      assert.deepEqual(reporter.reports.map((report) => report.step), [step]);
      assert.equal(reporter.reports[0]?.cause, cause);
      assert.doesNotMatch(inspect(reporter.reports, { depth: Infinity }), /secret/);
    });
  }

  test('Given a rejected token, a token without the required scope, and an inactive membership, when members connect, then each client is refused and the operator gets no failure report', { timeout: 20_000 }, async (t) => {
    await assert.rejects(connect(t, 'secret-forged-token'), UnauthorizedError);
    await assert.rejects(connect(t, 'secret-scopeless-token'), InsufficientScopeError);
    await assert.rejects(connect(t, 'secret-dana-token'), (error) => error instanceof SdkHttpError && error.status === 403);

    assert.deepEqual(reporter.reports, []);
  });
});
