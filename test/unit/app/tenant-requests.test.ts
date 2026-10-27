import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { AccessResolver } from '../../../src/accounts/identity/access-context.ts';
import type { AccessContextVerification, VerifiedAccessContext } from '../../../src/accounts/identity/signed-access-context.ts';
import type { McpRequestScope } from '../../../src/interfaces/mcp/mcp-server.ts';
import { routeTenantRequests, tenantMcpHandler, type TenantMcp } from '../../../src/app/tenant-requests.ts';
import { OperatorLogSpy } from '../../support/doubles/application/operator-log-spy.ts';

const origin = 'https://tenant.example';
const context: VerifiedAccessContext = {
  authority: 'workos:client_01CONTROL', subject: 'user_01READER', organizationId: 'org_01PINNED',
  grants: [{ role: 'user', permissions: ['product:access'] }], expiresAtUnixSeconds: 4_102_444_800,
};
const denyAll: AccessResolver = { resolve: async () => ({ allowed: false, reason: 'account-inactive' }) };

// The MCP part of a tenant with doubles of the verifier, the MCP server, and the scope.
function tenantMcpOf(verification: AccessContextVerification) {
  const verified: Array<{ readonly header: string | null | undefined; readonly token: string | undefined }> = [];
  const served: Array<{ readonly request: Request; readonly scope?: McpRequestScope }> = [];
  const scopes: Array<{ readonly context: VerifiedAccessContext; readonly header: string }> = [];
  const logger = new OperatorLogSpy();
  const mcp: TenantMcp = {
    verifier: { verify: async (header, token) => { verified.push({ header, token }); return verification; } },
    server: { fetch: async (request, scope) => { served.push({ request, scope }); return new Response('MCP answer'); } },
    scopeOf: (verifiedContext, header) => { scopes.push({ context: verifiedContext, header }); return { accessResolver: denyAll }; },
    logger,
  };
  return { mcp, verified, served, scopes, logger };
}

function routesOf() {
  const mcpRequests: Request[] = [];
  const handle = routeTenantRequests({ mcpResourceUrl: `${origin}/mcp` }, async (request) => {
    mcpRequests.push(request);
    return new Response('MCP answer');
  });
  return { handle, mcpRequests };
}

describe('Tenant routes', () => {
  test('Given a tenant, when a client sends GET /healthz, then it answers 200 with ok as text that no cache keeps, without MCP handling', async () => {
    const { handle, mcpRequests } = routesOf();

    const response = await handle(new Request(`${origin}/healthz`));

    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'ok\n');
    assert.equal(response.headers.get('Content-Type'), 'text/plain; charset=utf-8');
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(mcpRequests.length, 0);
  });

  test('Given a tenant, when a client sends HEAD /healthz, then it answers 200 without a body', async () => {
    const { handle } = routesOf();

    const response = await handle(new Request(`${origin}/healthz`, { method: 'HEAD' }));

    assert.equal(response.status, 200);
    assert.equal(await response.text(), '');
  });

  test('Given a tenant, when a client sends POST /healthz, then it answers 405 with the methods of the health check', async () => {
    const { handle, mcpRequests } = routesOf();

    const response = await handle(new Request(`${origin}/healthz`, { method: 'POST' }));

    assert.equal(response.status, 405);
    assert.equal(response.headers.get('Allow'), 'GET, HEAD');
    assert.equal(mcpRequests.length, 0);
  });

  test('Given a tenant, when a client requests the MCP path, then the MCP handler gets the request', async () => {
    const { handle, mcpRequests } = routesOf();
    const request = new Request(`${origin}/mcp`, { method: 'POST' });

    const response = await handle(request);

    assert.equal(await response.text(), 'MCP answer');
    assert.deepEqual(mcpRequests, [request]);
  });

  for (const path of ['/', '/mcp/', '/healthz/x', '/.well-known/oauth-protected-resource/mcp', '/login']) {
    test(`Given a tenant, when a client requests ${path}, then it answers 404 without MCP handling`, async () => {
      const { handle, mcpRequests } = routesOf();

      const response = await handle(new Request(`${origin}${path}`));

      assert.equal(response.status, 404);
      assert.equal(mcpRequests.length, 0);
    });
  }
});

describe('Tenant MCP handler', () => {
  test('Given a verified context, when a request carries it with a bearer token, then the MCP server gets the request with the scope of that context and header', async () => {
    const tenant = tenantMcpOf({ status: 'verified', context });
    const request = new Request(`${origin}/mcp`, { method: 'POST', headers: { 'Thermus-Access': 'signed.context.value', Authorization: 'Bearer token-value' } });

    const response = await tenantMcpHandler(tenant.mcp)(request);

    assert.equal(await response.text(), 'MCP answer');
    assert.deepEqual(tenant.verified, [{ header: 'signed.context.value', token: 'token-value' }]);
    assert.deepEqual(tenant.scopes, [{ context, header: 'signed.context.value' }]);
    assert.equal(tenant.served.length, 1);
    assert.equal(tenant.served[0]?.request, request);
    assert.equal(tenant.served[0]?.scope?.accessResolver, denyAll);
    assert.deepEqual(tenant.logger.lines, []);
  });

  test('Given a refused context, when a request comes, then it answers 403 access_denied before MCP handling and logs the reason without the context or the token', async () => {
    const tenant = tenantMcpOf({ status: 'refused', reason: 'signature' });
    const request = new Request(`${origin}/mcp`, { method: 'POST', headers: { 'Thermus-Access': 'signed.context.value', Authorization: 'Bearer token-value' } });

    const response = await tenantMcpHandler(tenant.mcp)(request);

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: 'access_denied', error_description: 'Access denied' });
    assert.equal(tenant.served.length, 0);
    assert.equal(tenant.scopes.length, 0);
    assert.deepEqual(tenant.logger.lines, ['ERROR The tenant refused an MCP request before MCP handling: access context signature.']);
  });

  const unsent: ReadonlyArray<[string, Record<string, string>, string | null, string | undefined]> = [
    ['no header', {}, null, undefined],
    ['a Basic Authorization header', { 'Thermus-Access': 'signed.context.value', Authorization: 'Basic dXNlcjpwYXNz' }, 'signed.context.value', undefined],
    ['a bearer value with a space', { Authorization: 'Bearer two words' }, null, undefined],
  ];
  for (const [label, headers, header, token] of unsent) {
    test(`Given ${label}, when a request comes, then the verifier gets only what the request holds`, async () => {
      const tenant = tenantMcpOf({ status: 'refused', reason: 'missing' });

      const response = await tenantMcpHandler(tenant.mcp)(new Request(`${origin}/mcp`, { method: 'POST', headers }));

      assert.equal(response.status, 403);
      assert.deepEqual(tenant.verified, [{ header, token }]);
    });
  }
});
