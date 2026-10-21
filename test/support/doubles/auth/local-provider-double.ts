import type { LocalAuth, ResourceServerClient, ResourceServerClientRecord } from '../../../../src/accounts/providers/better-auth/better-auth-runtime.ts';

const SESSION_COOKIE = 'better-auth.session_token';
const EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;

interface StoredUser {
  readonly id: string;
  email: string;
  name: string;
  banned: boolean | null;
  banExpires: Date | null;
}

interface RegisteredClientRecord {
  readonly clientId: string;
  readonly sessionUserId: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

type ProviderOperation =
  | 'createUser'
  | 'signInEmail'
  | 'adminCreateOAuthClient'
  | 'updatePassword'
  | 'updateUser'
  | 'deleteUserSessions'
  | 'deleteSession';

// The shape of a Better Auth APIError that callers can read: a status and a body code.
class ProviderError extends Error {
  readonly statusCode: number;
  readonly body: { readonly code: string; readonly message: string };

  constructor(statusCode: number, code: string) {
    super(code);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.body = { code, message: code };
  }
}

interface SortBy {
  readonly field: string;
  readonly direction: 'asc' | 'desc';
}

// It holds a client at the start, so a registration creates only the native client.
class ResourceServerClientRecordDouble implements ResourceServerClientRecord {
  readonly recorded: ResourceServerClient[] = [];
  stored: ResourceServerClient | undefined = { clientId: 'stored-resource-server-client', clientSecret: 'stored-resource-server-secret' };
  readFailure: Error | undefined;
  recordFailure: Error | undefined;

  current(): ResourceServerClient | undefined {
    if (this.readFailure) throw this.readFailure;
    return this.stored;
  }

  record(client: ResourceServerClient): void {
    if (this.recordFailure) throw this.recordFailure;
    this.recorded.push(client);
    this.stored = client;
  }
}

// Its hash contains the password on purpose: a test that finds no password in the output
// also finds no hash there, and a test can see that only provider hashes reach storage.
export class LocalProviderDouble {
  readonly users = new Map<string, StoredUser>();
  readonly credentials = new Map<string, string>();
  readonly sessions = new Map<string, string>();
  readonly clients: RegisteredClientRecord[] = [];
  readonly calls: string[] = [];
  readonly listPageSizes: number[] = [];
  readonly failures = new Map<ProviderOperation, Error>();
  readonly resourceServerClient = new ResourceServerClientRecordDouble();
  readonly auth: LocalAuth;
  // When true, a confidential client gets no secret.
  withholdClientSecrets = false;
  private lastId = 0;

  constructor() {
    this.auth = {
      api: {
        createUser: (request: { body: { email: string; password?: string; name: string } }) => this.createUser(request.body),
        signInEmail: (request: { body: { email: string; password: string } }) => this.signInEmail(request.body),
        adminCreateOAuthClient: (request: { headers: Headers; body: Record<string, unknown> }) => this.createClient(request.headers, request.body),
      },
      $context: Promise.resolve({
        password: {
          hash: async (password: string) => LocalProviderDouble.hashOf(password),
          config: { minPasswordLength: 8, maxPasswordLength: 128 },
        },
        internalAdapter: {
          findUserByEmail: async (email: string) => this.findUserByEmail(email),
          listUsers: async (limit: number, offset: number, sortBy: SortBy) => this.listUsers(limit, offset, sortBy),
          findCredentialAccount: async (userId: string) => this.findCredentialAccount(userId),
          updatePassword: async (userId: string, hash: string) => this.updatePassword(userId, hash),
          updateUser: async (userId: string, data: Partial<StoredUser>) => this.updateUser(userId, data),
          deleteUserSessions: async (userId: string) => this.deleteUserSessions(userId),
          deleteSession: async (token: string) => this.deleteSession(token),
        },
      }),
    } as unknown as LocalAuth;
  }

  static hashOf(password: string): string {
    return `provider-hash:${password}`;
  }

  static clientSecretOf(clientId: string): string {
    return `client-secret:${clientId}`;
  }

  addUser(email: string, password: string | undefined, banned: boolean | null = null): StoredUser {
    this.lastId += 1;
    const user: StoredUser = { id: `user-${this.lastId}`, email: email.toLowerCase(), name: email, banned, banExpires: null };
    this.users.set(user.id, user);
    if (password !== undefined) this.credentials.set(user.id, LocalProviderDouble.hashOf(password));
    return user;
  }

