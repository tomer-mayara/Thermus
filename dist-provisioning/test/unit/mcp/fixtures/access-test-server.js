import { MCPServer } from '../../../../src/mcp/mcp-server.js';
import { AccessResolverMock } from './access-resolver-mock.js';
import { FailureReporterMock } from './failure-reporter-mock.js';
import { IdentityVerifierMock } from './identity-verifier-mock.js';
import { mcpRequest } from './mcp-http-request.js';
import { RequestContextTools } from './request-context-tools.js';
export const resourceUrl = 'https://magumagu.example/mcp';
const resourceMetadataUrl = 'https://magumagu.example/.well-known/oauth-protected-resource/mcp';
export const authority = 'https://auth.magumagu.example';
export const nowSeconds = Math.floor(Date.now() / 1_000);
export const alice = { authority, subject: 'user-alice', selectedOrganizationId: 'org-a' };
export const bob = { authority, subject: 'user-bob', selectedOrganizationId: 'org-b' };
export function identityFor(user) {
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
export function contextFor(user, tenantId) {
    return {
        user,
        tenantId,
        organizationId: user.selectedOrganizationId,
        grants: [{ role: 'user', permissions: ['product:access'] }],
        permissions: ['product:access'],
    };
}
export function allowed(context) {
    return { allowed: true, context };
}
export function serveAccess(t, decisions, options = {}) {
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
        registerTools: tools.register,
        reportFailure: reporter.report,
    });
    t.after(() => server.close());
    return { server, verifier, resolver, tools, reporter };
}
export function callReport(t, token, extra = {}) {
    return mcpRequest({
        url: resourceUrl,
        method: 'tools/call',
        token,
        params: { name: RequestContextTools.reportTool, arguments: {} },
        signal: t.signal,
        ...extra,
    });
}
//# sourceMappingURL=access-test-server.js.map