import { FORM_LIMIT, readForm } from './local-auth-page-form.ts';
import { consentPage, messagePage, signInPage } from './local-auth-page-html.ts';
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
  accountDisabled: 'This account is disabled. Ask the operator of this Thermus installation.',
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
    const url = new URL(request.url);
    const pathname = url.pathname;
    if (Buffer.byteLength(url.search) > FORM_LIMIT) return messagePage(414, 'The authorization request is too large.');
    if (!this.handles(pathname)) return messagePage(404, 'This page does not exist.');
    if (request.method !== 'GET' && request.method !== 'POST') return messagePage(405, 'This method is not allowed.', { Allow: 'GET, POST' });
    if (pathname === this.paths.authorizationError) return this.authorizationError(request);
    if (request.method === 'GET') return pathname === this.paths.consent ? this.showConsent(request) : this.showSignIn(request);
    return this.submit(request, pathname === this.paths.consent);
  }

  private async submit(request: Request, consent: boolean): Promise<Response> {
    try {
      return await this.postForm(request, consent);
    } catch (error) {
      if (request.signal.aborted) throw error;
      return messagePage(500, consent ? 'The consent failed. Try again later.' : TEXT.signInFailed);
    }
  }

  private showSignIn(request: Request): Response {
    const query = new URL(request.url).search.slice(1);
    if (!isSignedAuthorization(new URLSearchParams(query))) return messagePage(400, TEXT.startFromClient);
    return signInPage(200, { action: this.paths.signIn, oauthQuery: query });
  }

  private async showConsent(request: Request): Promise<Response> {
    const query = new URL(request.url).search.slice(1);
    if (!isSignedAuthorization(new URLSearchParams(query))) return messagePage(400, TEXT.startFromClient);
    try {
      const details = await this.provider.consentDetails(request, query);
      if (details === undefined) return messagePage(403, 'The consent request was refused. Start again from your MCP client.');
      return consentPage(this.paths.consent, query, { ...details, scopes: new URLSearchParams(query).get('scope') ?? '' });
    } catch (error) {
      if (request.signal.aborted) throw error;
      return messagePage(500, 'The consent failed. Try again later.');
    }
  }

  private authorizationError(request: Request): Response {
    const code = new URL(request.url).searchParams.get('error');
    const safeCode = code !== null && /^[a-zA-Z0-9_-]{1,80}$/.test(code) ? code : 'authorization_failed';
    return messagePage(400, `The authorization request failed (${safeCode}). Start again from your MCP client.`);
  }

  private async postForm(request: Request, consent: boolean): Promise<Response> {
    const fields = await readForm(request);
    if (fields instanceof Response) return fields;
    if (consent) return this.consent(request, fields);
    const credentials = signInCredentials(fields);
    if (credentials === undefined) return messagePage(400, TEXT.signInInvalid);
    return this.signInResult(await this.provider.signIn(request, credentials), credentials);
  }

  private async consent(request: Request, form: URLSearchParams): Promise<Response> {
    const query = form.get('oauth_query') ?? '';
    const accept = form.get('accept');
    if (form.getAll('accept').length !== 1 || form.getAll('oauth_query').length !== 1
      || !isSignedAuthorization(new URLSearchParams(query)) || (accept !== 'yes' && accept !== 'no')) {
      return messagePage(400, 'The consent request is not valid or has expired. Start again from your MCP client.');
    }
    return consentResult(await this.provider.consent(request, query, accept === 'yes'));
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
  return query.getAll('sig').length === 1 && Boolean(query.get('sig'))
    && query.getAll('client_id').length === 1 && Boolean(query.get('client_id'));
}

function hasSignature(oauthQuery: string): boolean {
  return Boolean(new URLSearchParams(oauthQuery).get('sig'));
}

function signInCredentials(form: URLSearchParams): SignInCredentials | undefined {
  const credentials = { email: form.get('email') ?? '', password: form.get('password') ?? '', oauth_query: form.get('oauth_query') ?? '' };
  return ['email', 'password', 'oauth_query'].every((name) => form.getAll(name).length === 1)
    && credentials.email && credentials.password && hasSignature(credentials.oauth_query) ? credentials : undefined;
}

async function consentResult(response: Response): Promise<Response> {
  switch (response.status) {
    case 200: return (await browserRedirect(response)) ?? messagePage(500, 'The consent failed. Try again later.');
    case 429: return messagePage(429, 'Too many requests. Wait and try again.', { 'Retry-After': retryAfterSeconds(response) });
    case 401:
    case 403: return messagePage(response.status, 'The consent request was refused. Start again from your MCP client.');
    case 400: return messagePage(400, 'The consent request is not valid or has expired. Start again from your MCP client.');
    default: return messagePage(500, 'The consent failed. Try again later.');
  }
}
