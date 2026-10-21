import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { LocalAuthPages, localPagePaths, type ProviderHandler } from '../../../../src/interfaces/web/auth/better-auth/local-auth-pages.ts';
import { CLIENT_ADDRESS_HEADER } from '../../../../src/runtime/http/client-address.ts';
import { decodeHtml } from '../../../support/drivers/browser/html-entities.ts';

export const publicBaseUrl = 'http://localhost:8080/';
export const publicOrigin = 'http://localhost:8080';
export const issuer = 'http://localhost:8080/api/auth';
export const paths = localPagePaths(publicBaseUrl);
export const clientId = 'native-client-1';
export const clientRedirectUri = 'http://127.0.0.1:33418/callback';
export const sessionCookie = 'better-auth.session_token=session-1.signature; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax';

export const signedQuery = new URLSearchParams([
  ['response_type', 'code'],
  ['client_id', clientId],
  ['redirect_uri', clientRedirectUri],
  ['scope', 'openid profile email'],
  ['state', 'client-state'],
  ['code_challenge', 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'],
  ['code_challenge_method', 'S256'],
  ['resource', 'http://localhost:8080/mcp'],
  ['exp', '1760000600'],
  ['ba_iat', '1760000000'],
  ['ba_param', 'client_id'],
  ['ba_param', 'scope'],
  ['sig', 'c2lnbmF0dXJlLW9mLXRoZS1xdWVyeQ'],
]).toString();

export interface ProviderCall {
  readonly method: string;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
  readonly signal: AbortSignal;
}

export class ProviderDouble {
  readonly calls: ProviderCall[] = [];
  private readonly answers = new Map<string, () => Response>();

  readonly handler: ProviderHandler = async (request) => {
    this.calls.push({
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(request.headers),
      body: request.method === 'POST' ? await request.json() : undefined,
      signal: request.signal,
    });
    const answer = this.answers.get(`${request.method} ${new URL(request.url).pathname}`);
    return answer?.() ?? new Response(null, { status: 404 });
  };

  answer(route: string, response: () => Response): this {
    this.answers.set(route, response);
    return this;
  }

  pages(): LocalAuthPages {
    return new LocalAuthPages(this.handler, { issuer, paths });
  }
}

export function providerJson(status: number, body: unknown, headers: RequestInit['headers'] = {}): () => Response {
  return () => Response.json(body, { status, headers });
}

export function providerRefusal(status: number, code: string, headers: Readonly<Record<string, string>> = {}): () => Response {
  return providerJson(status, { code, message: 'Provider message text' }, { ...headers, 'Set-Cookie': 'better-auth.session_token=refused; Path=/' });
}

// A browser request as the HTTP bridge gives it: the public URL and the client address from the socket.
export function browserRequest(target: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  headers.set(CLIENT_ADDRESS_HEADER, '127.0.0.1');
  return new Request(new URL(target, publicBaseUrl), { ...init, headers });
}

export function formPost(target: string, fields: Readonly<Record<string, string>>, headers: Readonly<Record<string, string>> = {}): Request {
  const sent = new Headers({ 'Content-Type': 'application/x-www-form-urlencoded', Origin: publicOrigin, 'Sec-Fetch-Site': 'same-origin' });
  for (const [name, value] of Object.entries(headers)) sent.set(name, value);
  return browserRequest(target, { method: 'POST', headers: sent, body: new URLSearchParams(fields).toString() });
}

// The acceptance browser reads the field with this exact pattern.
export function hiddenOauthQuery(html: string): string {
  const field = /<input type="hidden" name="oauth_query" value="([^"]*)">/.exec(html);
  assert.ok(field, `the page has no hidden oauth_query field:\n${html}`);
  return decodeHtml(field[1] ?? '');
}

export function tagWith(html: string, element: string, attribute: string): string {
  const tag = new RegExp(`<${element}\\b[^>]*\\b${attribute}[^>]*>`).exec(html);
  assert.ok(tag, `the page has no ${element} with ${attribute}:\n${html}`);
  return tag[0];
}

export function assertPageHeaders(response: Response, html: string): void {
  const styles = [...html.matchAll(/<style>([^<]*)<\/style>/g)];
  assert.equal(styles.length, 1, 'the page must have exactly one inline style');
  const styleHash = createHash('sha256').update(styles[0]?.[1] ?? '').digest('base64');
  assert.deepEqual(Object.fromEntries([...response.headers].filter(([name]) => name !== 'allow' && name !== 'retry-after')), {
    'cache-control': 'no-store',
    'content-security-policy': `default-src 'none'; style-src 'sha256-${styleHash}'; base-uri 'none'; frame-ancestors 'none'`,
    'content-type': 'text/html; charset=utf-8',
    'referrer-policy': 'same-origin',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
  });
}

export function assertLoadsNothing(html: string): void {
  assert.doesNotMatch(html, /<(?:script|link|img|iframe|object|embed|base|a)\b|\b(?:src|href)=|url\(|@import|@font-face|https?:\/\//i);
}

export function assertNothingCopied(response: Response, html: string, code = 'NO_CODE'): void {
  assert.equal(response.headers.get('Set-Cookie'), null);
  assert.equal(response.headers.get('Location'), null);
  assert.ok(!html.includes('Provider message text'), html);
  assert.ok(!html.includes(code), html);
}
