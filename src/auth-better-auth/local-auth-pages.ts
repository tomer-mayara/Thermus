import { messagePage, signInPage } from './local-auth-page-html.ts';
import {
  browserRedirect,
  errorCodeOf,
  ProviderRoutes,
  retryAfterSeconds,
  type ProviderHandler,
  type SignInCredentials,
} from './local-auth-provider-routes.ts';

export type { ProviderHandler } from './local-auth-provider-routes.ts';

export interface LocalPagePaths {
  readonly signIn: string;
  readonly consent: string;
  readonly authorizationError: string;
}

export interface LocalAuthPagesSettings {
  // The provider base URL, such as http://localhost:8080/api/auth.
  readonly issuer: string;
  readonly paths: LocalPagePaths;
}

const TEXT = {
  startFromClient: 'Start the sign-in from your MCP client.',
  wrongCredentials: 'The email address or password is not correct.',
  accountDisabled: 'This account is disabled. Ask the operator of this Magumagu installation.',
  signInRefused: 'The sign-in request was refused. Start again from your MCP client.',
  tooManySignIns: 'Too many sign-in attempts. Wait and try again.',
  signInInvalid: 'The sign-in request is not valid or has expired. Start again from your MCP client.',
  signInFailed: 'The sign-in failed. Try again later.',
} as const;

export function localPagePaths(publicBaseUrl: string): LocalPagePaths {
  const pathOf = (page: string): string => new URL(page, publicBaseUrl).pathname;
  return { signIn: pathOf('sign-in'), consent: pathOf('consent'), authorizationError: pathOf('authorization-error') };
}

export class LocalAuthPages {
  private readonly provider: ProviderRoutes;
  private readonly paths: LocalPagePaths;

  constructor(provider: ProviderHandler, settings: LocalAuthPagesSettings) {
    this.provider = new ProviderRoutes(provider, settings.issuer);
    this.paths = settings.paths;
  }

  handles(pathname: string): boolean {
    return Object.values(this.paths).includes(pathname);
  }

  async handle(request: Request): Promise<Response> {
    return request.method === 'POST' ? this.signIn(request) : this.showSignIn(request);
  }

  private showSignIn(request: Request): Response {
    const query = new URL(request.url).search.slice(1);
    if (!isSignedAuthorization(new URLSearchParams(query))) return messagePage(400, TEXT.startFromClient);
    return signInPage(200, { action: this.paths.signIn, oauthQuery: query });
  }

  private async signIn(request: Request): Promise<Response> {
    const credentials = signInCredentials(new URLSearchParams(await request.text()));
    if (credentials === undefined) return messagePage(400, TEXT.signInInvalid);
    return this.signInResult(await this.provider.signIn(request, credentials), credentials);
  }

  private async signInResult(response: Response, credentials: SignInCredentials): Promise<Response> {
    switch (response.status) {
      case 200: return (await browserRedirect(response)) ?? messagePage(500, TEXT.signInFailed);
      case 400: return messagePage(400, TEXT.signInInvalid);
      case 401: return signInPage(401, { action: this.paths.signIn, oauthQuery: credentials.oauth_query, email: credentials.email, message: TEXT.wrongCredentials });
      case 403: return messagePage(403, (await errorCodeOf(response)) === 'BANNED_USER' ? TEXT.accountDisabled : TEXT.signInRefused);
      case 429: return messagePage(429, TEXT.tooManySignIns, { 'Retry-After': retryAfterSeconds(response) });
      default: return messagePage(500, TEXT.signInFailed);
    }
  }
}

// The provider signs the authorization query that it gives the browser for the sign-in and consent pages.
function isSignedAuthorization(query: URLSearchParams): boolean {
  return Boolean(query.get('sig')) && Boolean(query.get('client_id'));
}

function hasSignature(oauthQuery: string): boolean {
  return Boolean(new URLSearchParams(oauthQuery).get('sig'));
}

function signInCredentials(form: URLSearchParams): SignInCredentials | undefined {
  const credentials = { email: form.get('email') ?? '', password: form.get('password') ?? '', oauth_query: form.get('oauth_query') ?? '' };
  return credentials.email && credentials.password && hasSignature(credentials.oauth_query) ? credentials : undefined;
}
