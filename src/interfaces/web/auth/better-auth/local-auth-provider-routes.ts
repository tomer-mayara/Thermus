import { CLIENT_ADDRESS_HEADER } from '../../../../runtime/http/client-address.ts';

export type ProviderHandler = (request: Request) => Promise<Response>;

export interface SignInCredentials {
  readonly email: string;
  readonly password: string;
  readonly oauth_query: string;
}

const RETRY_SECONDS = /^[1-9][0-9]*$/;
const DEFAULT_RETRY_SECONDS = '10';

// The provider routes that the pages use. Each call goes through the HTTP handler of the provider, so that
// its request checks apply.
export class ProviderRoutes {
  private readonly handler: ProviderHandler;
  private readonly issuer: string;

  constructor(handler: ProviderHandler, issuer: string) {
    this.handler = handler;
    this.issuer = issuer.replace(/\/+$/, '');
  }

  signIn(browser: Request, credentials: SignInCredentials): Promise<Response> {
    return this.post(browser, 'sign-in/email', credentials);
  }

  consent(browser: Request, oauthQuery: string, accept: boolean): Promise<Response> {
    return this.post(browser, 'oauth2/consent', { accept, oauth_query: oauthQuery });
  }

  async consentDetails(browser: Request, oauthQuery: string): Promise<{ clientName: string; email: string } | undefined> {
    const clientId = new URLSearchParams(oauthQuery).get('client_id');
    const client = await this.signedPublicClient(browser, clientId, oauthQuery);
    if (client.status !== 200) return undefined;
    const details = await jsonOf(client);
    const session = await this.handler(new Request(`${this.issuer}/get-session`, { headers: this.headers(browser), signal: browser.signal }));
    if (session.status !== 200) return undefined;
    const account = await jsonOf(session);
    const user = isRecord(account) ? account.user : undefined;
    return consentIdentity(details, user, clientId);
  }

  private signedPublicClient(browser: Request, clientId: string | null, oauthQuery: string): Promise<Response> {
    const headers = this.headers(browser);
    // This is a read of signed public metadata. A GET navigation has no Origin, and sending its cookie
    // on an internal POST would trigger the provider's stateful CSRF refusal.
    headers.delete('Cookie');
    headers.set('Content-Type', 'application/json');
    return this.handler(new Request(`${this.issuer}/oauth2/public-client-prelogin`, {
      method: 'POST', headers, body: JSON.stringify({ client_id: clientId, oauth_query: oauthQuery }), signal: browser.signal,
    }));
  }

  private post(browser: Request, route: string, json: object): Promise<Response> {
    const headers = this.headers(browser);
    headers.set('Content-Type', 'application/json');
    return this.handler(new Request(`${this.issuer}/${route}`, { method: 'POST', headers, body: JSON.stringify(json), signal: browser.signal }));
  }

  private headers(browser: Request): Headers {
    const headers = new Headers({ Accept: 'application/json' });
    for (const name of ['cookie', 'origin', 'referer', 'user-agent', 'sec-fetch-site', 'sec-fetch-mode', 'sec-fetch-dest', 'sec-fetch-user', CLIENT_ADDRESS_HEADER]) {
      const value = browser.headers.get(name);
      if (value !== null) headers.set(name, value);
    }
    return headers;
  }
}

export async function browserRedirect(response: Response): Promise<Response | undefined> {
  const body = await jsonOf(response);
  if (!isRecord(body) || body.redirect !== true || typeof body.url !== 'string') return undefined;
  const headers = new Headers({ Location: body.url, 'Cache-Control': 'no-store' });
  for (const cookie of response.headers.getSetCookie()) headers.append('Set-Cookie', cookie);
  return new Response(null, { status: 303, headers });
}

export async function errorCodeOf(response: Response): Promise<string | undefined> {
  const body = await jsonOf(response);
  return isRecord(body) && typeof body.code === 'string' ? body.code : undefined;
}

export function retryAfterSeconds(response: Response): string {
  const seconds = response.headers.get('X-Retry-After') ?? '';
  return RETRY_SECONDS.test(seconds) ? seconds : DEFAULT_RETRY_SECONDS;
}

async function jsonOf(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function consentIdentity(details: unknown, user: unknown, clientId: string | null): { clientName: string; email: string } | undefined {
  if (!isRecord(details) || details.client_id !== clientId || typeof details.client_name !== 'string' || !details.client_name
    || !isRecord(user) || typeof user.email !== 'string' || !user.email) return undefined;
  return { clientName: details.client_name, email: user.email };
}
