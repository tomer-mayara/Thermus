import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import {
  createRequestContext,
  type AccessDecision,
  type AuthenticatedUser,
  type RoleGrant,
} from '../../../src/auth/access-context.ts';
import type { VerifiedIdentity } from '../../../src/mcp/identity-verifier.ts';
import { MCPServer } from '../../../src/mcp/mcp-server.ts';
import { RequestContextProbe, type ProbeReport } from '../../support/request-context-probe.ts';
import { AccessResolverMock, type ConfiguredAccess } from '../../unit/mcp/fixtures/access-resolver-mock.ts';
import { IdentityVerifierMock } from '../../unit/mcp/fixtures/identity-verifier-mock.ts';
import { mcpRequest, rpcResult, toolJson } from '../../unit/mcp/fixtures/mcp-http-request.ts';

const resourceUrl = 'https://magumagu.example/mcp';
const authority = 'https://auth.magumagu.example';
const productAccess = RequestContextProbe.requiredPermission;
const userGrant: RoleGrant = { role: 'user', permissions: [productAccess] };
const adminGrant: RoleGrant = { role: 'admin', permissions: ['user-grants:manage'] };
const nowSeconds = Math.floor(Date.now() / 1_000);
const members = ['ann', 'ben', 'cy', 'dee'].map((name, index): AuthenticatedUser => ({
  authority,
  subject: `user-${name}`,
  selectedOrganizationId: index % 2 === 0 ? 'org-a' : 'org-b',
}));

function identityFor(user: AuthenticatedUser, scopes = ['openid']): VerifiedIdentity {
  return {
    user,
    issuer: authority,
    clientId: 'shared-client',
    scopes,
    issuedAtUnixSeconds: nowSeconds - 60,
    expiresAtUnixSeconds: nowSeconds + 3_600,
    resource: new URL(resourceUrl),
  };
}

function memberAccess(user: AuthenticatedUser, grants: readonly RoleGrant[]): AccessDecision {
  const organizationId = user.selectedOrganizationId;
  return { allowed: true, context: createRequestContext({ user, tenantId: `tenant-${organizationId}`, organizationId, grants }) };
}

function serve(t: TestContext, decisions: ReadonlyMap<string, ConfiguredAccess>, probe = new RequestContextProbe()) {
  const verifier = new IdentityVerifierMock(new Map([
    ...members.map((user) => [`${user.subject}-token`, identityFor(user)] as const),
    ['scopeless-token', identityFor(members[0] as AuthenticatedUser, [])],
  ]));
  const resolver = new AccessResolverMock(decisions);
  const server = new MCPServer({
    auth: {
      verifier,
      accessResolver: resolver,
      resourceMetadataUrl: 'https://magumagu.example/.well-known/oauth-protected-resource/mcp',
      expectedResource: new URL(resourceUrl),
      requiredScopes: ['openid'],
    },
    registerTools: probe.register,
  });
  t.after(() => server.close());
  return { server, verifier, resolver, probe };
}

function callProbe(t: TestContext, token: string | undefined, url = 'https://example.com/page'): Request {
  return mcpRequest({
    url: resourceUrl,
    method: 'tools/call',
    token,
    params: { name: RequestContextProbe.toolName, arguments: { url, tenantId: 'tenant-org-b' } },
    headers: { 'X-Tenant-Id': 'tenant-org-b' },
    signal: t.signal,
  });
}

