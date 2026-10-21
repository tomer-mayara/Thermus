import { applySetCookies } from 'better-auth/cookies';
import type { LocalAccount, ApprovedClient, RegisteredClient, PasswordSource, LocalAuthSettings, OpenedLocalAdministration, LocalUserAdministration as AdministrationRole } from '../../identity/local-user-administration.ts';
import { openBetterAuthRuntime, type BetterAuthRuntime, type LocalAuth, type ResourceServerClientRecord } from './better-auth-runtime.ts';

export async function openBetterAuthAdministration(
  settings: LocalAuthSettings,
  openRuntime: (settings: LocalAuthSettings) => Promise<BetterAuthRuntime> = openBetterAuthRuntime,
): Promise<OpenedLocalAdministration> {
  await using owned = new AsyncDisposableStack();
  const runtime = owned.adopt(await openRuntime(settings), (opened) => opened.close());
  const administration = new BetterAuthUserAdministration(runtime.auth, runtime.resourceServerClient);
  const opened = { administration, close: () => runtime.close() };
  // The returned close owns the runtime, so the opener no longer rolls it back.
  owned.move();
  return opened;
}

const FAILURE_MESSAGES = {
  'duplicate-email': 'An account with this email address already exists.',
  'invalid-email': 'The email address is not valid.',
  'unknown-account': 'No local account has this email address.',
  'disabled-account': 'The account is disabled. Select an enabled account.',
  'incorrect-password': 'The password is not correct.',
  'no-password-login': 'The account has no password login, so its password cannot be reset.',
  'invalid-client-name': 'The client name must not be empty or contain control characters.',
  'invalid-redirect-uri': 'Give each redirect URI as an http URI on localhost, 127.0.0.1, or [::1], without user information or a fragment.',
} as const;

type StaticFailure = keyof typeof FAILURE_MESSAGES;

export type AdministrationFailure = StaticFailure | 'invalid-password';

// Each message is safe to show: it contains no password, hash, or token, and does not repeat the operator's input.
export class LocalAdministrationError extends Error {
  readonly reason: AdministrationFailure;

  constructor(reason: AdministrationFailure, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'LocalAdministrationError';
    this.reason = reason;
  }
}

interface ProviderUser {
  readonly id: string;
  readonly email: string;
  readonly banned?: boolean | null;
}

interface RegistrationSession {
  readonly headers: Headers;
  readonly token: string;
}

