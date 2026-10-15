import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { createApplication, type Application, type ApplicationLogger } from '../../../src/application.ts';
import { loadDeploymentConfig } from '../../../src/config/deployment-config.ts';
import { startHttpServer, type HttpServer } from '../../../src/http/server.ts';
import { portalBuild } from '../processes/module-paths.ts';
import { answer, portalFiles, portalHeaders, type PortalSite } from './portal-front.ts';
import { browserRedirectUri, localOrigin, type HostedLiveSettings } from './settings.ts';

interface TlsCertificate {
  readonly key: Buffer | string;
  readonly cert: Buffer | string;
}

const publicBaseUrl = `${localOrigin}/`;
const listenAddresses = ['127.0.0.1', '::1'];
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
  // The fronts close first. Then listener drain starts, application work stops, and the drain completes.
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
    let listenerDrain: Promise<void> | undefined;
    let drained = Promise.resolve<PromiseSettledResult<void>>({ status: 'fulfilled', value: undefined });
    // The site owns the listener even when custom application cleanup ignores its drain or fails.
    owned.defer(async () => {
      const result = await drained;
      if (result.status === 'rejected') throw result.reason;
    });
    const application = owned.adopt(await openApplication(logger), (opened) => opened.close(listenerDrain));
    const thermus = await startHttpServer(application.handle, { listen: { host: '127.0.0.1', port: 0 }, publicBaseUrl, logger });
    owned.defer(() => {
      listenerDrain = thermus.close();
      // Observe a rejection now; application cleanup can take longer than the listener drain.
      drained = listenerDrain.then(
        (value) => ({ status: 'fulfilled', value }),
        (reason: unknown) => ({ status: 'rejected', reason }),
      );
    });
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
