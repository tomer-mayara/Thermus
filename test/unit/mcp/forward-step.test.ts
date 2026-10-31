import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { test } from 'node:test';
import { MCPServer, type McpForwardedRequest } from '../../../src/interfaces/mcp/mcp-server.ts';
import { AccessResolverSpy } from '../../support/doubles/auth/access-resolver-spy.ts';
import { IdentityVerifierSpy } from '../../support/doubles/auth/identity-verifier-spy.ts';
import { ContextReportToolSpy } from '../../support/doubles/mcp/context-report-tool-spy.ts';
import { FailureReporterSpy } from '../../support/doubles/mcp/failure-reporter-spy.ts';
import { mcpRequest } from '../../support/drivers/mcp/mcp-http-request.ts';
import { alice, allowed, contextFor, identityFor, resourceUrl } from '../../support/in-process/access-test-server.ts';

function forwardingServer(t: TestContext, decision = allowed(contextFor(alice, 'tenant-org-a'))) {
  const forwarded: Array<{ readonly request: Request; readonly access: McpForwardedRequest }> = [];
  const tools = new ContextReportToolSpy();
  const server = new MCPServer({
    auth: {
      verifier: new IdentityVerifierSpy(new Map([['alice-token', identityFor(alice)]])),
      accessResolver: new AccessResolverSpy(new Map([[alice.subject, decision]])),
      resourceMetadataUrl: 'https://thermus.example/.well-known/oauth-protected-resource/mcp',
      expectedResource: new URL(resourceUrl),
      requiredPermission: 'product:access',
    },
    buildServer: tools.buildServer,
    forward: async (request, access) => {
      forwarded.push({ request, access });
      return new Response('from the forward step', { status: 299 });
    },
    reportFailure: new FailureReporterSpy().report,
  });
  t.after(() => server.close());
  return { server, forwarded, tools };
}

test('Given a forward step, when a request passes the bearer check and the access check, then the step answers it with the frozen context, the bearer token, and the lifetime of the request, and no local MCP server runs', async (t) => {
  const { server, forwarded, tools } = forwardingServer(t);

  const response = await server.fetch(mcpRequest({ url: resourceUrl, method: 'tools/call', token: 'alice-token', params: { name: ContextReportToolSpy.reportTool, arguments: {} } }));

  assert.deepEqual([response.status, await response.text()], [299, 'from the forward step']);
  const [call] = forwarded;
  assert.deepEqual(call?.access.context, contextFor(alice, 'tenant-org-a'));
  assert.ok(Object.isFrozen(call?.access.context));
  assert.equal(call?.access.bearerToken, 'alice-token');
  assert.equal(call?.request.method, 'POST');
  assert.equal(call?.access.lifetime.signal.aborted, false);
  assert.deepEqual(tools.contexts, []);
});

test('Given a forward step, when the bearer check or the access check refuses a request, then the step gets nothing and the client gets the refusal of today', async (t) => {
  const { server, forwarded } = forwardingServer(t, { allowed: false, reason: 'membership-inactive' } as const);

  const unauthenticated = await server.fetch(mcpRequest({ url: resourceUrl, method: 'tools/call' }));
  const denied = await server.fetch(mcpRequest({ url: resourceUrl, method: 'tools/call', token: 'alice-token' }));

  assert.equal(unauthenticated.status, 401);
  assert.equal(denied.status, 403);
  assert.deepEqual(forwarded, []);
});

test('Given a forward step that tracks work in the lifetime of its request, when the server closes, then the lifetime signal aborts and close waits for that work', async (t) => {
  const { server, forwarded } = forwardingServer(t);
  await server.fetch(mcpRequest({ url: resourceUrl, method: 'tools/call', token: 'alice-token' }));
  const lifetime = forwarded[0]?.access.lifetime;
  assert.ok(lifetime !== undefined);
  let workEnded = false;
  lifetime.track(new Promise<void>((resolve) => lifetime.signal.addEventListener('abort', () => setTimeout(() => { workEnded = true; resolve(); }, 20), { once: true })));

  await server.close();

  assert.equal(lifetime.signal.aborted, true);
  assert.equal(workEnded, true);
});
