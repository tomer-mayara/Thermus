import { bearerAuthChallengeResponse, createMcpHandler, McpServer, OAuthError, OAuthErrorCode, requireBearerAuth, } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { IdentityVerifierSdkAdapter, verifiedUserOf } from './identity-verifier-sdk-adapter.js';
export class MCPServer {
    connection;
    contextsByRequestAuth = new WeakMap();
    httpHandler = createMcpHandler(({ authInfo }) => this.serverForRequest(authInfo));
    http;
    registerTools;
    constructor(options) {
        if (options !== undefined) {
            const { auth, reportFailure } = options;
            this.http = {
                authenticate: bearerGate(auth, reportFailure),
                resolveAccess: accessGate(auth.accessResolver, reportFailure),
            };
            this.registerTools = options.registerTools;
        }
    }
    connect(transport) {
        this.connection = serveStdio(() => serverWithoutTools(), { transport });
    }
    async fetch(request) {
        if (this.http === undefined) {
            throw new Error('HTTP authentication must be configured before serving requests');
        }
        const authInfo = await this.http.authenticate(request);
        if (authInfo instanceof Response)
            return authInfo;
        const context = await this.http.resolveAccess(authInfo);
        if (context instanceof Response)
            return context;
        return this.httpHandler.fetch(request, { authInfo: this.newRequestAuthBoundTo(context, authInfo) });
    }
    async close() {
        await Promise.all([this.httpHandler.close(), this.connection?.close()]);
    }
    newRequestAuthBoundTo(context, authInfo) {
        const requestAuth = { ...authInfo };
        this.contextsByRequestAuth.set(requestAuth, context);
        return requestAuth;
    }
    serverForRequest(authInfo) {
        const context = authInfo === undefined ? undefined : this.contextsByRequestAuth.get(authInfo);
        if (context === undefined)
            throw new Error('The MCP request has no trusted access context');
        const server = serverWithoutTools();
        this.registerTools?.(server, context);
        return server;
    }
}
function serverWithoutTools() {
    return new McpServer({ name: 'magumagu', version: '0.0.0' });
}
function bearerGate(auth, reportFailure) {
    const options = {
        verifier: new IdentityVerifierSdkAdapter(auth.verifier, (cause) => reportFailure({ step: 'token-verification', cause })),
        resourceMetadataUrl: auth.resourceMetadataUrl,
        expectedResource: auth.expectedResource,
        requiredScopes: auth.requiredScopes === undefined ? undefined : [...auth.requiredScopes],
    };
    const authenticate = requireBearerAuth(options);
    return async (request) => {
        const authorization = request.headers.get('Authorization');
        if (authorization !== null && !/^Bearer [^\s,]+$/i.test(authorization)) {
            return bearerAuthChallengeResponse(new OAuthError(OAuthErrorCode.InvalidToken, "Invalid Authorization header format, expected 'Bearer TOKEN'"), options);
        }
        return authenticate(request);
    };
}
function accessGate(resolver, reportFailure) {
    return async (authInfo) => {
        try {
            const decision = await resolver.resolve(verifiedUserOf(authInfo));
            if (decision.allowed !== true)
                return errorResponse(OAuthErrorCode.AccessDenied, 'Access denied', 403);
            return requireTrustedTenant(frozenCopy(decision.context));
        }
        catch (cause) {
            reportFailure({ step: 'access-resolution', cause });
            return errorResponse(OAuthErrorCode.ServerError, 'Internal Server Error', 500);
        }
    };
}
function requireTrustedTenant(context) {
    if (typeof context.tenantId !== 'string' || context.tenantId === '') {
        throw new Error('The access decision has no trusted tenant');
    }
    return context;
}
function frozenCopy(value) {
    return deepFreeze(structuredClone(value));
}
function deepFreeze(value) {
    if (typeof value === 'object' && value !== null) {
        for (const nested of Object.values(value))
            deepFreeze(nested);
        Object.freeze(value);
    }
    return value;
}
function errorResponse(code, description, status) {
    return Response.json(new OAuthError(code, description).toResponseObject(), { status });
}
//# sourceMappingURL=mcp-server.js.map