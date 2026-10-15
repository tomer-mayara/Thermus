import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:https';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { Readable } from 'node:stream';
import { promisify } from 'node:util';
import { createApplication, type Application, type ApplicationLogger } from '../../../src/application.ts';
import { loadDeploymentConfig } from '../../../src/config/deployment-config.ts';
import { startHttpServer, type HttpServer } from '../../../src/http/server.ts';
import { portalBuild } from '../processes/module-paths.ts';
import { browserRedirectUri, localOrigin, type HostedLiveSettings } from './settings.ts';

interface PortalFile {
  readonly body: Buffer;
  readonly type: string;
}

interface PortalSite {
  readonly files: Map<string, PortalFile>;
  readonly headers: Readonly<Record<string, string>>;
  readonly thermus: URL;
}

interface TlsCertificate {
  readonly key: Buffer | string;
  readonly cert: Buffer | string;
}

const publicBaseUrl = `${localOrigin}/`;
const listenAddresses = ['127.0.0.1', '::1'];
const contentTypes: Readonly<Record<string, string>> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const hopHeaders = new Set(['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'host', 'content-length', 'proxy-connection']);
// The portal posts its sign-out form to the server. Chrome applies form-action also to each redirect after the post:
// the server sends the browser to the WorkOS logout URL, WorkOS sends it to the logout of the AuthKit domain, and
// AuthKit sends it to the Sign-out URI of the portal.
function portalHeaders(authkitIssuer: string): Readonly<Record<string, string>> {
  return {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': `default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self' https://api.workos.com ${new URL(authkitIssuer).origin}`,
  };
}

class LogLines {
  readonly lines: string[] = [];
  readonly info = (message: string): void => { this.lines.push(`INFO ${message}`); };
  readonly error = (message: string): void => { this.lines.push(`ERROR ${message}`); };
}

// Writes key.pem and cert.pem into the directory and gives their PEM contents.
export async function selfSignedCertificate(directory: string): Promise<{ key: Buffer; cert: Buffer }> {
  const key = join(directory, 'key.pem');
  const cert = join(directory, 'cert.pem');
  await promisify(execFile)('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '1',
    '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1',
  ]);
  return { key: await readFile(key), cert: await readFile(cert) };
}

async function portalFiles(directory: string): Promise<Map<string, PortalFile>> {
  const files = new Map<string, PortalFile>();
  const read = async (path: string, file: string): Promise<void> => {
    files.set(path, { body: await readFile(join(directory, file)), type: contentTypes[extname(file)] ?? 'application/octet-stream' });
  };
  try {
    await read('/', 'index.html');
    for (const name of await readdir(join(directory, 'assets'))) await read(`/assets/${name}`, join('assets', name));
  } catch (cause) {
    throw new Error(`The local HTTPS site has no portal build in ${directory}. Run npm run build:user-portal first; npm run test:hosted-live does it.`, { cause });
  }
  return files;
}

function closeFront(front: Server): Promise<void> {
  front.closeAllConnections();
  return new Promise<void>((resolve) => front.close(() => resolve()));
}

export interface LocalHttpsSiteOptions {
  // The directory of the portal build. The default is src/user-portal/dist/ of this repository, from the module paths.
  readonly portalBuild?: string;
  // The TLS key and certificate in PEM. The default is a new self-signed certificate for this run.
  readonly certificate?: TlsCertificate;
  // The logger of the Thermus listener and of the default application. With this option, the log of the site stays
  // empty.
  readonly logger?: ApplicationLogger;
  // Opens the application behind the front. It gets the logger option, or else the log of the site. The default is the
  // hosted composition with the staging settings and a random cookie password.
  readonly application?: (logger: ApplicationLogger) => Promise<Application>;
}

// The local HTTPS test server of the hosted live gate, at https://localhost:46443/. It is the documented deployment
// of the gate: it serves the built portal at / and /assets/, and it sends each other request to Thermus. For the gate,
// Thermus is the real hosted composition with the WorkOS staging settings, and the certificate is a new self-signed
// one for each run. A work slice gives its own application and a certificate that stays. A start that fails closes
// what it started, so that the gate process can exit.
export class LocalHttpsSite {
  readonly log: LogLines;
  readonly #thermus: HttpServer;
  // The fronts, the Thermus server, the application, and the temporary directory. They close in this order.
  readonly #resources: AsyncDisposableStack;

  private constructor(parts: { thermus: HttpServer; resources: AsyncDisposableStack; log: LogLines }) {
    this.#thermus = parts.thermus;
    this.#resources = parts.resources;
    this.log = parts.log;
  }

  // The plain HTTP address of Thermus behind the front. MCP clients of the test call it directly.
  get thermusUrl(): URL {
    return this.#thermus.url;
  }

  static async start(settings: HostedLiveSettings, options: LocalHttpsSiteOptions = {}): Promise<LocalHttpsSite> {
    // The portal files come first. Without a portal build, the start fails before it opens a resource.
    const files = await portalFiles(options.portalBuild ?? portalBuild);
    await using owned = new AsyncDisposableStack();
    const certificateDirectory = owned.adopt(await mkdtemp(join(tmpdir(), 'thermus-hosted-live-')), (path) => rm(path, { recursive: true, force: true }));
    const log = new LogLines();
    const logger = options.logger ?? log;
    const openApplication = options.application ?? ((applicationLogger: ApplicationLogger) => stagingApplication(settings, applicationLogger));
    const application = owned.adopt(await openApplication(logger), (opened) => opened.close());
    const thermus = owned.adopt(
      await startHttpServer(application.handle, { listen: { host: '127.0.0.1', port: 0 }, publicBaseUrl, logger }),
      (server) => server.close(),
    );
    const site: PortalSite = { files, headers: portalHeaders(settings.authkitIssuer), thermus: thermus.url };
    const tls = options.certificate ?? await selfSignedCertificate(certificateDirectory);
    // One front after the other: when a listen fails, the stack already owns each front that listens.
    for (const host of listenAddresses) {
      const front = createServer(tls, (request, response) => void answer(request, response, site));
      front.listen({ host, port: Number(new URL(localOrigin).port) });
      await once(front, 'listening');
      owned.adopt(front, closeFront);
    }
    return new LocalHttpsSite({ thermus, resources: owned.move(), log });
  }

  async close(): Promise<void> {
    await this.#resources.disposeAsync();
  }
}

async function stagingApplication(settings: HostedLiveSettings, logger: ApplicationLogger): Promise<Application> {
  const environment = {
    DEPLOYMENT: 'hosted',
    PUBLIC_BASE_URL: publicBaseUrl,
    WORKOS_API_KEY: settings.apiKey,
    WORKOS_CLIENT_ID: settings.clientId,
    WORKOS_AUTHKIT_ISSUER: settings.authkitIssuer,
    WORKOS_REDIRECT_URI: browserRedirectUri,
    WORKOS_COOKIE_PASSWORD: randomBytes(32).toString('base64url'),
  };
  return createApplication(loadDeploymentConfig(environment, 'http'), logger, environment);
}

async function answer(request: IncomingMessage, response: ServerResponse, site: PortalSite): Promise<void> {
  const path = request.url ?? '/';
  const file = request.method === 'GET' || request.method === 'HEAD' ? site.files.get(path) : undefined;
  try {
    if (file) {
      response.writeHead(200, { ...site.headers, 'Content-Type': file.type }).end(request.method === 'HEAD' ? undefined : file.body);
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
