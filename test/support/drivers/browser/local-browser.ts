import assert from 'node:assert/strict';
import { request as httpRequest, type IncomingHttpHeaders } from 'node:http';
import { publicBaseUrl, type AccountCredentials } from '../../in-process/better-auth-local.ts';
import { cookieHeaderOf, keepCookies } from './cookie-jar.ts';
import { decodeHtml } from './html-entities.ts';

type FetchSite = 'none' | 'same-origin' | 'cross-site';

// The listen address of the running server. A restarted server can listen on another port.
export type ServerAddress = () => URL;

interface PageResponse {
  readonly status: number;
  readonly headers: IncomingHttpHeaders;
  readonly body: string;
  readonly location?: URL;
}

interface FormPost {
  readonly origin?: string | null;
  readonly site?: FetchSite;
}

interface BrowserRequest {
  readonly method: 'GET' | 'POST';
  readonly url: URL;
  readonly headers: Record<string, string>;
  readonly body?: string;
}

interface SignInPage {
  readonly url: URL;
  readonly oauthQuery: string;
}

interface BrowserAuthorization {
  readonly callback: URL;
  readonly pages: readonly string[];
}

const MAX_STEPS = 6;

// A browser on the operator's machine. It reaches the server at its listen address, but each URL and
// Origin it shows the server uses the public base URL, as a browser behind a reverse proxy does.
// node:http keeps the Sec-Fetch headers exactly as written; fetch() replaces Sec-Fetch-Mode.
export class LocalBrowser {
  readonly cookies = new Map<string, string>();
  private readonly server: ServerAddress;

  constructor(server: ServerAddress) {
    this.server = server;
  }

  async navigate(url: string | URL, site: FetchSite = 'none'): Promise<PageResponse> {
    return this.send({ method: 'GET', url: publicUrl(url), headers: { 'Sec-Fetch-Site': site, 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document' } });
  }

  async post(url: string | URL, fields: Readonly<Record<string, string>>, options: FormPost = {}): Promise<PageResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Sec-Fetch-Site': options.site ?? 'same-origin',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Dest': 'document',
    };
    if (options.origin !== null) headers.Origin = options.origin ?? publicBaseUrl;
    return this.send({ method: 'POST', url: publicUrl(url), headers, body: new URLSearchParams(fields).toString() });
  }

  async openSignIn(authorizationUrl: string | URL): Promise<SignInPage> {
    const redirect = await this.navigate(authorizationUrl);
    assert.equal(redirect.location?.pathname, '/sign-in', `the authorization did not ask for a sign-in: ${redirect.status} ${redirect.body}`);
    const page = await this.navigate(redirect.location, 'same-origin');
    assert.equal(page.status, 200, page.body);
    return { url: redirect.location, oauthQuery: hiddenField(page.body, 'oauth_query') };
  }

  async authorize(authorizationUrl: string | URL, account?: AccountCredentials): Promise<BrowserAuthorization> {
    const pages: string[] = [];
    let response = await this.navigate(authorizationUrl);
    for (let step = 0; step < MAX_STEPS; step += 1) {
      const next = response.location;
      assert.ok(next, `the authorization stopped with ${response.status}: ${response.body}`);
      if (next.origin !== publicBaseUrl) return { callback: next, pages };
      const page = await this.navigate(next, 'same-origin');
      assert.equal(page.status, 200, page.body);
      pages.push(next.pathname);
      response = await this.answer(next, page, account);
    }
    assert.fail('the authorization did not reach the client redirect URI');
  }

  private async answer(url: URL, page: PageResponse, account: AccountCredentials | undefined): Promise<PageResponse> {
    const oauthQuery = hiddenField(page.body, 'oauth_query');
    if (url.pathname === '/sign-in') {
      assert.ok(account, 'the provider asked for a sign-in, but the test gave no account');
      return this.post(url, { email: account.email, password: account.password, oauth_query: oauthQuery });
    }
    assert.equal(url.pathname, '/consent', `unexpected page ${url.pathname}`);
    return this.post(url, { accept: 'yes', oauth_query: oauthQuery });
  }

  private send({ method, url, headers, body }: BrowserRequest): Promise<PageResponse> {
    const cookieHeader = cookieHeaderOf(this.cookies);
    if (cookieHeader !== undefined) headers.Cookie = cookieHeader;
    if (body !== undefined) headers['Content-Length'] = String(Buffer.byteLength(body));
    const server = this.server();
    return new Promise((resolve, reject) => {
      const outgoing = httpRequest({
        host: server.hostname,
        port: server.port,
        method,
        path: `${url.pathname}${url.search}`,
        headers: { ...headers, Host: url.host },
      }, (incoming) => {
        let text = '';
        incoming.setEncoding('utf8').on('data', (chunk: string) => { text += chunk; }).on('error', reject).on('end', () => {
          keepCookies(this.cookies, incoming.headers['set-cookie'] ?? []);
          const location = incoming.headers.location;
          resolve({
            status: incoming.statusCode ?? 0,
            headers: incoming.headers,
            body: text,
            ...(location === undefined ? {} : { location: new URL(location, publicBaseUrl) }),
          });
        });
      });
      outgoing.on('error', reject);
      outgoing.end(body);
    });
  }
}

export function hiddenField(html: string, name: string): string {
  const field = new RegExp(`<input type="hidden" name="${name}" value="([^"]*)">`).exec(html);
  assert.ok(field, `the page has no hidden ${name} field:\n${html}`);
  return decodeHtml(field[1] ?? '');
}

function publicUrl(url: string | URL): URL {
  const parsed = new URL(url, publicBaseUrl);
  assert.equal(parsed.origin, publicBaseUrl, `the browser opens only the server: ${parsed.href}`);
  return parsed;
}

// The MCP client reaches the server at its listen address and keeps the public URLs that the server gives it.
export function serverFetch(server: ServerAddress) {
  return async (url: string | URL, init?: RequestInit): Promise<Response> => {
    const target = new URL(url);
    assert.equal(target.origin, publicBaseUrl, `the MCP client may contact only the local server: ${target.href}`);
    const address = server();
    target.protocol = address.protocol;
    target.host = address.host;
    return fetch(target, init);
  };
}