describe('MCP access context with the real access contracts', () => {
  test('Given four members in two tenants, when their requests resolve in reverse order and their protected work overlaps, then each request works only in its own trusted tenant', { timeout: 10_000 }, async (t) => {
    const gates = members.map(() => Promise.withResolvers<void>());
    const allStarted = Promise.withResolvers<void>();
    let started = 0;
    const probe = new RequestContextProbe(async () => {
      started += 1;
      if (started === members.length) allStarted.resolve();
      await allStarted.promise;
    });
    const { server } = serve(t, new Map(members.map((user, index): [string, ConfiguredAccess] => [user.subject, async () => {
      await gates[index]?.promise;
      return memberAccess(user, [userGrant]);
    }])), probe);

    const responses = members.map((user) => server.fetch(callProbe(t, `${user.subject}-token`, `https://example.com/${user.subject}`)));
    for (const gate of [...gates].reverse()) gate.resolve();
    const reports = await Promise.all(responses.map(async (response) => toolJson<ProbeReport>(await response)));

    for (const [index, report] of reports.entries()) {
      const user = members[index] as AuthenticatedUser;
      assert.deepEqual(report.context.user, user);
      assert.equal(report.context.tenantId, `tenant-${user.selectedOrganizationId}`);
    }
    assert.equal(probe.work.length, members.length * 2);
    for (const work of probe.work) {
      const owner = members.find(({ subject }) => subject === work.subject);
      assert.equal(work.tenantId, `tenant-${owner?.selectedOrganizationId}`);
      assert.equal(work.url, `https://example.com/${work.subject}`);
    }
  });

  test('Given a member whose User grant is revoked between two requests, when the member calls again with the same token, then the next request is checked again and its protected work is refused', { timeout: 10_000 }, async (t) => {
    const [ann] = members as [AuthenticatedUser];
    let grants: readonly RoleGrant[] = [userGrant, adminGrant];
    const { server, resolver, probe } = serve(t, new Map([[ann.subject, async () => memberAccess(ann, grants)]]));

    const first = await toolJson<ProbeReport>(await server.fetch(callProbe(t, `${ann.subject}-token`)));
    grants = [adminGrant];
    const second = await rpcResult(await server.fetch(callProbe(t, `${ann.subject}-token`)));

    assert.deepEqual(first.context.grants, [userGrant, adminGrant]);
    assert.equal(second.isError, true);
    assert.deepEqual(second.content, [{ type: 'text', text: 'Access denied' }]);
    assert.equal(resolver.calls.length, 2);
    assert.deepEqual(probe.work.map(({ step }) => step), ['fetch', 'clean']);
  });

  for (const { label, token, access, status } of [
    { label: 'no token', token: undefined, access: undefined, status: 401 },
    { label: 'a rejected token', token: 'forged-token', access: undefined, status: 401 },
    { label: 'a token without the required scope', token: 'scopeless-token', access: undefined, status: 403 },
    { label: 'an inactive membership', token: 'user-ann-token', access: { allowed: false, reason: 'membership-inactive' } as const, status: 403 },
    { label: 'an access lookup outage', token: 'user-ann-token', access: new Error('private outage'), status: 500 },
  ]) {
    test(`Given ${label}, when a client calls the protected tool, then the server returns ${status} and no tool, fetch, or clean step runs`, { timeout: 10_000 }, async (t) => {
      const decisions = new Map<string, ConfiguredAccess>(access === undefined ? [] : [['user-ann', access]]);
      const { server, probe } = serve(t, decisions);

      const response = await server.fetch(callProbe(t, token));

      assert.equal(response.status, status);
      assert.deepEqual(probe.contexts, []);
      assert.deepEqual(probe.work, []);
    });
  }

  test('Given Admin without User, when the member calls the protected tool, then the permission check refuses before any fetch or clean step', { timeout: 10_000 }, async (t) => {
    const [ann] = members as [AuthenticatedUser];
    const { server, probe } = serve(t, new Map([[ann.subject, memberAccess(ann, [adminGrant])]]));

    const result = await rpcResult(await server.fetch(callProbe(t, `${ann.subject}-token`)));

    assert.equal(result.isError, true);
    assert.deepEqual(result.content, [{ type: 'text', text: 'Access denied' }]);
    assert.equal(probe.contexts.length, 1);
    assert.deepEqual(probe.work, []);
  });
});
