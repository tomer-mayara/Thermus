import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createRequestContext, } from '../../../src/auth/access-context.js';
import { MCPServer } from '../../../src/mcp/mcp-server.js';
import { RequestContextProbe } from '../../support/request-context-probe.js';
import { AccessResolverMock } from '../../unit/mcp/fixtures/access-resolver-mock.js';
import { FailureReporterMock } from '../../unit/mcp/fixtures/failure-reporter-mock.js';
import { IdentityVerifierMock } from '../../unit/mcp/fixtures/identity-verifier-mock.js';
import { mcpRequest, rpcResult, toolJson } from '../../unit/mcp/fixtures/mcp-http-request.js';
const resourceUrl = 'https://magumagu.example/mcp';
const authority = 'https://auth.magumagu.example';
const productAccess = RequestContextProbe.requiredPermission;
const userGrant = { role: 'user', permissions: [productAccess] };
const adminGrant = { role: 'admin', permissions: ['user-grants:manage'] };
const nowSeconds = Math.floor(Date.now() / 1_000);
const members = ['ann', 'ben', 'cy', 'dee'].map((name, index) => ({
    authority,
    subject: `user-${name}`,
    selectedOrganizationId: index % 2 === 0 ? 'org-a' : 'org-b',
}));
function identityFor(user, scopes = ['openid']) {
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
function memberAccess(user, grants) {
    const organizationId = user.selectedOrganizationId;
    return { allowed: true, context: createRequestContext({ user, tenantId: `tenant-${organizationId}`, organizationId, grants }) };
}
function serve(t, decisions, probe = new RequestContextProbe()) {
    const verifier = new IdentityVerifierMock(new Map([
        ...members.map((user) => [`${user.subject}-token`, identityFor(user)]),
        ['scopeless-token', identityFor(members[0], [])],
    ]));
    const resolver = new AccessResolverMock(decisions);
    const reporter = new FailureReporterMock();
    const server = new MCPServer({
        auth: {
            verifier,
            accessResolver: resolver,
            resourceMetadataUrl: 'https://magumagu.example/.well-known/oauth-protected-resource/mcp',
            expectedResource: new URL(resourceUrl),
            requiredScopes: ['openid'],
        },
        registerTools: probe.register,
        reportFailure: reporter.report,
    });
    t.after(() => server.close());
    return { server, verifier, resolver, probe, reporter };
}
function callProbe(t, token, url = 'https://example.com/page') {
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
        const gates = members.map(() => Promise.withResolvers());
        const allStarted = Promise.withResolvers();
        let started = 0;
        const probe = new RequestContextProbe(async () => {
            started += 1;
            if (started === members.length)
                allStarted.resolve();
            await allStarted.promise;
        });
        const { server } = serve(t, new Map(members.map((user, index) => [user.subject, async () => {
                await gates[index]?.promise;
                return memberAccess(user, [userGrant]);
            }])), probe);
        const responses = members.map((user) => server.fetch(callProbe(t, `${user.subject}-token`, `https://example.com/${user.subject}`)));
        for (const gate of [...gates].reverse())
            gate.resolve();
        const reports = await Promise.all(responses.map(async (response) => toolJson(await response)));
        for (const [index, report] of reports.entries()) {
            const user = members[index];
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
        const [ann] = members;
        let grants = [userGrant, adminGrant];
        const { server, resolver, probe } = serve(t, new Map([[ann.subject, async () => memberAccess(ann, grants)]]));
        const first = await toolJson(await server.fetch(callProbe(t, `${ann.subject}-token`)));
        grants = [adminGrant];
        const second = await rpcResult(await server.fetch(callProbe(t, `${ann.subject}-token`)));
        assert.deepEqual(first.context.grants, [userGrant, adminGrant]);
        assert.equal(second.isError, true);
        assert.deepEqual(second.content, [{ type: 'text', text: 'Access denied' }]);
        assert.equal(resolver.calls.length, 2);
        assert.deepEqual(probe.work.map(({ step }) => step), ['fetch', 'clean']);
    });
    const lookupOutage = new Error('private outage');
    for (const { label, token, access, status, reports } of [
        { label: 'no token', token: undefined, access: undefined, status: 401, reports: [] },
        { label: 'a rejected token', token: 'forged-token', access: undefined, status: 401, reports: [] },
        { label: 'a token without the required scope', token: 'scopeless-token', access: undefined, status: 403, reports: [] },
        { label: 'an inactive membership', token: 'user-ann-token', access: { allowed: false, reason: 'membership-inactive' }, status: 403, reports: [] },
        { label: 'an access lookup outage', token: 'user-ann-token', access: lookupOutage, status: 500, reports: [{ step: 'access-resolution', cause: lookupOutage }] },
    ]) {
        test(`Given ${label}, when a client calls the protected tool, then the server returns ${status}, no tool, fetch, or clean step runs, and the operator gets ${reports.length === 0 ? 'no failure report' : 'one access-resolution report'}`, { timeout: 10_000 }, async (t) => {
            const decisions = new Map(access === undefined ? [] : [['user-ann', access]]);
            const { server, probe, reporter } = serve(t, decisions);
            const response = await server.fetch(callProbe(t, token));
            assert.equal(response.status, status);
            assert.deepEqual(probe.contexts, []);
            assert.deepEqual(probe.work, []);
            assert.deepEqual(reporter.reports, reports);
        });
    }
    test('Given Admin without User, when the member calls the protected tool, then the permission check refuses before any fetch or clean step', { timeout: 10_000 }, async (t) => {
        const [ann] = members;
        const { server, probe } = serve(t, new Map([[ann.subject, memberAccess(ann, [adminGrant])]]));
        const result = await rpcResult(await server.fetch(callProbe(t, `${ann.subject}-token`)));
        assert.equal(result.isError, true);
        assert.deepEqual(result.content, [{ type: 'text', text: 'Access denied' }]);
        assert.equal(probe.contexts.length, 1);
        assert.deepEqual(probe.work, []);
    });
});
//# sourceMappingURL=mcp-context.test.js.map