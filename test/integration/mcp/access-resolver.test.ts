import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { inspect } from 'node:util';
import { PerRequestHTTPServerTransport } from '@modelcontextprotocol/server';
import type { AccessDenialReason } from '../../../src/auth/access-context.ts';
import { RequestContextTools, type ContextReport } from '../../support/doubles/mcp/context-report-tool-spy.ts';
import { mcpRequest, toolJson } from '../../support/drivers/mcp/mcp-http-request.ts';
import {
  alice,
  allowed,
  authority,
  bob,
  callReport,
  contextFor,
  identityFor,
  nowSeconds,
  resourceUrl,
  serveAccess,
} from '../../support/in-process/access-test-server.ts';

describe('MCPServer access decisions', () => {
  test('Given an allowed decision, when a client calls a tool, then the request factory binds that context once and the tool receives it with the verified claims', { timeout: 5_000 }, async (t) => {
    const aliceContext = contextFor(alice, 'tenant-org-a');
    const { server, verifier, resolver, tools } = serveAccess(t, new Map([[alice.subject, allowed(aliceContext)]]));

    const report = await toolJson<ContextReport>(await server.fetch(callReport(t, 'alice-token')));

    assert.deepEqual(report.context, aliceContext);
    assert.deepEqual(report.claims, {
      user: alice,
      issuer: authority,
      clientId: 'shared-client',
      scopes: ['openid'],
      issuedAt: nowSeconds - 60,
      expiresAt: nowSeconds + 3_600,
      audience: resourceUrl,
    });
    assert.deepEqual(verifier.calls, ['alice-token']);
    assert.deepEqual(resolver.calls, [alice]);
    assert.equal(tools.contexts.length, 1);
  });

  test('Given an earlier allowed request, when a later request has no token or a rejected token, then the later request gets 401 and no earlier context', { timeout: 5_000 }, async (t) => {
    const { server, resolver, tools } = serveAccess(t, new Map([[alice.subject, allowed(contextFor(alice, 'tenant-org-a'))]]));
    await toolJson<ContextReport>(await server.fetch(callReport(t, 'alice-token')));

    const missing = await server.fetch(callReport(t, undefined));
    const rejected = await server.fetch(callReport(t, 'forged-token'));

    assert.deepEqual([missing.status, rejected.status], [401, 401]);
    assert.equal(resolver.calls.length, 1);
    assert.equal(tools.contexts.length, 1);
  });

  for (const reason of ['account-inactive', 'organization-required', 'membership-inactive', 'permission-required'] satisfies AccessDenialReason[]) {
    for (const method of ['server/discover', 'tools/list', 'tools/call'] as const) {
      test(`Given a ${reason} denial, when a client sends ${method}, then it gets a safe 403 access_denied before the factory or MCP dispatch`, { timeout: 5_000 }, async (t) => {
        const dispatchSpy = t.mock.method(PerRequestHTTPServerTransport.prototype, 'handleMessage');
        const { server, verifier, tools, reporter } = serveAccess(t, new Map([[alice.subject, { allowed: false, reason }]]));
        const params = method === 'tools/call' ? { name: RequestContextTools.reportTool, arguments: {} } : {};

        const response = await server.fetch(mcpRequest({ url: resourceUrl, method, token: 'alice-token', params, signal: t.signal }));

        assert.equal(response.status, 403);
        assert.deepEqual(await response.json(), { error: 'access_denied', error_description: 'Access denied' });
        assert.equal(response.headers.get('WWW-Authenticate'), null);
        assert.deepEqual(verifier.calls, ['alice-token']);
        assert.deepEqual(tools.contexts, []);
        assert.equal(dispatchSpy.mock.callCount(), 0);
        assert.deepEqual(reporter.reports, []);
      });
    }
  }

  test('Given a required scope, when one token lacks the scope and another is denied access, then the SDK insufficient_scope response and the access_denied response stay distinct', { timeout: 5_000 }, async (t) => {
    const { server, resolver, reporter } = serveAccess(t, new Map([[bob.subject, { allowed: false, reason: 'membership-inactive' }]]), {
      tokens: new Map([
        ['scopeless-token', { ...identityFor(alice), scopes: [] }],
        ['bob-token', identityFor(bob)],
      ]),
      requiredScopes: ['openid'],
    });

    const missingScope = await server.fetch(callReport(t, 'scopeless-token'));
    const denied = await server.fetch(callReport(t, 'bob-token'));

    assert.equal(missingScope.status, 403);
    assert.deepEqual(await missingScope.json(), { error: 'insufficient_scope', error_description: 'Insufficient scope' });
    assert.match(missingScope.headers.get('WWW-Authenticate') ?? '', /error="insufficient_scope"/);
    assert.equal(denied.status, 403);
    assert.deepEqual(await denied.json(), { error: 'access_denied', error_description: 'Access denied' });
    assert.equal(denied.headers.get('WWW-Authenticate'), null);
    assert.deepEqual(resolver.calls, [bob]);
    assert.deepEqual(reporter.reports, []);
  });

  for (const { label, access } of [
    { label: 'an access lookup failure with private details', access: new Error('private membership store failure for user-alice') },
    { label: 'an allowed decision without a trusted tenant', access: allowed({ ...contextFor(alice, 'tenant-org-a'), tenantId: '' }) },
  ]) {
    test(`Given ${label}, when a client calls a tool, then it gets a generic 500 and no factory or MCP dispatch`, { timeout: 5_000 }, async (t) => {
      const dispatchSpy = t.mock.method(PerRequestHTTPServerTransport.prototype, 'handleMessage');
      const { server, tools } = serveAccess(t, new Map([[alice.subject, access]]));

      const response = await server.fetch(callReport(t, 'alice-token'));
      const body = await response.text();

      assert.equal(response.status, 500);
      assert.deepEqual(JSON.parse(body), { error: 'server_error', error_description: 'Internal Server Error' });
      assert.doesNotMatch(body, /private|user-alice|tenant/);
      assert.deepEqual(tools.contexts, []);
      assert.equal(dispatchSpy.mock.callCount(), 0);
    });
  }

  test('Given an access lookup failure, when a client calls a tool, then the client still gets the generic 500 and the operator gets one access-resolution report that keeps the cause', { timeout: 5_000 }, async (t) => {
    const failure = new Error('private membership store failure for user-alice');
    const { server, reporter } = serveAccess(t, new Map([[alice.subject, failure]]));

    const response = await server.fetch(callReport(t, 'alice-token'));

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'server_error', error_description: 'Internal Server Error' });
    assert.deepEqual(reporter.reports.map(({ step }) => step), ['access-resolution']);
    assert.equal(reporter.reports[0]?.cause, failure);
  });

  test('Given an allowed decision without a trusted tenant, when a client calls a tool, then the operator gets one access-resolution report about the missing tenant', { timeout: 5_000 }, async (t) => {
    const { server, reporter } = serveAccess(t, new Map([[alice.subject, allowed({ ...contextFor(alice, 'tenant-org-a'), tenantId: '' })]]));

    const response = await server.fetch(callReport(t, 'alice-token'));

    assert.equal(response.status, 500);
    assert.deepEqual(reporter.reports.map(({ step }) => step), ['access-resolution']);
    assert.match(String(reporter.reports[0]?.cause), /no trusted tenant/);
  });

  test('Given a bearer token, a session cookie, and passwords in the request, when access resolution fails unexpectedly, then the report holds none of these credentials', { timeout: 5_000 }, async (t) => {
    const { server, reporter } = serveAccess(t, new Map([[alice.subject, new Error('membership store unavailable')]]), {
      tokens: new Map([['secret-alice-token', identityFor(alice)]]),
    });

    const response = await server.fetch(callReport(t, 'secret-alice-token', {
      params: { name: RequestContextTools.reportTool, arguments: { password: 'secret-password' } },
      headers: { Cookie: 'session=secret-session-cookie', 'Proxy-Authorization': 'Basic secret-proxy-password' },
    }));

    assert.equal(response.status, 500);
    assert.equal(reporter.reports.length, 1);
    assert.doesNotMatch(inspect(reporter.reports, { depth: Infinity }), /secret/);
  });
});