// The provider returns at most 100 rows for each list call unless the caller gives a limit.
const LIST_PAGE_SIZE = 100;
const CREATE_FAILURES = new Map<unknown, StaticFailure>([
  ['USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL', 'duplicate-email'],
  ['INVALID_EMAIL', 'invalid-email'],
]);
const SIGN_IN_FAILURES = new Map<unknown, StaticFailure>([
  ['INVALID_EMAIL_OR_PASSWORD', 'incorrect-password'],
  ['BANNED_USER', 'disabled-account'],
]);
const CONTROL_CHARACTER = /\p{Cc}/u;
const LOOPBACK_REDIRECT_URI = /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?(?:[/?][^#\s\p{Cc}]*)?$/iu;

// Only supported Better Auth operations: the provider hashes each password and owns its tables.
export class BetterAuthUserAdministration implements AdministrationRole {
  private readonly auth: LocalAuth;
  private readonly resourceServerClient: ResourceServerClientRecord;

  constructor(auth: LocalAuth, resourceServerClient: ResourceServerClientRecord) {
    this.auth = auth;
    this.resourceServerClient = resourceServerClient;
  }

  async addUser(email: string, password: PasswordSource): Promise<LocalAccount> {
    if (await this.findAccount(email) !== undefined) throw failure('duplicate-email');
    const accepted = await this.acceptedPassword(password);
    try {
      const { user } = await this.auth.api.createUser({ body: { email, password: accepted, name: email } });
      return accountOf(user);
    } catch (error) {
      throw translated(error, CREATE_FAILURES);
    }
  }

  async listUsers(): Promise<LocalAccount[]> {
    const { internalAdapter } = await this.auth.$context;
    const accounts: LocalAccount[] = [];
    for (let offset = 0; ; offset += LIST_PAGE_SIZE) {
      const page = await internalAdapter.listUsers(LIST_PAGE_SIZE, offset, { field: 'email', direction: 'asc' });
      accounts.push(...page.map(accountOf));
      if (page.length < LIST_PAGE_SIZE) return accounts;
    }
  }

  async resetPassword(email: string, password: PasswordSource): Promise<LocalAccount> {
    const account = await this.requireAccount(email);
    const provider = await this.auth.$context;
    if (!await provider.internalAdapter.findCredentialAccount(account.id)) throw failure('no-password-login');
    const hash = await provider.password.hash(await this.acceptedPassword(password));
    await provider.internalAdapter.updatePassword(account.id, hash);
    await provider.internalAdapter.deleteUserSessions(account.id);
    return account;
  }

  // Without an expiry, the provider never lifts the ban by itself.
  async disableUser(email: string): Promise<LocalAccount> {
    const account = await this.requireAccount(email);
    const { internalAdapter } = await this.auth.$context;
    await internalAdapter.updateUser(account.id, { banned: true, banExpires: null });
    await internalAdapter.deleteUserSessions(account.id);
    return { ...account, disabled: true };
  }

  // The provider registers a client only for a signed-in session. The installation owns the client, so that session ends here.
  async registerClient(email: string, password: PasswordSource, client: ApprovedClient): Promise<RegisteredClient> {
    requireApprovedClient(client);
    const account = await this.requireAccount(email);
    if (account.disabled) throw failure('disabled-account');
    const session = await this.signIn(account.email, await password());
    await using cleanup = new AsyncDisposableStack();
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

  // The provider keeps only a hash of the client secret, so the record keeps the secret for the MCP server.
  private async registerMissingResourceServerClient(session: RegistrationSession): Promise<boolean> {
    if (this.resourceServerClient.current() !== undefined) return false;
    const registered = await this.auth.api.adminCreateOAuthClient({
      headers: session.headers,
      body: {
        client_name: 'Thermus MCP resource server',
        token_endpoint_auth_method: 'client_secret_basic',
        grant_types: ['client_credentials'],
      },
    });
    if (!registered.client_secret) throw new Error('The provider gave no secret for the resource-server client.');
    this.resourceServerClient.record({ clientId: registered.client_id, clientSecret: registered.client_secret });
    return true;
  }

  private async findAccount(email: string): Promise<LocalAccount | undefined> {
    const found = await (await this.auth.$context).internalAdapter.findUserByEmail(email);
    return found === null ? undefined : accountOf(found.user);
  }

  private async requireAccount(email: string): Promise<LocalAccount> {
    const account = await this.findAccount(email);
    if (account === undefined) throw failure('unknown-account');
    return account;
  }

  // The provider's create operation checks only the maximum length, so this checks both limits first.
  private async acceptedPassword(password: PasswordSource): Promise<string> {
    const candidate = await password();
    const { minPasswordLength, maxPasswordLength } = (await this.auth.$context).password.config;
    if (candidate.length < minPasswordLength || candidate.length > maxPasswordLength) {
      throw new LocalAdministrationError('invalid-password', `The password must have ${minPasswordLength} to ${maxPasswordLength} characters.`);
    }
    return candidate;
  }

  private async signIn(email: string, password: string): Promise<RegistrationSession> {
    try {
      const { headers, response } = await this.auth.api.signInEmail({ body: { email, password }, returnHeaders: true });
      const sessionHeaders = new Headers();
      applySetCookies(sessionHeaders, headers.getSetCookie());
      return { headers: sessionHeaders, token: response.token };
    } catch (error) {
      throw translated(error, SIGN_IN_FAILURES);
    }
  }
}

function accountOf(user: ProviderUser): LocalAccount {
  return { id: user.id, email: user.email, disabled: user.banned === true };
}

function failure(reason: StaticFailure, options?: ErrorOptions): LocalAdministrationError {
  return new LocalAdministrationError(reason, FAILURE_MESSAGES[reason], options);
}

function translated(error: unknown, failures: ReadonlyMap<unknown, StaticFailure>): unknown {
  const reason = failures.get((error as { body?: { code?: unknown } } | null)?.body?.code);
  return reason === undefined ? error : failure(reason, { cause: error });
}

function requireApprovedClient(client: ApprovedClient): void {
  if (client.name.trim() === '' || CONTROL_CHARACTER.test(client.name)) throw failure('invalid-client-name');
  if (client.redirectUris.length === 0 || !client.redirectUris.every(isLoopbackRedirectUri)) throw failure('invalid-redirect-uri');
}

function isLoopbackRedirectUri(uri: string): boolean {
  return LOOPBACK_REDIRECT_URI.test(uri) && URL.canParse(uri);
}
