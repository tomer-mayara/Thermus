const SESSION_COOKIE = 'better-auth.session_token';
const EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;
// The shape of a Better Auth APIError that callers can read: a status and a body code.
export class ProviderError extends Error {
    statusCode;
    body;
    constructor(statusCode, code) {
        super(code);
        this.name = 'APIError';
        this.statusCode = statusCode;
        this.body = { code, message: code };
    }
}
// It holds a client at the start, so a registration creates only the native client.
export class ResourceServerClientRecordDouble {
    recorded = [];
    stored = { clientId: 'stored-resource-server-client', clientSecret: 'stored-resource-server-secret' };
    readFailure;
    recordFailure;
    current() {
        if (this.readFailure)
            throw this.readFailure;
        return this.stored;
    }
    record(client) {
        if (this.recordFailure)
            throw this.recordFailure;
        this.recorded.push(client);
        this.stored = client;
    }
}
// Its hash contains the password on purpose: a test that finds no password in the output
// also finds no hash there, and a test can see that only provider hashes reach storage.
export class LocalProviderDouble {
    users = new Map();
    credentials = new Map();
    sessions = new Map();
    clients = [];
    calls = [];
    listPageSizes = [];
    failures = new Map();
    resourceServerClient = new ResourceServerClientRecordDouble();
    auth;
    // When true, a confidential client gets no secret.
    withholdClientSecrets = false;
    lastId = 0;
    constructor() {
        this.auth = {
            api: {
                createUser: (request) => this.createUser(request.body),
                signInEmail: (request) => this.signInEmail(request.body),
                adminCreateOAuthClient: (request) => this.createClient(request.headers, request.body),
            },
            $context: Promise.resolve({
                password: {
                    hash: async (password) => LocalProviderDouble.hashOf(password),
                    config: { minPasswordLength: 8, maxPasswordLength: 128 },
                },
                internalAdapter: {
                    findUserByEmail: async (email) => this.findUserByEmail(email),
                    listUsers: async (limit, offset, sortBy) => this.listUsers(limit, offset, sortBy),
                    findCredentialAccount: async (userId) => this.findCredentialAccount(userId),
                    updatePassword: async (userId, hash) => this.updatePassword(userId, hash),
                    updateUser: async (userId, data) => this.updateUser(userId, data),
                    deleteUserSessions: async (userId) => this.deleteUserSessions(userId),
                    deleteSession: async (token) => this.deleteSession(token),
                },
            }),
        };
    }
    static hashOf(password) {
        return `provider-hash:${password}`;
    }
    static clientSecretOf(clientId) {
        return `client-secret:${clientId}`;
    }
    addUser(email, password, banned = null) {
        this.lastId += 1;
        const user = { id: `user-${this.lastId}`, email: email.toLowerCase(), name: email, banned, banExpires: null };
        this.users.set(user.id, user);
        if (password !== undefined)
            this.credentials.set(user.id, LocalProviderDouble.hashOf(password));
        return user;
    }
    startSession(userId) {
        this.lastId += 1;
        const token = `session-${this.lastId}`;
        this.sessions.set(token, userId);
        return token;
    }
    sessionsOf(userId) {
        return [...this.sessions].filter(([, owner]) => owner === userId).map(([token]) => token);
    }
    userByEmail(email) {
        return [...this.users.values()].find((user) => user.email === email.toLowerCase());
    }
    record(operation, detail) {
        this.calls.push(`${operation} ${detail}`);
        const failure = this.failures.get(operation);
        if (failure)
            throw failure;
    }
    async createUser(body) {
        this.record('createUser', body.email);
        if (!EMAIL.test(body.email))
            throw new ProviderError(400, 'INVALID_EMAIL');
        if (this.userByEmail(body.email))
            throw new ProviderError(400, 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL');
        if ((body.password?.length ?? 0) > 128)
            throw new ProviderError(400, 'PASSWORD_TOO_LONG');
        const user = this.addUser(body.email, body.password);
        user.name = body.name;
        return { user: { ...user, role: 'user', emailVerified: false } };
    }
    async signInEmail(body) {
        this.record('signInEmail', body.email);
        const user = this.userByEmail(body.email);
        if (!user || this.credentials.get(user.id) !== LocalProviderDouble.hashOf(body.password)) {
            throw new ProviderError(401, 'INVALID_EMAIL_OR_PASSWORD');
        }
        if (user.banned === true)
            throw new ProviderError(403, 'BANNED_USER');
        const token = this.startSession(user.id);
        const headers = new Headers();
        headers.append('Set-Cookie', `${SESSION_COOKIE}=${token}.signature; Path=/; HttpOnly; SameSite=Lax`);
        return { headers, response: { redirect: false, token, user: { ...user } } };
    }
    async createClient(headers, metadata) {
        const sessionUserId = this.sessions.get(this.sessionTokenOf(headers) ?? '');
        this.record('adminCreateOAuthClient', sessionUserId ?? 'without a session');
        if (sessionUserId === undefined)
            throw new ProviderError(401, 'UNAUTHORIZED');
        this.lastId += 1;
        const clientId = `client-${this.lastId}`;
        this.clients.push({ clientId, sessionUserId, metadata: structuredClone(metadata) });
        const secret = metadata.token_endpoint_auth_method === 'none' || this.withholdClientSecrets ? {} : { client_secret: LocalProviderDouble.clientSecretOf(clientId) };
        return { ...metadata, client_id: clientId, ...secret, reference_id: 'installation-id' };
    }
    sessionTokenOf(headers) {
        for (const pair of (headers.get('cookie') ?? '').split(/;\s*/)) {
            const [name, value = ''] = pair.split('=');
            if (name === SESSION_COOKIE)
                return decodeURIComponent(value).split('.')[0];
        }
        return undefined;
    }
    async findUserByEmail(email) {
        const user = this.userByEmail(email);
        return user ? { user: { ...user }, accounts: [] } : null;
    }
    async listUsers(limit, offset, sortBy) {
        this.listPageSizes.push(limit);
        const field = sortBy.field;
        const sorted = [...this.users.values()].sort((first, second) => first[field].localeCompare(second[field]));
        if (sortBy.direction === 'desc')
            sorted.reverse();
        return sorted.slice(offset, offset + limit).map((user) => ({ ...user, emailVerified: false }));
    }
    async findCredentialAccount(userId) {
        const password = this.credentials.get(userId);
        return password === undefined ? null : { userId, providerId: 'credential', accountId: userId, password };
    }
    async updatePassword(userId, hash) {
        this.record('updatePassword', userId);
        if (this.credentials.has(userId))
            this.credentials.set(userId, hash);
    }
    async updateUser(userId, data) {
        this.record('updateUser', `${userId} ${JSON.stringify(data)}`);
        const user = this.users.get(userId);
        if (user)
            Object.assign(user, data);
        return user ? { ...user } : null;
    }
    async deleteUserSessions(userId) {
        this.record('deleteUserSessions', userId);
        for (const token of this.sessionsOf(userId))
            this.sessions.delete(token);
    }
    async deleteSession(token) {
        this.record('deleteSession', token);
        this.sessions.delete(token);
    }
}
//# sourceMappingURL=local-provider-double.js.map