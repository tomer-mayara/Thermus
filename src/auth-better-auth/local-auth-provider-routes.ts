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

  private post(_browser: Request, route: string, json: object): Promise<Response> {
    const headers = new Headers({ Accept: 'application/json', 'Content-Type': 'application/json' });
    return this.handler(new Request(`${this.issuer}/${route}`, { method: 'POST', headers, body: JSON.stringify(json) }));
  }
}

// The provider answers a completed step with JSON that gives the next URL: a page or the redirect URI of the client.
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
