import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:https';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createApplication, type Application } from '../../../src/application.ts';
import { loadDeploymentConfig } from '../../../src/config/deployment-config.ts';
import { startHttpServer, type HttpServer } from '../../../src/http/server.ts';
import { browserRedirectUri, localOrigin, type HostedLiveSettings } from './settings.ts';

interface PortalFile {
  readonly body: Buffer;
  readonly type: string;
}

const portalBuild = fileURLToPath(new URL('../../../../src/user-portal/dist/', import.meta.url));
const listenAddresses = ['127.0.0.1', '::1'];
const contentTypes: Readonly<Record<string, string>> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const hopHeaders = new Set(['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'host', 'content-length', 'proxy-connection']);
// The portal posts its sign-out form to the server, which sends the browser on to the WorkOS logout URL.
const portalHeaders = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self' https://api.workos.com",
};

class LogLines {
  readonly lines: string[] = [];
  readonly info = (message: string): void => { this.lines.push(`INFO ${message}`); };
  readonly error = (message: string): void => { this.lines.push(`ERROR ${message}`); };
}

async function selfSignedCertificate(directory: string): Promise<{ key: Buffer; cert: Buffer }> {
  const key = join(directory, 'key.pem');
  const cert = join(directory, 'cert.pem');
  await promisify(execFile)('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '1',
    '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1',
  ]);
  return { key: await readFile(key), cert: await readFile(cert) };
}

async function portalFiles(): Promise<Map<string, PortalFile>> {
  const files = new Map<string, PortalFile>();
  const read = async (path: string, file: string): Promise<void> => {
    files.set(path, { body: await readFile(join(portalBuild, file)), type: contentTypes[extname(file)] ?? 'application/octet-stream' });
  };
  try {
    await read('/', 'index.html');
    for (const name of await readdir(join(portalBuild, 'assets'))) await read(`/assets/${name}`, join('assets', name));
  } catch {
    throw new Error('The local HTTPS site has no portal build. Run npm run build:user-portal first; npm run test:hosted-live does it.');
  }
  return files;
}

// The local HTTPS test server of the hosted live gate, at https://localhost:46443/. It is the documented deployment
// of the gate: it serves the built portal at / and /assets/, and it sends each other request to the real hosted
// composition of Thermus with the WorkOS staging settings. The certificate is a new self-signed one for each run.
export class LocalHttpsSite {
  readonly log: LogLines;
  readonly #application: Application;
  readonly #thermus: HttpServer;
  readonly #fronts: readonly Server[];
  readonly #directory: string;

  private constructor(parts: { application: Application; thermus: HttpServer; fronts: readonly Server[]; directory: string; log: LogLines }) {
    this.#application = parts.application;
    this.#thermus = parts.thermus;
    this.#fronts = parts.fronts;
    this.#directory = parts.directory;
    this.log = parts.log;
  }

  // The plain HTTP address of Thermus behind the front. MCP clients of the test call it directly.
  get thermusUrl(): URL {
    return this.#thermus.url;
  }

  static async start(settings: HostedLiveSettings): Promise<LocalHttpsSite> {
    const directory = await mkdtemp(join(tmpdir(), 'thermus-hosted-live-'));
    const log = new LogLines();
    const environment = {
      DEPLOYMENT: 'hosted',
      PUBLIC_BASE_URL: `${localOrigin}/`,
      WORKOS_API_KEY: settings.apiKey,
      WORKOS_CLIENT_ID: settings.clientId,
      WORKOS_AUTHKIT_ISSUER: settings.authkitIssuer,
      WORKOS_REDIRECT_URI: browserRedirectUri,
      WORKOS_COOKIE_PASSWORD: randomBytes(32).toString('base64url'),
    };
    const config = loadDeploymentConfig(environment, 'http');
    const application = await createApplication(config, log, environment);
    const thermus = await startHttpServer(application.handle, { listen: { host: '127.0.0.1', port: 0 }, publicBaseUrl: config.publicBaseUrl, logger: log });
    const files = await portalFiles();
    const tls = await selfSignedCertificate(directory);
    const fronts = await Promise.all(listenAddresses.map(async (host) => {
      const front = createServer(tls, (request, response) => void answer(request, response, { files, thermus: thermus.url }));
      front.listen({ host, port: Number(new URL(localOrigin).port) });
      await once(front, 'listening');
      return front;
    }));
    return new LocalHttpsSite({ application, thermus, fronts, directory, log });
  }

  async close(): Promise<void> {
    for (const front of this.#fronts) {
      front.closeAllConnections();
      await new Promise<void>((resolve) => front.close(() => resolve()));
    }
    await this.#thermus.close();
    await this.#application.close();
    await rm(this.#directory, { recursive: true, force: true });
  }
}

async function answer(request: IncomingMessage, response: ServerResponse, site: { files: Map<string, PortalFile>; thermus: URL }): Promise<void> {
  const path = request.url ?? '/';
  const file = request.method === 'GET' || request.method === 'HEAD' ? site.files.get(path) : undefined;
  try {
    if (file) {
      response.writeHead(200, { ...portalHeaders, 'Content-Type': file.type }).end(request.method === 'HEAD' ? undefined : file.body);
      return;
    }
    await forward(request, response, new URL(path, site.thermus));
  } catch {
    if (!response.headersSent) response.writeHead(502);
    response.end();
  }
}

async function forward(request: IncomingMessage, response: ServerResponse, target: URL): Promise<void> {
  const method = request.method ?? 'GET';
  const body = method === 'GET' || method === 'HEAD' ? {} : { body: Readable.toWeb(request) as ReadableStream, duplex: 'half' as const };
  const answer = await fetch(target, { method, headers: forwardedHeaders(request), redirect: 'manual', ...body });
  response.writeHead(answer.status, answerHeaders(answer));
  if (answer.body !== null) {
    for await (const chunk of answer.body) response.write(chunk);
  }
  response.end();
}

function forwardedHeaders(request: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value === undefined || hopHeaders.has(name)) continue;
    for (const item of Array.isArray(value) ? value : [value]) headers.append(name, item);
  }
  return headers;
}

// A flat list keeps each Set-Cookie header separate.
function answerHeaders(answer: Response): string[] {
  const outgoing: string[] = [];
  for (const [name, value] of answer.headers) {
    if (name !== 'set-cookie' && !hopHeaders.has(name)) outgoing.push(name, value);
  }
  for (const cookie of answer.headers.getSetCookie()) outgoing.push('set-cookie', cookie);
  return outgoing;
}
