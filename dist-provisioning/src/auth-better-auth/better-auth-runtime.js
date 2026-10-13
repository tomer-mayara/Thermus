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
import { mcp } from '@better-auth/mcp';
import { betterAuth } from 'better-auth';
import { admin } from 'better-auth/plugins/admin';
import { jwt } from 'better-auth/plugins/jwt';
import { CLIENT_ADDRESS_HEADER } from '../http/server.js';
import { lockDataDirectory } from './data-directory-lock.js';
import { openLocalInstallation } from './local-installation.js';
const PRIVATE_HTTP_PATHS = [
    '/admin/create-user',
    '/admin/list-users',
    '/admin/set-user-password',
    '/admin/ban-user',
    '/admin/revoke-user-sessions',
    '/oauth2/create-client',
    '/oauth2/get-client',
    '/oauth2/get-clients',
    '/oauth2/update-client',
    '/oauth2/client/rotate-secret',
    '/oauth2/delete-client',
    '/token',
];
// The pinned Better Auth reads these variables also when an option sets the related value. No option stops that,
// except `secrets` for BETTER_AUTH_SECRETS, and `secrets` changes the encryption format of the keys in auth.sqlite.
const REFUSED_PROVIDER_VARIABLES = {
    BETTER_AUTH_SECRETS: 'replace the secret in DATA_DIR/auth.secret',
    BETTER_AUTH_TRUSTED_ORIGINS: 'add trusted origins to the origin, CSRF, and callback URL checks',
    BETTER_AUTH_TELEMETRY: 'turn on telemetry',
};
export class ProviderEnvironmentError extends Error {
    constructor(variable, effect) {
        super(`${variable} must be empty or not set. Better Auth can use it to ${effect}. Remove it from the environment of the Magumagu process.`);
        this.name = 'ProviderEnvironmentError';
    }
}
export function localProviderOptions(settings) {
    refuseProviderVariables();
    const authBase = new URL('api/auth', settings.publicBaseUrl);
    return {
        baseURL: authBase.origin,
        basePath: authBase.pathname,
        secret: settings.secret,
        database: settings.database,
        telemetry: { enabled: false },
        emailAndPassword: { enabled: true, disableSignUp: true },
        rateLimit: { enabled: true },
        advanced: {
            ipAddress: { ipAddressHeaders: [CLIENT_ADDRESS_HEADER] },
            // Without this setting, NODE_ENV=test, or TEST with a value other than false, turns off the origin and CSRF checks.
            disableOriginCheck: false,
        },
        disabledPaths: PRIVATE_HTTP_PATHS,
        plugins: [
            admin(),
            jwt(),
            mcp({
                resource: settings.mcpResourceUrl,
                loginPage: new URL('sign-in', settings.publicBaseUrl).pathname,
                consentPage: new URL('consent', settings.publicBaseUrl).pathname,
                scopes: ['openid', 'profile', 'email'],
                grantTypes: ['authorization_code', 'client_credentials'],
                clientReference: () => settings.installationId,
            }),
        ],
    };
}
function refuseProviderVariables() {
    for (const [variable, effect] of Object.entries(REFUSED_PROVIDER_VARIABLES)) {
        if (process.env[variable])
            throw new ProviderEnvironmentError(variable, effect);
    }
}
const localAuthResources = {
    lockDataDirectory,
    openInstallation: openLocalInstallation,
    startProvider: startLocalAuth,
};
export async function openBetterAuthRuntime(settings, resources = localAuthResources) {
    const env_1 = { stack: [], error: void 0, hasError: false };
    try {
        const owned = __addDisposableResource(env_1, new AsyncDisposableStack(), true);
        owned.adopt(resources.lockDataDirectory(settings.dataDirectory), (lock) => lock.release());
        const installation = owned.adopt(resources.openInstallation(settings.dataDirectory), (opened) => opened.close());
        const auth = await resources.startProvider({
            publicBaseUrl: settings.publicBaseUrl,
            mcpResourceUrl: settings.mcpResourceUrl,
            secret: installation.secret,
            database: installation.database,
            installationId: installation.id,
        });
        const resourceServerClient = resourceServerClientRecord(installation, settings.mcpResourceUrl);
        return runtimeRecord({ installationId: installation.id, auth, resourceServerClient }, owned.move());
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
function runtimeRecord(opened, owned) {
    let closing;
    return Object.freeze({
        ...opened,
        tenantId: `local:${opened.installationId}`,
        close: () => closing ??= owned.disposeAsync(),
    });
}
function resourceServerClientRecord(installation, resource) {
    return Object.freeze({
        current: () => {
            const stored = installation.readResourceServerClient();
            return stored?.resource === resource ? { clientId: stored.clientId, clientSecret: stored.clientSecret } : undefined;
        },
        record: ({ clientId, clientSecret }) => installation.writeResourceServerClient({ clientId, clientSecret, resource }),
    });
}
function createLocalAuth(settings) {
    return betterAuth(localProviderOptions(settings));
}
// Waiting for the background schema check stops startup on a mismatch and leaves no database work running.
async function startLocalAuth(settings) {
    const auth = createLocalAuth(settings);
    const context = await auth.$context;
    await context.checkSchema?.();
    return auth;
}
//# sourceMappingURL=better-auth-runtime.js.map