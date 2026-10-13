import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { clientAddressHeader, mcpResourceUrl, publicBaseUrl, type LocalAuth } from './better-auth-local.ts';

export const loopbackRedirectUri = 'http://127.0.0.1:33418/callback';

export interface TokenResponse {
  readonly access_token: string;
  readonly refresh_token?: string;
  readonly token_type: string;
  readonly expires_in: number;
  readonly scope: string;
}

export interface Introspection {
  readonly active: boolean;
  readonly [claim: string]: unknown;
}

export interface RequestOptions {
  readonly json?: unknown;
  readonly form?: Readonly<Record<string, string>>;
  readonly origin?: string | null;
  readonly headers?: Readonly<Record<string, string>>;
}

let lastClientAddress = 0;

function addressWithOwnRateLimitBucket(): string {
  lastClientAddress += 1;
  return `198.51.100.${lastClientAddress}`;
}

export class HttpAgent {
  readonly address = addressWithOwnRateLimitBucket();
  readonly cookies: Map<string, string>;
  private readonly auth: LocalAuth;

  constructor(auth: LocalAuth, cookies: ReadonlyMap<string, string> = new Map()) {
    this.auth = auth;
    this.cookies = new Map(cookies);
  }

  cookieHeader(): string {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  async request(method: 'GET' | 'POST', path: string, options: RequestOptions = {}): Promise<Response> {
    const headers = new Headers(options.headers);
    headers.set(clientAddressHeader, this.address);
    if (options.origin !== null) headers.set('Origin', options.origin ?? publicBaseUrl);
    if (this.cookies.size > 0) headers.set('Cookie', this.cookieHeader());
    const response = await this.auth.handler(new Request(new URL(path, publicBaseUrl), {
      method,
      headers,
      body: requestBody(headers, options),
      redirect: 'manual',
    }));
    this.keepCookies(response);
    return response;
  }

  async signIn(email: string, password: string): Promise<Response> {
    return this.request('POST', '/api/auth/sign-in/email', { json: { email, password } });
  }

  async sessionId(): Promise<string | undefined> {
    const response = await this.request('GET', '/api/auth/get-session', { origin: null });
    const body = await response.json() as { session?: { id: string } } | null;
    return body?.session?.id;
  }

  private keepCookies(response: Response): void {
    for (const line of response.headers.getSetCookie()) {
      const [pair = ''] = line.split(';');
      const separator = pair.indexOf('=');
      const name = pair.slice(0, separator).trim();
      const value = pair.slice(separator + 1).trim();
      if (value === '' || /max-age=0/i.test(line)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }
}

function requestBody(headers: Headers, options: RequestOptions): string | undefined {
  if (options.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    return JSON.stringify(options.json);
  }
  if (options.form !== undefined) {
    headers.set('Content-Type', 'application/x-www-form-urlencoded');
    return new URLSearchParams(options.form).toString();
  }
  return undefined;
}

export async function errorCodeOf(response: Response): Promise<string | undefined> {
  const body = await response.json() as { code?: string; error?: string };
  return body.code ?? body.error;
}

export function jwtClaims(token: string): Record<string, unknown> {
  const [, payload] = token.split('.');
  assert.ok(payload, 'token is not a JWT');
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}

function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url');
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
}

export async function followAuthorizationWithConsent(browser: HttpAgent, authorizePath: string): Promise<URL> {
  const authorization = await browser.request('GET', authorizePath, { origin: null });
  const location = authorization.headers.get('Location');
  assert.ok(location, `authorization did not redirect: ${authorization.status}`);
  if (location.startsWith(loopbackRedirectUri)) return new URL(location);
  const consentQuery = new URL(location, publicBaseUrl).search.slice(1);
  const consent = await browser.request('POST', '/api/auth/oauth2/consent', { json: { accept: true, oauth_query: consentQuery } });
  assert.equal(consent.status, 200, await consent.clone().text());
  const { url } = await consent.json() as { url: string };
  return new URL(url);
}

export interface AuthorizationRequest {
  readonly path: string;
  readonly verifier: string;
}

export class PreRegisteredNativeClient {
  readonly clientId: string;
  private readonly agent: HttpAgent;

  constructor(auth: LocalAuth, clientId: string) {
    this.clientId = clientId;
    this.agent = new HttpAgent(auth);
  }

  authorizationRequest(scope = 'openid'): AuthorizationRequest {
    const { verifier, challenge } = pkcePair();
    const query = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: loopbackRedirectUri,
      scope,
      state: randomBytes(8).toString('hex'),
      code_challenge: challenge,
      code_challenge_method: 'S256',
      resource: mcpResourceUrl,
    });
    return { path: `/api/auth/oauth2/authorize?${query}`, verifier };
  }

  async authorize(browser: HttpAgent, scope = 'openid'): Promise<TokenResponse> {
    const request = this.authorizationRequest(scope);
    const callback = await followAuthorizationWithConsent(browser, request.path);
    const response = await this.exchange(callback, request.verifier);
    assert.equal(response.status, 200, await response.clone().text());
    return await response.json() as TokenResponse;
  }

  async exchange(callback: URL, verifier: string): Promise<Response> {
    const code = callback.searchParams.get('code');
    assert.ok(code, `authorization returned no code: ${callback.href}`);
    return this.token({ grant_type: 'authorization_code', code, redirect_uri: loopbackRedirectUri, code_verifier: verifier });
  }

  async refresh(refreshToken: string): Promise<Response> {
    return this.token({ grant_type: 'refresh_token', refresh_token: refreshToken });
  }

  private async token(form: Record<string, string>): Promise<Response> {
    return this.agent.request('POST', '/api/auth/oauth2/token', {
      origin: null,
      form: { ...form, client_id: this.clientId, resource: mcpResourceUrl },
    });
  }
}

export class ResourceServerClient {
  private readonly agent: HttpAgent;
  private readonly authorization: string;

  constructor(auth: LocalAuth, clientId: string, clientSecret: string) {
    this.agent = new HttpAgent(auth);
    this.authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
  }

  async introspect(token: string): Promise<Introspection> {
    const response = await this.agent.request('POST', '/api/auth/oauth2/introspect', {
      origin: null,
      headers: { Authorization: this.authorization },
      form: { token, token_type_hint: 'access_token' },
    });
    assert.equal(response.status, 200, await response.clone().text());
    return await response.json() as Introspection;
  }
}
