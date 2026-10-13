var __addDisposableResource = (this && this.__addDisposableResource) || function (env, value, async) {
    if (value !== null && value !== void 0) {
        if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
        var dispose, inner;
        if (async) {
            if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
            dispose = value[Symbol.asyncDispose];
        }
        if (dispose === void 0) {
            if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
            dispose = value[Symbol.dispose];
            if (async) inner = dispose;
        }
        if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
        if (inner) dispose = function() { try { inner.call(this); } catch (e) { return Promise.reject(e); } };
        env.stack.push({ value: value, dispose: dispose, async: async });
    }
    else if (async) {
        env.stack.push({ async: true });
    }
    return value;
};
var __disposeResources = (this && this.__disposeResources) || (function (SuppressedError) {
    return function (env) {
        function fail(e) {
            env.error = env.hasError ? new SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
            env.hasError = true;
        }
        var r, s = 0;
        function next() {
            while (r = env.stack.pop()) {
                try {
                    if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
                    if (r.dispose) {
                        var result = r.dispose.call(r.value);
                        if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) { fail(e); return next(); });
                    }
                    else s |= 1;
                }
                catch (e) {
                    fail(e);
                }
            }
            if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
            if (env.hasError) throw env.error;
        }
        return next();
    };
})(typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
});
import { InvalidAccessTokenError } from './mcp/identity-verifier.js';
import { MCPServer } from './mcp/mcp-server.js';
export class HostedEditionUnavailableError extends Error {
    constructor() {
        super('The hosted edition is not available in this version of Magumagu.');
        this.name = 'HostedEditionUnavailableError';
    }
}
// Token introspection needs a confidential resource-server client. The local auth command registers only native MCP clients.
const acceptsNoAccessToken = {
    verifyAccessToken: async () => {
        throw new InvalidAccessTokenError('The self-hosted edition accepts no MCP access token yet');
    },
};
const deniesEveryUser = {
    resolve: async () => ({ allowed: false, reason: 'account-inactive' }),
};
export async function createApplication(config, logger) {
    if (config.deployment === 'hosted')
        throw new HostedEditionUnavailableError();
    return createSelfHostedApplication(config, logger);
}
export function operatorFailureReporter(logger) {
    return ({ step, cause }) => logger.error(`An MCP request failed unexpectedly in ${step}: ${String(cause)}`);
}
async function createSelfHostedApplication(config, logger) {
    const env_1 = { stack: [], error: void 0, hasError: false };
    try {
        const { openBetterAuthRuntime } = await import('./auth-better-auth/better-auth-runtime.js');
        const owned = __addDisposableResource(env_1, new AsyncDisposableStack(), true);
        const runtime = owned.adopt(await openBetterAuthRuntime(config), (opened) => opened.close());
        const mcp = owned.adopt(new MCPServer({
            auth: {
                verifier: acceptsNoAccessToken,
                accessResolver: deniesEveryUser,
                resourceMetadataUrl: config.resourceMetadataUrl,
                expectedResource: new URL(config.mcpResourceUrl),
            },
            reportFailure: operatorFailureReporter(logger),
        }), (server) => server.close());
        logger.info(`The self-hosted installation uses tenant ${runtime.tenantId}.`);
        return applicationRecord(routeRequests(new URL(config.mcpResourceUrl).pathname, mcp), owned.move());
    }
    catch (e_1) {
        env_1.error = e_1;
        env_1.hasError = true;
    }
    finally {
        const result_1 = __disposeResources(env_1);
        if (result_1)
            await result_1;
    }
}
function routeRequests(mcpPath, mcp) {
    return async (request) => {
        if (new URL(request.url).pathname === mcpPath)
            return mcp.fetch(request);
        return new Response('Not Found', { status: 404 });
    };
}
function applicationRecord(handle, owned) {
    let closing;
    return Object.freeze({ handle, close: () => closing ??= owned.disposeAsync() });
}
//# sourceMappingURL=application.js.map