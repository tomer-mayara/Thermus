import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:https';
import { createServer as createCallbackPort, type IncomingMessage, type ServerResponse } from 'node:http';
import type { TestContext } from 'node:test';
import { serveFetchUrlDebugSite } from './fetch-url-debug-site.ts';

export interface OAuthSiteOptions {
  readonly expiresIn?: number;
  readonly omitRefresh?: boolean;
  readonly refreshFailure?: boolean;
  readonly omitRefreshOnRefresh?: boolean;
  readonly tokenResponse?: Record<string, unknown>;
  readonly badResource?: boolean;
  readonly badIssuer?: boolean;
  readonly denied?: boolean;
  readonly onToken?: (form: Record<string, string>) => Promise<void>;
  readonly onMcp?: (authorization: string | undefined) => Promise<void>;
  readonly loseRefreshResponse?: boolean;
}

type DebugSite = Awaited<ReturnType<typeof serveFetchUrlDebugSite>>;

class OAuthSite {
  issuer = '';
  readonly requests: { path: string; form?: Record<string, string>; authorization?: string }[] = [];
  private readonly grants = new Map<string, { challenge: string; redirect: string }>();
  private readonly tokens = new Set<string>();
  private issued = 0;

  constructor(private readonly options: OAuthSiteOptions, private readonly backend: DebugSite) {}

  async handle(request: IncomingMessage, response: ServerResponse) {
    const url = new URL(request.url ?? '/', this.issuer);
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = Buffer.concat(chunks);
    const form = Object.fromEntries(new URLSearchParams(body.toString()));
    this.record(request, url.pathname, form);
    if (url.pathname === '/.well-known/oauth-protected-resource/mcp') return send(response, { resource: this.options.badResource ? 'https://evil.example/mcp' : `${this.issuer}/mcp`, authorization_servers: [this.issuer] });
    if (url.pathname === '/.well-known/oauth-authorization-server') return send(response, this.metadata());
    if (url.pathname === '/authorize') return this.authorize(url, response);
    if (url.pathname === '/token') return this.token(form, response);
    if (url.pathname === '/mcp') return this.forward(request, response, body);
    response.writeHead(404).end();
  }

  private record(request: IncomingMessage, path: string, form: Record<string, string>) {
    this.requests.push({ path, ...(path === '/token' ? { form } : {}), ...(request.headers.authorization ? { authorization: request.headers.authorization } : {}) });
  }

  private metadata() {
    return {
      issuer: this.options.badIssuer ? 'https://evil.example' : this.issuer,
      authorization_endpoint: `${this.issuer}/authorize`, token_endpoint: `${this.issuer}/token`,
      response_types_supported: ['code'], grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'], token_endpoint_auth_methods_supported: ['none'], scopes_supported: ['openid', 'offline_access'],
    };
  }

  private authorize(url: URL, response: ServerResponse) {
    const redirect = new URL(url.searchParams.get('redirect_uri') ?? '');
    redirect.searchParams.set('state', url.searchParams.get('state') ?? '');
    redirect.searchParams.set(this.options.denied ? 'error' : 'code', this.options.denied ? 'access_denied' : 'test-code');
    this.grants.set('test-code', { challenge: url.searchParams.get('code_challenge') ?? '', redirect: `${redirect.origin}${redirect.pathname}` });
    response.writeHead(302, { location: redirect.href }).end();
  }

  private async token(form: Record<string, string>, response: ServerResponse) {
    await this.options.onToken?.(form);
    if (form.resource !== `${this.issuer}/mcp` || form.client_id !== 'test-public-client') return send(response, { error: 'invalid_request', error_description: 'private-token-secret' }, 400);
    if (form.grant_type === 'refresh_token') {
      if (this.options.loseRefreshResponse) { response.destroy(); return; }
      if (this.options.refreshFailure) return send(response, { error: 'invalid_grant', error_description: 'private-token-secret' }, 400);
    }
    if (form.grant_type === 'authorization_code' && !this.validCode(form)) return send(response, { error: 'invalid_grant' }, 400);
    return send(response, this.issueToken(form));
  }

  private issueToken(form: Record<string, string>) {
    this.issued += 1;
    this.tokens.add(`oauth-access-${this.issued}`);
    const omitRefresh = this.options.omitRefresh || this.options.omitRefreshOnRefresh && form.grant_type === 'refresh_token';
    return {
      access_token: `oauth-access-${this.issued}`, token_type: 'Bearer', expires_in: this.options.expiresIn ?? 300, scope: 'openid offline_access',
      ...(omitRefresh ? {} : { refresh_token: `oauth-refresh-${this.issued}` }), ...this.options.tokenResponse,
    };
  }

  private validCode(form: Record<string, string>) {
    const grant = this.grants.get(form.code);
    return grant?.redirect === form.redirect_uri && grant.challenge === createHash('sha256').update(form.code_verifier).digest('base64url');
  }

  private async forward(request: IncomingMessage, response: ServerResponse, body: Buffer) {
    await this.options.onMcp?.(request.headers.authorization);
    if (!this.tokens.has(request.headers.authorization?.replace(/^Bearer /, '') ?? '')) return send(response, { error: 'unauthorized' }, 401);
    const headers = new Headers();
    for (const [name, value] of Object.entries(request.headers)) if (!['host', 'authorization', 'content-length'].includes(name)) headers.set(name, String(value));
    headers.set('authorization', 'Bearer test-debug-token');
    const forwarded = await fetch(this.backend.endpoint, { method: request.method, headers, ...(body.length ? { body } : {}) });
    response.writeHead(forwarded.status, Object.fromEntries(forwarded.headers));
    response.end(Buffer.from(await forwarded.arrayBuffer()));
  }
}

function send(response: ServerResponse, body: unknown, status = 200) { response.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body)); }

async function callbackPort(): Promise<string> {
  const reservation = createCallbackPort();
  await new Promise<void>((resolve) => reservation.listen(0, '127.0.0.1', resolve));
  const address = reservation.address();
  if (!address || typeof address === 'string') throw new Error('No test callback port.');
  await new Promise<void>((resolve) => reservation.close(() => resolve()));
  return `http://127.0.0.1:${address.port}/callback`;
}

export async function serveFetchUrlOAuthSite(t: TestContext, options: OAuthSiteOptions = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'thermus-oauth-site-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const ca = join(directory, 'certificate.pem');
  const key = join(directory, 'key.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', ca, '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost'], { stdio: 'ignore' });
  const backend = await serveFetchUrlDebugSite(t);
  const site = new OAuthSite(options, backend);
  const server = createServer({ key: await readFile(key), cert: await readFile(ca) }, (request, response) => { void site.handle(request, response).catch(() => { response.writeHead(500).end('Test site failure.'); }); });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('The test OAuth site did not listen.');
  site.issuer = `https://localhost:${address.port}`;
  t.after(() => new Promise<void>((resolve) => { server.close(() => resolve()); server.closeAllConnections(); }));
  return { profile: { endpoint: `${site.issuer}/mcp`, issuer: site.issuer, clientId: 'test-public-client' }, ca, redirectUrl: await callbackPort(), requests: site.requests, calls: backend.calls };
}