  startSession(userId: string): string {
    this.lastId += 1;
    const token = `session-${this.lastId}`;
    this.sessions.set(token, userId);
    return token;
  }

  sessionsOf(userId: string): string[] {
    return [...this.sessions].filter(([, owner]) => owner === userId).map(([token]) => token);
  }

  userByEmail(email: string): StoredUser | undefined {
    return [...this.users.values()].find((user) => user.email === email.toLowerCase());
  }

  private record(operation: ProviderOperation, detail: string): void {
    this.calls.push(`${operation} ${detail}`);
    const failure = this.failures.get(operation);
    if (failure) throw failure;
  }

  private async createUser(body: { email: string; password?: string; name: string }) {
    this.record('createUser', body.email);
    if (!EMAIL.test(body.email)) throw new ProviderError(400, 'INVALID_EMAIL');
    if (this.userByEmail(body.email)) throw new ProviderError(400, 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL');
    if ((body.password?.length ?? 0) > 128) throw new ProviderError(400, 'PASSWORD_TOO_LONG');
    const user = this.addUser(body.email, body.password);
    user.name = body.name;
    return { user: { ...user, role: 'user', emailVerified: false } };
  }

  private async signInEmail(body: { email: string; password: string }) {
    this.record('signInEmail', body.email);
    const user = this.userByEmail(body.email);
    if (!user || this.credentials.get(user.id) !== LocalProviderDouble.hashOf(body.password)) {
      throw new ProviderError(401, 'INVALID_EMAIL_OR_PASSWORD');
    }
    if (user.banned === true) throw new ProviderError(403, 'BANNED_USER');
    const token = this.startSession(user.id);
    const headers = new Headers();
    headers.append('Set-Cookie', `${SESSION_COOKIE}=${token}.signature; Path=/; HttpOnly; SameSite=Lax`);
    return { headers, response: { redirect: false, token, user: { ...user } } };
  }

  private async createClient(headers: Headers, metadata: Record<string, unknown>) {
    const sessionUserId = this.sessions.get(this.sessionTokenOf(headers) ?? '');
    this.record('adminCreateOAuthClient', sessionUserId ?? 'without a session');
    if (sessionUserId === undefined) throw new ProviderError(401, 'UNAUTHORIZED');
    this.lastId += 1;
    const clientId = `client-${this.lastId}`;
    this.clients.push({ clientId, sessionUserId, metadata: structuredClone(metadata) });
    const secret = metadata.token_endpoint_auth_method === 'none' || this.withholdClientSecrets ? {} : { client_secret: LocalProviderDouble.clientSecretOf(clientId) };
    return { ...metadata, client_id: clientId, ...secret, reference_id: 'installation-id' };
  }

  private sessionTokenOf(headers: Headers): string | undefined {
    for (const pair of (headers.get('cookie') ?? '').split(/;\s*/)) {
      const [name, value = ''] = pair.split('=');
      if (name === SESSION_COOKIE) return decodeURIComponent(value).split('.')[0];
    }
    return undefined;
  }

  private async findUserByEmail(email: string) {
    const user = this.userByEmail(email);
    return user ? { user: { ...user }, accounts: [] } : null;
  }

  private async listUsers(limit: number, offset: number, sortBy: SortBy) {
    this.listPageSizes.push(limit);
    const field = sortBy.field as 'email' | 'id';
    const sorted = [...this.users.values()].sort((first, second) => first[field].localeCompare(second[field]));
    if (sortBy.direction === 'desc') sorted.reverse();
    return sorted.slice(offset, offset + limit).map((user) => ({ ...user, emailVerified: false }));
  }

  private async findCredentialAccount(userId: string) {
    const password = this.credentials.get(userId);
    return password === undefined ? null : { userId, providerId: 'credential', accountId: userId, password };
  }

  private async updatePassword(userId: string, hash: string): Promise<void> {
    this.record('updatePassword', userId);
    if (this.credentials.has(userId)) this.credentials.set(userId, hash);
  }

  private async updateUser(userId: string, data: Partial<StoredUser>) {
    this.record('updateUser', `${userId} ${JSON.stringify(data)}`);
    const user = this.users.get(userId);
    if (user) Object.assign(user, data);
    return user ? { ...user } : null;
  }

  private async deleteUserSessions(userId: string): Promise<void> {
    this.record('deleteUserSessions', userId);
    for (const token of this.sessionsOf(userId)) this.sessions.delete(token);
  }

  private async deleteSession(token: string): Promise<void> {
    this.record('deleteSession', token);
    this.sessions.delete(token);
  }
}
