import { encodeBasicCredentials, verifyJwsAccessToken } from 'better-auth/oauth2';
import { createRequestContext, } from '../auth/access-context.js';
import { CLIENT_ADDRESS_HEADER } from '../http/server.js';
import { InvalidAccessTokenError } from '../mcp/identity-verifier.js';
// Every enabled local account gets this one grant in the one installation workspace.
export const LOCAL_USER_GRANT = Object.freeze({ role: 'user', permissions: Object.freeze(['product:access']) });
const COMPACT_JWT = /^[\w-]+\.[\w-]+\.[\w-]+$/;
// jose gives these codes when the key set cannot verify any token, not when one token is bad.
const KEY_SET_FAILURES = new Set(['ERR_JWKS_INVALID', 'ERR_JWKS_MULTIPLE_MATCHING_KEYS', 'ERR_JWKS_TIMEOUT']);
const MISSING_CLIENT_MESSAGE = 'No resource-server client is registered for the MCP resource of this PUBLIC_BASE_URL, '
    + 'so no access token can be checked. Run `magumagu clients register` to register it.';
// The verifier runs in the server process. Without a client address, the provider puts it in a rate-limit bucket that all clients share.
const SERVER_PROCESS_ADDRESS = '127.0.0.1';
const ACCOUNT_INACTIVE = Object.freeze({ allowed: false, reason: 'account-inactive' });
export class BetterAuthProvider {
    authority;
    tenantId;
    auth;
    settings;
    constructor(auth, settings) {
        this.auth = auth;
        this.settings = settings;
        this.authority = `better-auth:${settings.installationId}`;
        this.tenantId = `local:${settings.installationId}`;
    }
    // The local check comes first. Introspection answers 500 for a changed payload, the key of another installation,
    // or alg none, so without it a forged token would look like a provider outage.
    async verifyAccessToken(token) {
        if (!COMPACT_JWT.test(token))
            throw new InvalidAccessTokenError('The access token is not a compact JWT');
        const claims = accessClaimsOf(await this.signedPayload(token));
        await this.requireActive(token);
        return {
            user: { authority: this.authority, subject: claims.subject },
            issuer: claims.issuer,
            clientId: claims.clientId,
            scopes: claims.scopes,
            issuedAtUnixSeconds: claims.issuedAt,
            expiresAtUnixSeconds: claims.expiresAt,
            resource: new URL(this.settings.mcpResourceUrl),
        };
    }
    // The local edition has one workspace and no organizations, so a selected organization has no effect.
    async resolve(user) {
        if (user.authority !== this.authority)
            return ACCOUNT_INACTIVE;
        const { internalAdapter } = await this.auth.$context;
        if (!isEnabled(await internalAdapter.findUserById(user.subject)))
            return ACCOUNT_INACTIVE;
        return {
            allowed: true,
            context: createRequestContext({
                user: { authority: this.authority, subject: user.subject },
                tenantId: this.tenantId,
                grants: [LOCAL_USER_GRANT],
            }),
        };
    }
    // The provider's own key set, read in the process: the check makes no network request.
    async signedPayload(token) {
        try {
            return await verifyJwsAccessToken(token, {
                jwksFetch: () => this.keySet(),
                verifyOptions: { issuer: this.settings.issuer, audience: this.settings.mcpResourceUrl, typ: 'at+jwt', algorithms: ['EdDSA'] },
            });
        }
        catch (error) {
            if (isTokenRejection(error))
                throw new InvalidAccessTokenError('The access token failed the JWT check', { cause: error });
            throw error;
        }
    }
    // The wrapper keeps a failed read, also a TypeError, from looking like a rejected token.
    async keySet() {
        try {
            return await this.auth.api.getJwks();
        }
        catch (error) {
            throw new Error('The provider could not read its key set', { cause: error });
        }
    }
    // Only introspection knows if the browser session of the token still exists.
    async requireActive(token) {
        const client = this.settings.resourceServerClient;
        if (client === undefined)
            throw new Error(MISSING_CLIENT_MESSAGE);
        const response = await this.auth.handler(introspectionRequest(this.settings.issuer, client, token));
        if (!await activeStateOf(response))
            throw new InvalidAccessTokenError('The access token is not active');
    }
}
function introspectionRequest(issuer, client, token) {
    return new Request(`${issuer}/oauth2/introspect`, {
        method: 'POST',
        headers: {
            Authorization: encodeBasicCredentials(client.clientId, client.clientSecret),
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
            [CLIENT_ADDRESS_HEADER]: SERVER_PROCESS_ADDRESS,
        },
        body: new URLSearchParams({ token, token_type_hint: 'access_token' }),
    });
}
// Each message names only the status: the body of a refusal can repeat request data.
async function activeStateOf(response) {
    if (response.status !== 200)
        throw new Error(`Token introspection failed with HTTP ${response.status}`);
    const result = await response.json().catch(() => undefined);
    const active = typeof result === 'object' && result !== null ? result.active : undefined;
    if (typeof active !== 'boolean')
        throw new Error('Token introspection answered HTTP 200 without an active state');
    return active;
}
// Each jose error code starts with ERR_J. jose throws a TypeError when the protected header of the token does not decode.
function isTokenRejection(error) {
    if (error instanceof TypeError)
        return true;
    const code = error?.code;
    return typeof code === 'string' && code.startsWith('ERR_J') && !KEY_SET_FAILURES.has(code);
}
// A local user token always has the browser session in sid. Introspection checks no session for a token without sid.
function accessClaimsOf(payload) {
    const { iss, sub, sid, client_id: clientId, scope, iat, exp } = payload;
    if (!isText(iss) || !isText(sub) || !isText(sid) || !isText(clientId) || typeof scope !== 'string' || !isTime(iat) || !isTime(exp)) {
        throw new InvalidAccessTokenError('The access token does not have the claims of a local user token');
    }
    const scopes = scope.split(' ').filter((part) => part !== '');
    return { issuer: iss, subject: sub, clientId, scopes, issuedAt: iat, expiresAt: exp };
}
// The local edition bans without an expiry, so a ban stays until the operator lifts it.
function isEnabled(user) {
    return user !== null && user.banned !== true;
}
function isText(value) {
    return typeof value === 'string' && value !== '';
}
function isTime(value) {
    return typeof value === 'number' && Number.isFinite(value);
}
//# sourceMappingURL=better-auth-provider.js.map