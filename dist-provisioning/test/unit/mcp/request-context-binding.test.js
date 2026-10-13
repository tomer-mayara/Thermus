import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { alice, allowed, bob, callReport, contextFor, serveAccess, } from './fixtures/access-test-server.js';
import { toolJson } from './fixtures/mcp-http-request.js';
import { RequestContextTools } from './fixtures/request-context-tools.js';
describe('MCPServer request context binding', () => {
    test('Given forged tenant, organization, and user values in headers and tool arguments, when a client calls a tool, then only the verified user reaches the resolver and the tool keeps the trusted context', { timeout: 5_000 }, async (t) => {
        const aliceContext = contextFor(alice, 'tenant-org-a');
        const { server, resolver } = serveAccess(t, new Map([[alice.subject, allowed(aliceContext)]]));
        const forged = { tenantId: 'tenant-org-b', organizationId: 'org-b', subject: 'user-bob' };
        const response = await server.fetch(callReport(t, 'alice-token', {
            headers: {
                'X-Tenant-Id': forged.tenantId,
                'X-Organization-Id': forged.organizationId,
                'X-Forwarded-User': forged.subject,
                Forwarded: 'for=192.0.2.1;host=evil.example',
            },
            params: { name: RequestContextTools.reportTool, arguments: forged },
        }));
        const report = await toolJson(response);
        assert.deepEqual(resolver.calls, [alice]);
        assert.deepEqual(report.context, aliceContext);
        assert.deepEqual(report.arguments, forged);
    });
    test('Given two users who share one OAuth client, when each calls a tool, then each request resolves its own user and the client ID is never a user or tenant', { timeout: 5_000 }, async (t) => {
        const { server, resolver } = serveAccess(t, new Map([
            [alice.subject, allowed(contextFor(alice, 'tenant-org-a'))],
            [bob.subject, allowed(contextFor(bob, 'tenant-org-b'))],
        ]));
        const aliceReport = await toolJson(await server.fetch(callReport(t, 'alice-token')));
        const bobReport = await toolJson(await server.fetch(callReport(t, 'bob-token')));
        assert.deepEqual(resolver.calls, [alice, bob]);
        assert.deepEqual([aliceReport.context.tenantId, bobReport.context.tenantId], ['tenant-org-a', 'tenant-org-b']);
        assert.ok(resolver.calls.every((user) => user.subject !== 'shared-client'));
        assert.ok([aliceReport, bobReport].every(({ context }) => context.tenantId !== 'shared-client'));
    });
    test('Given an allowed decision, when the resolver changes its records during the request, then the bound context keeps the decided values and is frozen', { timeout: 5_000 }, async (t) => {
        const grants = [{ role: 'user', permissions: ['product:access'] }];
        const resolverRecord = { user: alice, tenantId: 'tenant-org-a', organizationId: 'org-a', grants, permissions: ['product:access'] };
        const tools = new RequestContextTools(async () => {
            resolverRecord.tenantId = 'tenant-org-b';
            grants.push({ role: 'admin', permissions: ['user-grants:manage'] });
        });
        const { server } = serveAccess(t, new Map([[alice.subject, allowed(resolverRecord)]]), { tools });
        const report = await toolJson(await server.fetch(callReport(t, 'alice-token')));
        assert.deepEqual(report.context, contextFor(alice, 'tenant-org-a'));
        const [bound] = tools.contexts;
        assert.ok(bound !== undefined && bound !== resolverRecord);
        for (const value of [bound, bound.user, bound.grants, bound.grants[0], bound.permissions])
            assert.ok(Object.isFrozen(value));
    });
    test('Given concurrent requests from two users, when the first access resolution finishes last, then each tool gets the context of its own request', { timeout: 5_000 }, async (t) => {
        const aliceResolution = Promise.withResolvers();
        const { server, resolver, tools } = serveAccess(t, new Map([
            [alice.subject, async () => {
                    await aliceResolution.promise;
                    return allowed(contextFor(alice, 'tenant-org-a'));
                }],
            [bob.subject, allowed(contextFor(bob, 'tenant-org-b'))],
        ]));
        const aliceResponse = server.fetch(callReport(t, 'alice-token'));
        const bobReport = await toolJson(await server.fetch(callReport(t, 'bob-token')));
        aliceResolution.resolve();
        const aliceReport = await toolJson(await aliceResponse);
        assert.deepEqual(bobReport.context, contextFor(bob, 'tenant-org-b'));
        assert.deepEqual(aliceReport.context, contextFor(alice, 'tenant-org-a'));
        assert.deepEqual(new Set(resolver.calls.map(({ subject }) => subject)), new Set([alice.subject, bob.subject]));
        assert.deepEqual(tools.contexts.map(({ user }) => user.subject), [bob.subject, alice.subject]);
    });
    test('Given a request whose body arrives after its access is bound, when another user\'s request runs in between, then the slow request still gets its own context', { timeout: 5_000 }, async (t) => {
        const { server, tools } = serveAccess(t, new Map([
            [alice.subject, allowed(contextFor(alice, 'tenant-org-a'))],
            [bob.subject, allowed(contextFor(bob, 'tenant-org-b'))],
        ]));
        const bobFinished = Promise.withResolvers();
        const aliceRequest = callReport(t, 'alice-token');
        const aliceBody = new Uint8Array(await aliceRequest.arrayBuffer());
        const slowBody = new ReadableStream({
            async pull(controller) {
                await bobFinished.promise;
                controller.enqueue(aliceBody);
                controller.close();
            },
        });
        const aliceResponse = server.fetch(new Request(aliceRequest, { body: slowBody, duplex: 'half' }));
        const bobReport = await toolJson(await server.fetch(callReport(t, 'bob-token')));
        bobFinished.resolve();
        const aliceReport = await toolJson(await aliceResponse);
        assert.deepEqual(bobReport.context, contextFor(bob, 'tenant-org-b'));
        assert.deepEqual(aliceReport.context, contextFor(alice, 'tenant-org-a'));
        assert.deepEqual(tools.contexts.map(({ user }) => user.subject), [bob.subject, alice.subject]);
    });
    test('Given a tool handler that is still running, when another user\'s request starts and finishes, then the running handler keeps its own context', { timeout: 5_000 }, async (t) => {
        const aliceInHandler = Promise.withResolvers();
        const bobFinished = Promise.withResolvers();
        const tools = new RequestContextTools(async (context) => {
            if (context.user.subject !== alice.subject)
                return;
            aliceInHandler.resolve();
            await bobFinished.promise;
        });
        const { server } = serveAccess(t, new Map([
            [alice.subject, allowed(contextFor(alice, 'tenant-org-a'))],
            [bob.subject, allowed(contextFor(bob, 'tenant-org-b'))],
        ]), { tools });
        const aliceResponse = server.fetch(callReport(t, 'alice-token'));
        await aliceInHandler.promise;
        const bobReport = await toolJson(await server.fetch(callReport(t, 'bob-token')));
        bobFinished.resolve();
        const aliceReport = await toolJson(await aliceResponse);
        assert.deepEqual(bobReport.context, contextFor(bob, 'tenant-org-b'));
        assert.deepEqual(aliceReport.context, contextFor(alice, 'tenant-org-a'));
    });
});
//# sourceMappingURL=request-context-binding.test.js.map