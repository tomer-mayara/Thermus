import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { AccessResolverSpy } from '../../support/doubles/auth/access-resolver-spy.ts';
import { ContextReportToolSpy, type ContextReport } from '../../support/doubles/mcp/context-report-tool-spy.ts';
import { toolJson } from '../../support/drivers/mcp/mcp-http-request.ts';
import { alice, allowed, callReport, contextFor, serveAccess } from '../../support/in-process/access-test-server.ts';

describe('MCPServer request scope', () => {
  test('Given a request scope with its own access resolver and tool server, when the request calls a tool, then MCPServer resolves access with the scope and builds the tool server of the scope, and the configured resolver gets no call', { timeout: 5_000 }, async (t) => {
    const { server, resolver, tools } = serveAccess(t, new Map());
    const scopeContext = contextFor(alice, 'tenant-of-the-scope');
    const scope = { accessResolver: new AccessResolverSpy(new Map([[alice.subject, allowed(scopeContext)]])), tools: new ContextReportToolSpy() };

    const report = await toolJson<ContextReport>(await server.fetch(callReport(t, 'alice-token'), { accessResolver: scope.accessResolver, buildServer: scope.tools.buildServer }));

    assert.deepEqual(report.context, scopeContext);
    assert.deepEqual(scope.accessResolver.calls, [alice]);
    assert.equal(scope.tools.contexts.length, 1);
    assert.deepEqual([resolver.calls, tools.contexts], [[], []]);
  });

  test('Given a scope for one request, when the next request comes without a scope, then it gets the configured access and tool server', { timeout: 5_000 }, async (t) => {
    const { server, resolver, tools } = serveAccess(t, new Map([[alice.subject, allowed(contextFor(alice, 'tenant-of-the-options'))]]));
    const scoped = new AccessResolverSpy(new Map([[alice.subject, allowed(contextFor(alice, 'tenant-of-the-scope'))]]));
    await toolJson<ContextReport>(await server.fetch(callReport(t, 'alice-token'), { accessResolver: scoped }));

    const report = await toolJson<ContextReport>(await server.fetch(callReport(t, 'alice-token')));

    assert.equal(report.context.tenantId, 'tenant-of-the-options');
    assert.deepEqual([scoped.calls.length, resolver.calls.length, tools.contexts.length], [1, 1, 2]);
  });

  test('Given a request scope, when the bearer token is missing or rejected, then the bearer refusal comes first and the scope gets no call', { timeout: 5_000 }, async (t) => {
    const { server } = serveAccess(t, new Map());
    const scoped = new AccessResolverSpy(new Map([[alice.subject, allowed(contextFor(alice, 'tenant-of-the-scope'))]]));

    const missing = await server.fetch(callReport(t, undefined), { accessResolver: scoped });
    const rejected = await server.fetch(callReport(t, 'forged-token'), { accessResolver: scoped });

    assert.deepEqual([missing.status, rejected.status], [401, 401]);
    assert.deepEqual(scoped.calls, []);
  });

  test('Given a request scope whose resolver denies, when the request calls a tool, then it gets 403 access_denied and no tool server', { timeout: 5_000 }, async (t) => {
    const { server, tools } = serveAccess(t, new Map([[alice.subject, allowed(contextFor(alice, 'tenant-of-the-options'))]]));
    const scope = { accessResolver: new AccessResolverSpy(new Map([[alice.subject, { allowed: false, reason: 'organization-required' }]])), tools: new ContextReportToolSpy() };

    const response = await server.fetch(callReport(t, 'alice-token'), { accessResolver: scope.accessResolver, buildServer: scope.tools.buildServer });

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: 'access_denied', error_description: 'Access denied' });
    assert.deepEqual([scope.tools.contexts, tools.contexts], [[], []]);
  });
});
