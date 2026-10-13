import assert from 'node:assert/strict';
import { request as httpRequest, type IncomingHttpHeaders } from 'node:http';

export interface BrowserAnswer {
  readonly status: number;
  readonly headers: IncomingHttpHeaders;
  // The Set-Cookie values of this answer, in their order.
  readonly cookies: readonly string[];
  readonly body: string;
  readonly location?: URL;
}

export interface PageForm {
  readonly action: string;
  readonly fields: Readonly<Record<string, string>>;
  readonly label: string;
}

export interface PostOptions {
  // The Origin header. null sends none; the default is the public origin.
  readonly origin?: string | null;
  readonly headers?: Readonly<Record<string, string>>;
}

interface BrowserRequest {
  readonly method: 'GET' | 'POST';
  readonly url: URL;
  readonly headers: Record<string, string>;
  readonly body?: string;
}

const HTML_ENTITIES: Readonly<Record<string, string>> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

// A browser that opens the public URLs of a hosted server that listens on a loopback address. It keeps the cookies of
// each answer, as a browser does, and follows no redirect by itself.
export class HostedBrowser {
  private readonly cookies = new Map<string, string>();
  private readonly listenUrl: URL;
  private readonly publicBaseUrl: URL;

  constructor(listenUrl: URL, publicBaseUrl: string, cookieHeader?: string) {
    this.listenUrl = listenUrl;
    this.publicBaseUrl = new URL(publicBaseUrl);
    for (const pair of cookieHeader?.split(';') ?? []) this.keepCookie(pair);
  }

  get cookieHeader(): string | undefined {
    if (this.cookies.size === 0) return undefined;
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  open(path: string, headers: Readonly<Record<string, string>> = {}): Promise<BrowserAnswer> {
    return this.send({ method: 'GET', url: this.publicUrl(path), headers: { ...headers } });
  }

  follow(answer: BrowserAnswer): Promise<BrowserAnswer> {
    assert.ok(answer.location, `the answer ${answer.status} is no redirect: ${answer.body}`);
    return this.open(answer.location.href);
  }

  submit(form: PageForm, options: PostOptions = {}): Promise<BrowserAnswer> {
    return this.post(form.action, form.fields, options);
  }

  // A string body goes unchanged, so that a test can send a duplicate field.
  post(path: string, fields: Readonly<Record<string, string>> | string, options: PostOptions = {}): Promise<BrowserAnswer> {
    const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded', ...options.headers };
    if (options.origin !== null) headers.Origin = options.origin ?? this.publicBaseUrl.origin;
    const body = typeof fields === 'string' ? fields : new URLSearchParams(fields).toString();
    return this.send({ method: 'POST', url: this.publicUrl(path), headers, body });
  }

  private publicUrl(path: string): URL {
    const url = new URL(path, this.publicBaseUrl);
    assert.equal(url.origin, this.publicBaseUrl.origin, `the browser opens only the server: ${url.href}`);
    return url;
  }

  private send({ method, url, headers, body }: BrowserRequest): Promise<BrowserAnswer> {
    const cookieHeader = this.cookieHeader;
    if (cookieHeader !== undefined) headers.Cookie = cookieHeader;
    if (body !== undefined) headers['Content-Length'] = String(Buffer.byteLength(body));
    return new Promise((resolve, reject) => {
      const outgoing = httpRequest({
        host: this.listenUrl.hostname,
        port: this.listenUrl.port,
        method,
        path: `${url.pathname}${url.search}`,
        headers: { ...headers, Host: url.host },
      }, (incoming) => {
        let text = '';
        incoming.setEncoding('utf8').on('data', (chunk: string) => { text += chunk; }).on('error', reject).on('end', () => {
          const cookies = incoming.headers['set-cookie'] ?? [];
          for (const cookie of cookies) this.keepCookie(cookie.split(';')[0] ?? '', /max-age=0/i.test(cookie));
          const location = incoming.headers.location;
          resolve({
            status: incoming.statusCode ?? 0,
            headers: incoming.headers,
            cookies,
            body: text,
            ...(location === undefined ? {} : { location: new URL(location, this.publicBaseUrl) }),
          });
        });
      });
      outgoing.on('error', reject);
      outgoing.end(body);
    });
  }

  private keepCookie(pair: string, expired = false): void {
    const separator = pair.indexOf('=');
    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    if (name === '') return;
    if (expired || value === '') this.cookies.delete(name);
    else this.cookies.set(name, value);
  }
}

// Reads each form of a page, with its hidden fields and its button text. The pages write each element on one line.
export function formsIn(html: string): PageForm[] {
  const forms = html.matchAll(/<form method="post" action="([^"]*)">([\s\S]*?)<\/form>/g);
  return [...forms].map(([, action = '', content = '']) => ({
    action: decodeHtml(action),
    fields: Object.fromEntries([...content.matchAll(/<input type="hidden" name="([^"]*)" value="([^"]*)">/g)]
      .map(([, name = '', value = '']) => [decodeHtml(name), decodeHtml(value)])),
    label: decodeHtml(/<button type="submit">([^<]*)<\/button>/.exec(content)?.[1] ?? ''),
  }));
}

export function decodeHtml(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => HTML_ENTITIES[entity] ?? entity);
}
