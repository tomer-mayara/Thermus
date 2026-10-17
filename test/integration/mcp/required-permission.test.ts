import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import { PerRequestHTTPServerTransport } from '@modelcontextprotocol/server';
import type { RequestContext, RoleGrant } from '../../../src/auth/access-context.ts';
import { MCPServer, type McpHttpAuthOptions } from '../../../src/mcp/mcp-server.ts';
import { AccessResolverSpy, type ConfiguredAccess } from '../../support/doubles/auth/access-resolver-spy.ts';
import { IdentityVerifierSpy } from '../../support/doubles/auth/identity-verifier-spy.ts';
import { ContextReportToolSpy, type ContextReport } from '../../support/doubles/mcp/context-report-tool-spy.ts';
import { FailureReporterSpy } from '../../support/doubles/mcp/failure-reporter-spy.ts';
import { toolJson } from '../../support/drivers/mcp/mcp-http-request.ts';
import { alice, allowed, callReport, contextFor, identityFor, resourceUrl } from '../../support/in-process/access-test-server.ts';

const resourceMetadataUrl = 'https://thermus.example/.well-known/oauth-protected-resource/mcp';
const userGrant: RoleGrant = { role: 'user', permissions: ['product:access'] };
const adminGrant: RoleGrant = { role: 'admin', permissions: ['user-grants:manage'] };
const memberGrant: RoleGrant = { role: 'member', permissions: [] };
const signupGuidance = 'Open https://thermus.example/signup to check access, then reauthorize the MCP client for the intended workspace.';

function contextWith(...grants: RoleGrant[]): RequestContext {
  return { ...contextFor(alice, 'tenant-org-a'), grants, permissions: [...new Set(grants.flatMap(({ permissions }) => permissions))] };
}

function serveWith(t: TestContext, decision: ConfiguredAccess, options: Pick<McpHttpAuthOptions, 'requiredPermission' | 'accessDeniedDescription'> = {}) {
  const resolver = new AccessResolverSpy(new Map([[alice.subject, decision]]));
  const tools = new ContextReportToolSpy();
  const reporter = new FailureReporterSpy();
  const server = new MCPServer({
    auth: {
      verifier: new IdentityVerifierSpy(new Map([['alice-token', identityFor(alice)]])),
      accessResolver: resolver,
      resourceMetadataUrl,
      expectedResource: new URL(resourceUrl),
      ...options,
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
    const { server, tools } = serveWith(t, allowed(context), { requiredPermission: 'product:access', accessDeniedDescription: signupGuidance });

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
      const { server, resolver, tools, reporter } = serveWith(t, allowed(contextWith(...grants)), { requiredPermission: 'product:access' });

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
    const { server } = serveWith(t, allowed(context));

    const report = await toolJson<ContextReport>(await server.fetch(callReport(t, 'alice-token')));

    assert.deepEqual(report.context, context);
  });

  test('Given a required permission and an allowed decision without a trusted tenant, when a client calls a tool, then the tenant check gives the generic 500 and one access-resolution report', { timeout: 5_000 }, async (t) => {
    const { server, reporter } = serveWith(t, allowed({ ...contextWith(memberGrant), tenantId: '' }), { requiredPermission: 'product:access', accessDeniedDescription: signupGuidance });

    const response = await server.fetch(callReport(t, 'alice-token'));

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'server_error', error_description: 'Internal Server Error' });
    assert.deepEqual(reporter.reports.map(({ step }) => step), ['access-resolution']);
  });

  test('Given an access denial without a custom description, when a client calls a tool, then it gets the existing generic denial without protected work', async (t) => {
    const { server, tools, reporter } = serveWith(t, { allowed: false, reason: 'membership-inactive' });

    const response = await server.fetch(callReport(t, 'alice-token'));

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: 'access_denied', error_description: 'Access denied' });
    assert.deepEqual(tools.contexts, []);
    assert.deepEqual(reporter.reports, []);
  });

  for (const decision of [{ allowed: false, reason: 'membership-inactive' } as const, allowed(contextWith(adminGrant))]) {
    test(`Given a custom access description and ${decision.allowed ? 'a missing required permission' : 'an access denial'}, when a client calls a tool, then it gets that description in the same OAuth denial before MCP work`, async (t) => {
      const dispatchSpy = t.mock.method(PerRequestHTTPServerTransport.prototype, 'handleMessage');
      const { server, tools, reporter } = serveWith(t, decision, { requiredPermission: 'product:access', accessDeniedDescription: signupGuidance });

      const response = await server.fetch(callReport(t, 'alice-token'));

      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), { error: 'access_denied', error_description: signupGuidance });
      assert.equal(response.headers.get('WWW-Authenticate'), null);
      assert.deepEqual(tools.contexts, []);
      assert.equal(dispatchSpy.mock.callCount(), 0);
      assert.deepEqual(reporter.reports, []);
    });
  }

  test('Given a custom access description, when a client has no token or an invalid token, then it gets the same Bearer challenge without access resolution or MCP work', async (t) => {
    const { server, resolver, tools } = serveWith(t, allowed(contextWith(userGrant)), { accessDeniedDescription: signupGuidance });

    for (const token of [undefined, 'invalid-token']) {
      const response = await server.fetch(callReport(t, token));
      assert.equal(response.status, 401);
      assert.match(response.headers.get('WWW-Authenticate') ?? '', /Bearer/);
      assert.ok(!(await response.text()).includes(signupGuidance));
    }
    assert.deepEqual(resolver.calls, []);
    assert.deepEqual(tools.contexts, []);
  });

  test('Given a custom access description and an access provider failure, when a client calls a tool, then it gets the generic server error with no MCP work', async (t) => {
    const { server, tools, reporter } = serveWith(t, new Error('provider failure'), { accessDeniedDescription: signupGuidance });

    const response = await server.fetch(callReport(t, 'alice-token'));

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'server_error', error_description: 'Internal Server Error' });
    assert.deepEqual(tools.contexts, []);
    assert.deepEqual(reporter.reports.map(({ step }) => step), ['access-resolution']);
  });
});
