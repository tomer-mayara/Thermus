import { localIssuer, mcpResourceUrl } from './local-access-tokens.js';
export const installationId = '0f6c1e9a-4b7d-4e2a-9c35-8d1f2a6b7e40';
export const localSettings = {
    issuer: localIssuer,
    mcpResourceUrl,
    installationId,
    resourceServerClient: { clientId: 'resource-server', clientSecret: 'resource-server-secret' },
};
// The provider operations that BetterAuthProvider uses: the key set, the handler for introspection, and the user lookup.
export class TokenProviderDouble {
    keySet;
    accounts = new Map();
    calls = [];
    requests = [];
    failures = new Map();
    auth;
    answer = { status: 200, body: JSON.stringify({ active: true, token_type: 'Bearer' }) };
    constructor(...keys) {
        this.keySet = { keys };
        this.auth = {
            handler: (request) => this.handle(request),
            api: { getJwks: async () => this.readKeySet() },
            $context: Promise.resolve({
                internalAdapter: { findUserById: async (userId) => this.findUserById(userId) },
            }),
        };
    }
    answerIntrospection(status, body) {
        this.answer = { status, body: typeof body === 'string' ? body : JSON.stringify(body) };
    }
    async handle(request) {
        this.calls.push(`handler ${request.method} ${request.url}`);
        this.requests.push({ method: request.method, url: request.url, headers: request.headers, form: new URLSearchParams(await request.text()) });
        return new Response(this.answer.body, { status: this.answer.status, headers: { 'Content-Type': 'application/json' } });
    }
    async readKeySet() {
        this.record('getJwks');
        return structuredClone(this.keySet);
    }
    async findUserById(userId) {
        this.record('findUserById', userId);
        const account = this.accounts.get(userId);
        return account === undefined ? null : { ...account };
    }
    record(operation, ...details) {
        this.calls.push([operation, ...details].join(' '));
        const failure = this.failures.get(operation);
        if (failure)
            throw failure;
    }
}
//# sourceMappingURL=token-provider-double.js.map