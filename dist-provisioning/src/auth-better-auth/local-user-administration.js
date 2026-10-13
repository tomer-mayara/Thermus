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
import { applySetCookies } from 'better-auth/cookies';
const FAILURE_MESSAGES = {
    'duplicate-email': 'An account with this email address already exists.',
    'invalid-email': 'The email address is not valid.',
    'unknown-account': 'No local account has this email address.',
    'disabled-account': 'The account is disabled. Select an enabled account.',
    'incorrect-password': 'The password is not correct.',
    'no-password-login': 'The account has no password login, so its password cannot be reset.',
    'invalid-client-name': 'The client name must not be empty or contain control characters.',
    'invalid-redirect-uri': 'Give each redirect URI as an http URI on localhost, 127.0.0.1, or [::1], without user information or a fragment.',
};
// Each message is safe to show: it contains no password, hash, or token, and does not repeat the operator's input.
export class LocalAdministrationError extends Error {
    reason;
    constructor(reason, message, options) {
        super(message, options);
        this.name = 'LocalAdministrationError';
        this.reason = reason;
    }
}
// The provider returns at most 100 rows for each list call unless the caller gives a limit.
const LIST_PAGE_SIZE = 100;
const CREATE_FAILURES = new Map([
    ['USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL', 'duplicate-email'],
    ['INVALID_EMAIL', 'invalid-email'],
]);
const SIGN_IN_FAILURES = new Map([
    ['INVALID_EMAIL_OR_PASSWORD', 'incorrect-password'],
    ['BANNED_USER', 'disabled-account'],
]);
const CONTROL_CHARACTER = /\p{Cc}/u;
const LOOPBACK_REDIRECT_URI = /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?(?:[/?][^#\s\p{Cc}]*)?$/iu;
// Only supported Better Auth operations: the provider hashes each password and owns its tables.
export class LocalUserAdministration {
    auth;
    resourceServerClient;
    constructor(auth, resourceServerClient) {
        this.auth = auth;
        this.resourceServerClient = resourceServerClient;
    }
    async addUser(email, password) {
        if (await this.findAccount(email) !== undefined)
            throw failure('duplicate-email');
        const accepted = await this.acceptedPassword(password);
        try {
            const { user } = await this.auth.api.createUser({ body: { email, password: accepted, name: email } });
            return accountOf(user);
        }
        catch (error) {
            throw translated(error, CREATE_FAILURES);
        }
    }
    async listUsers() {
        const { internalAdapter } = await this.auth.$context;
        const accounts = [];
        for (let offset = 0;; offset += LIST_PAGE_SIZE) {
            const page = await internalAdapter.listUsers(LIST_PAGE_SIZE, offset, { field: 'email', direction: 'asc' });
            accounts.push(...page.map(accountOf));
            if (page.length < LIST_PAGE_SIZE)
                return accounts;
        }
    }
    async resetPassword(email, password) {
        const account = await this.requireAccount(email);
        const provider = await this.auth.$context;
        if (!await provider.internalAdapter.findCredentialAccount(account.id))
            throw failure('no-password-login');
        const hash = await provider.password.hash(await this.acceptedPassword(password));
        await provider.internalAdapter.updatePassword(account.id, hash);
        await provider.internalAdapter.deleteUserSessions(account.id);
        return account;
    }
    // Without an expiry, the provider never lifts the ban by itself.
    async disableUser(email) {
        const account = await this.requireAccount(email);
        const { internalAdapter } = await this.auth.$context;
        await internalAdapter.updateUser(account.id, { banned: true, banExpires: null });
        await internalAdapter.deleteUserSessions(account.id);
        return { ...account, disabled: true };
    }
    // The provider registers a client only for a signed-in session. The installation owns the client, so that session ends here.
    async registerClient(email, password, client) {
        const env_1 = { stack: [], error: void 0, hasError: false };
        try {
            requireApprovedClient(client);
            const account = await this.requireAccount(email);
            if (account.disabled)
                throw failure('disabled-account');
            const session = await this.signIn(account.email, await password());
            const cleanup = __addDisposableResource(env_1, new AsyncDisposableStack(), true);
            cleanup.defer(async () => (await this.auth.$context).internalAdapter.deleteSession(session.token));
            const resourceServerClientRegistered = await this.registerMissingResourceServerClient(session);
            const registered = await this.auth.api.adminCreateOAuthClient({
                headers: session.headers,
                body: {
                    client_name: client.name,
                    redirect_uris: [...client.redirectUris],
                    token_endpoint_auth_method: 'none',
                    grant_types: ['authorization_code'],
                    response_types: ['code'],
                    application_type: 'native',
                },
            });
            return { clientId: registered.client_id, name: client.name, redirectUris: [...client.redirectUris], resourceServerClientRegistered };
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
    // The provider keeps only a hash of the client secret, so the record keeps the secret for the MCP server.
    async registerMissingResourceServerClient(session) {
        if (this.resourceServerClient.current() !== undefined)
            return false;
        const registered = await this.auth.api.adminCreateOAuthClient({
            headers: session.headers,
            body: {
                client_name: 'Magumagu MCP resource server',
                token_endpoint_auth_method: 'client_secret_basic',
                grant_types: ['client_credentials'],
            },
        });
        if (!registered.client_secret)
            throw new Error('The provider gave no secret for the resource-server client.');
        this.resourceServerClient.record({ clientId: registered.client_id, clientSecret: registered.client_secret });
        return true;
    }
    async findAccount(email) {
        const found = await (await this.auth.$context).internalAdapter.findUserByEmail(email);
        return found === null ? undefined : accountOf(found.user);
    }
    async requireAccount(email) {
        const account = await this.findAccount(email);
        if (account === undefined)
            throw failure('unknown-account');
        return account;
    }
    // The provider's create operation checks only the maximum length, so this checks both limits first.
    async acceptedPassword(password) {
        const candidate = await password();
        const { minPasswordLength, maxPasswordLength } = (await this.auth.$context).password.config;
        if (candidate.length < minPasswordLength || candidate.length > maxPasswordLength) {
            throw new LocalAdministrationError('invalid-password', `The password must have ${minPasswordLength} to ${maxPasswordLength} characters.`);
        }
        return candidate;
    }
    async signIn(email, password) {
        try {
            const { headers, response } = await this.auth.api.signInEmail({ body: { email, password }, returnHeaders: true });
            const sessionHeaders = new Headers();
            applySetCookies(sessionHeaders, headers.getSetCookie());
            return { headers: sessionHeaders, token: response.token };
        }
        catch (error) {
            throw translated(error, SIGN_IN_FAILURES);
        }
    }
}
function accountOf(user) {
    return { id: user.id, email: user.email, disabled: user.banned === true };
}
function failure(reason, options) {
    return new LocalAdministrationError(reason, FAILURE_MESSAGES[reason], options);
}
function translated(error, failures) {
    const reason = failures.get(error?.body?.code);
    return reason === undefined ? error : failure(reason, { cause: error });
}
function requireApprovedClient(client) {
    if (client.name.trim() === '' || CONTROL_CHARACTER.test(client.name))
        throw failure('invalid-client-name');
    if (client.redirectUris.length === 0 || !client.redirectUris.every(isLoopbackRedirectUri))
        throw failure('invalid-redirect-uri');
}
function isLoopbackRedirectUri(uri) {
    return LOOPBACK_REDIRECT_URI.test(uri) && URL.canParse(uri);
}
//# sourceMappingURL=local-user-administration.js.map