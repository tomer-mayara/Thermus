import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import { PerRequestHTTPServerTransport } from '@modelcontextprotocol/server';
import type { RequestContext, RoleGrant } from '../../../src/auth/access-context.ts';
import { MCPServer } from '../../../src/mcp/mcp-server.ts';
import { AccessResolverMock } from '../../support/doubles/auth/access-resolver-spy.ts';
import { IdentityVerifierMock } from '../../support/doubles/auth/identity-verifier-spy.ts';
import { RequestContextTools, type ContextReport } from '../../support/doubles/mcp/context-report-tool-spy.ts';
import { FailureReporterMock } from '../../support/doubles/mcp/failure-reporter-spy.ts';
import { toolJson } from '../../support/drivers/mcp/mcp-http-request.ts';
import { alice, allowed, callReport, contextFor, identityFor, resourceUrl } from '../../support/in-process/access-test-server.ts';

const resourceMetadataUrl = 'https://thermus.example/.well-known/oauth-protected-resource/mcp';
const userGrant: RoleGrant = { role: 'user', permissions: ['product:access'] };
const adminGrant: RoleGrant = { role: 'admin', permissions: ['user-grants:manage'] };
const memberGrant: RoleGrant = { role: 'member', permissions: [] };

function contextWith(...grants: RoleGrant[]): RequestContext {
  return { ...contextFor(alice, 'tenant-org-a'), grants, permissions: [...new Set(grants.flatMap(({ permissions }) => permissions))] };
}

function serveWith(t: TestContext, context: RequestContext, requiredPermission?: string) {
  const resolver = new AccessResolverMock(new Map([[alice.subject, allowed(context)]]));
  const tools = new RequestContextTools();
  const reporter = new FailureReporterMock();
  const server = new MCPServer({
    auth: {
      verifier: new IdentityVerifierMock(new Map([['alice-token', identityFor(alice)]])),
      accessResolver: resolver,
      resourceMetadataUrl,
      expectedResource: new URL(resourceUrl),
      ...(requiredPermission === undefined ? {} : { requiredPermission }),
    },
    buildServer: tools.buildServer,
    reportFailure: reporter.report,
  });
  t.after(() => server.close());
  return { server, resolver, tools, reporter };
}

describe('MCPServer required permission', () => {
  test('Given product:access as the required permission and a context with the User grant, when a client calls a tool, then the tool gets that context', { timeout: 5_000 }, async (t) => {
    const context = contextWith(userGrant, adminGrant);
    const { server, tools } = serveWith(t, context, 'product:access');

    const report = await toolJson<ContextReport>(await server.fetch(callReport(t, 'alice-token')));

    assert.deepEqual(report.context, context);
    assert.equal(tools.contexts.length, 1);
  });

  for (const { label, grants } of [
    { label: 'only an Admin grant', grants: [adminGrant] },
    { label: 'only the default role', grants: [memberGrant] },
    { label: 'no grant', grants: [] },
  ]) {
    test(`Given product:access as the required permission and an allowed context with ${label}, when a client calls a tool, then it gets the 403 access_denied answer of a denial before the factory or MCP dispatch`, { timeout: 5_000 }, async (t) => {
      const dispatchSpy = t.mock.method(PerRequestHTTPServerTransport.prototype, 'handleMessage');
      const { server, resolver, tools, reporter } = serveWith(t, contextWith(...grants), 'product:access');

      const response = await server.fetch(callReport(t, 'alice-token'));

      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), { error: 'access_denied', error_description: 'Access denied' });
      assert.equal(response.headers.get('WWW-Authenticate'), null);
      assert.equal(resolver.calls.length, 1);
      assert.deepEqual(tools.contexts, []);
      assert.equal(dispatchSpy.mock.callCount(), 0);
      assert.deepEqual(reporter.reports, []);
    });
  }

  test('Given no required permission, when a client with a context without permissions calls a tool, then the tool gets that context as before', { timeout: 5_000 }, async (t) => {
    const context = contextWith(memberGrant);
    const { server } = serveWith(t, context);

    const report = await toolJson<ContextReport>(await server.fetch(callReport(t, 'alice-token')));

    assert.deepEqual(report.context, context);
  });

  test('Given a required permission and an allowed decision without a trusted tenant, when a client calls a tool, then the tenant check gives the generic 500 and one access-resolution report', { timeout: 5_000 }, async (t) => {
    const { server, reporter } = serveWith(t, { ...contextWith(memberGrant), tenantId: '' }, 'product:access');

    const response = await server.fetch(callReport(t, 'alice-token'));

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'server_error', error_description: 'Internal Server Error' });
    assert.deepEqual(reporter.reports.map(({ step }) => step), ['access-resolution']);
  });
});
