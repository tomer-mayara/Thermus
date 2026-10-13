import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';

export type BrowserTransport = (request: Request) => Promise<Response>;

export interface BrowserAnswer {
  readonly status: number;
  readonly headers: Headers;
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

const HTML_ENTITIES: Readonly<Record<string, string>> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

// A browser that opens the public URLs of a hosted application. It keeps the cookies of each answer, as a browser
// does, and follows no redirect by itself. The transport sends each request to a listening server or to the
// application in the same process.
export class HostedBrowser {
  private readonly cookies = new Map<string, string>();
  private readonly transport: BrowserTransport;
  private readonly publicBaseUrl: URL;

  constructor(transport: BrowserTransport, publicBaseUrl: string, cookieHeader?: string) {
    this.transport = transport;
    this.publicBaseUrl = new URL(publicBaseUrl);
    for (const pair of cookieHeader?.split(';') ?? []) this.keepCookie(pair);
  }

  get cookieHeader(): string | undefined {
    if (this.cookies.size === 0) return undefined;
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  open(path: string, headers: Readonly<Record<string, string>> = {}): Promise<BrowserAnswer> {
    return this.send(new Request(this.publicUrl(path), { headers: this.headersWith(headers) }));
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
    const headers = this.headersWith({ 'Content-Type': 'application/x-www-form-urlencoded', ...options.headers });
    if (options.origin !== null) headers.set('Origin', options.origin ?? this.publicBaseUrl.origin);
    const body = typeof fields === 'string' ? fields : new URLSearchParams(fields).toString();
    return this.send(new Request(this.publicUrl(path), { method: 'POST', headers, body }));
  }

  private publicUrl(path: string): URL {
    const url = new URL(path, this.publicBaseUrl);
    assert.equal(url.origin, this.publicBaseUrl.origin, `the browser opens only the server: ${url.href}`);
    return url;
  }

  private headersWith(headers: Readonly<Record<string, string>>): Headers {
    const all = new Headers(headers);
    const cookieHeader = this.cookieHeader;
    if (cookieHeader !== undefined) all.set('Cookie', cookieHeader);
    return all;
  }

  private async send(request: Request): Promise<BrowserAnswer> {
    const response = await this.transport(request);
    const cookies = response.headers.getSetCookie();
    for (const cookie of cookies) this.keepCookie(cookie.split(';')[0] ?? '', /max-age=0/i.test(cookie));
    const location = response.headers.get('Location');
    return {
      status: response.status,
      headers: response.headers,
      cookies,
      body: await response.text(),
      ...(location === null ? {} : { location: new URL(location, this.publicBaseUrl) }),
    };
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

// Sends each request with node:http to a server that listens on a loopback address. The Host header names the public
// host, and node:http keeps each header as written.
export function listenerTransport(listenUrl: URL): BrowserTransport {
  return async (request) => {
    const url = new URL(request.url);
    const body = request.body === null ? undefined : Buffer.from(await request.arrayBuffer());
    const headers: Record<string, string> = { ...Object.fromEntries(request.headers), Host: url.host };
    if (body !== undefined) headers['Content-Length'] = String(body.byteLength);
    return new Promise((resolve, reject) => {
      const outgoing = httpRequest({ host: listenUrl.hostname, port: listenUrl.port, method: request.method, path: `${url.pathname}${url.search}`, headers }, (incoming) => {
        const chunks: Buffer[] = [];
        incoming.on('data', (chunk: Buffer) => chunks.push(chunk)).on('error', reject).on('end', () => {
          const answerHeaders = new Headers();
          for (let index = 0; index < incoming.rawHeaders.length; index += 2) answerHeaders.append(incoming.rawHeaders[index] ?? '', incoming.rawHeaders[index + 1] ?? '');
          resolve(new Response(chunks.length === 0 ? null : Buffer.concat(chunks), { status: incoming.statusCode ?? 0, headers: answerHeaders }));
        });
      });
      outgoing.on('error', reject);
      outgoing.end(body);
    });
  };
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
