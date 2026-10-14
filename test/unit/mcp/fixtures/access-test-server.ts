import type { TestContext } from 'node:test';
import type { AccessDecision, AuthenticatedUser, RequestContext } from '../../../../src/auth/access-context.ts';
import type { VerifiedIdentity } from '../../../../src/auth/identity-verifier.ts';
import { MCPServer } from '../../../../src/mcp/mcp-server.ts';
import { AccessResolverMock, type ConfiguredAccess } from './access-resolver-mock.ts';
import { FailureReporterMock } from './failure-reporter-mock.ts';
import { IdentityVerifierMock, type ConfiguredClaims } from './identity-verifier-mock.ts';
import { mcpRequest, type McpRequestOptions } from './mcp-http-request.ts';
import { RequestContextTools } from './request-context-tools.ts';

export const resourceUrl = 'https://thermus.example/mcp';
const resourceMetadataUrl = 'https://thermus.example/.well-known/oauth-protected-resource/mcp';
export const authority = 'https://auth.thermus.example';
export const nowSeconds = Math.floor(Date.now() / 1_000);
export const alice: AuthenticatedUser = { authority, subject: 'user-alice', selectedOrganizationId: 'org-a' };
export const bob: AuthenticatedUser = { authority, subject: 'user-bob', selectedOrganizationId: 'org-b' };

export function identityFor(user: AuthenticatedUser): VerifiedIdentity {
  return {
    user,
    issuer: authority,
    clientId: 'shared-client',
    scopes: ['openid'],
    issuedAtUnixSeconds: nowSeconds - 60,
    expiresAtUnixSeconds: nowSeconds + 3_600,
    resource: new URL(resourceUrl),
  };
}

export function contextFor(user: AuthenticatedUser, tenantId: string): RequestContext {
  return {
    user,
    tenantId,
    organizationId: user.selectedOrganizationId,
    grants: [{ role: 'user', permissions: ['product:access'] }],
    permissions: ['product:access'],
  };
}

export function allowed(context: RequestContext): AccessDecision {
  return { allowed: true, context };
}

export interface AccessTestServer {
  readonly server: MCPServer;
  readonly verifier: IdentityVerifierMock;
  readonly resolver: AccessResolverMock;
  readonly tools: RequestContextTools;
  readonly reporter: FailureReporterMock;
}

export function serveAccess(
  t: TestContext,
  decisions: ReadonlyMap<string, ConfiguredAccess>,
  options: { tools?: RequestContextTools; tokens?: ReadonlyMap<string, ConfiguredClaims>; requiredScopes?: string[] } = {},
): AccessTestServer {
  const verifier = new IdentityVerifierMock(options.tokens ?? new Map([
    ['alice-token', identityFor(alice)],
    ['bob-token', identityFor(bob)],
  ]));
  const resolver = new AccessResolverMock(decisions);
  const tools = options.tools ?? new RequestContextTools();
  const reporter = new FailureReporterMock();
  const server = new MCPServer({
    auth: {
      verifier,
      accessResolver: resolver,
      resourceMetadataUrl,
      expectedResource: new URL(resourceUrl),
      requiredScopes: options.requiredScopes,
    },
    buildServer: tools.buildServer,
    reportFailure: reporter.report,
  });
  t.after(() => server.close());
  return { server, verifier, resolver, tools, reporter };
}

export function callReport(t: TestContext, token: string | undefined, extra: Partial<McpRequestOptions> = {}): Request {
  return mcpRequest({
    url: resourceUrl,
    method: 'tools/call',
    token,
    params: { name: RequestContextTools.reportTool, arguments: {} },
    signal: t.signal,
    ...extra,
  });
}
