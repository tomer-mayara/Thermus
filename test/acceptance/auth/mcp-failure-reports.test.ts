import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test, type TestContext } from 'node:test';
import { inspect } from 'node:util';
import {
  InsufficientScopeError,
  SdkHttpError,
  StreamableHTTPClientTransport,
  UnauthorizedError,
  type Client,
} from '@modelcontextprotocol/client';
import type { AccessDecision } from '../../../src/accounts/identity/access-context.ts';
import type { VerifiedIdentity } from '../../../src/accounts/identity/identity-verifier.ts';
import { MCPServer } from '../../../src/interfaces/mcp/mcp-server.ts';
import { AccessResolverSpy } from '../../support/doubles/auth/access-resolver-spy.ts';
import { IdentityVerifierSpy } from '../../support/doubles/auth/identity-verifier-spy.ts';
import { FailureReporterSpy } from '../../support/doubles/mcp/failure-reporter-spy.ts';
import { connectMcpClient } from '../../support/drivers/mcp/mcp-sdk-client.ts';

const resourceUrl = 'https://thermus.example/mcp';
const authority = 'https://auth.thermus.example';
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
  let reporter: FailureReporterSpy;
  let server: MCPServer;

  beforeEach(() => {
    const verifier = new IdentityVerifierSpy(new Map<string, VerifiedIdentity | Error>([
      ['secret-outage-token', identityOutage],
      ['secret-uma-token', identityFor('user-uma')],
      ['secret-dana-token', identityFor('user-dana')],
      ['secret-scopeless-token', { ...identityFor('user-uma'), scopes: [] }],
    ]));
    const resolver = new AccessResolverSpy(new Map<string, AccessDecision | Error>([
      ['user-uma', lookupOutage],
      ['user-dana', { allowed: false, reason: 'membership-inactive' }],
    ]));
    reporter = new FailureReporterSpy();
    server = new MCPServer({
      auth: {
        verifier,
        accessResolver: resolver,
        resourceMetadataUrl: 'https://thermus.example/.well-known/oauth-protected-resource/mcp',
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
    const transport = new StreamableHTTPClientTransport(new URL(resourceUrl), {
      authProvider: { token: async () => token },
      requestInit: { headers: { Cookie: session } },
      fetch: (url, init) => server.fetch(new Request(url, init)),
    });
    const client = await connectMcpClient(t, transport, { probe: true, checkEra: false });
    t.after(() => client.close());
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
