import type { SystemLog } from '../../../src/logs/system/system-logger.ts';
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { SignupDocuments } from '../../../src/accounts/organizations/signup-activation.ts';
import { createApplication, type Application } from '../../../src/app/application.ts';
import { loadDeploymentConfig } from '../../../src/runtime/config/deployment-config.ts';
import { startHttpServer, type HttpServer } from '../../../src/runtime/http/server.ts';
import { OperatorLogSpy } from '../doubles/application/operator-log-spy.ts';
import { portalBuild } from '../processes/module-paths.ts';
import { trustedAdRulesFile } from '../fixtures/ad-rules.ts';
import { answer, portalFiles, portalHeaders, type PortalSite } from './portal-front.ts';
import { browserRedirectUri, localOrigin, type HostedLiveSettings } from './settings.ts';

interface TlsCertificate {
  readonly key: Buffer | string;
  readonly cert: Buffer | string;
}

const publicBaseUrl = `${localOrigin}/`;
const listenAddresses = ['127.0.0.1', '::1'];
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

interface LocalHttpsSiteOptions {
  readonly signupDocuments?: SignupDocuments;
  // A scoped live proof can use its disposable SQL environment with the default production composition.
  readonly storageEnvironment?: Readonly<Partial<Record<'DATABASE_URL' | 'DATABASE_CA_CERT_PATH' | 'LOGGING_DESTINATION_ENCRYPTION_KEY', string>>>;
  // Only a custom application uses the static front. Its default portal build is src/interfaces/user-portal/dist/.
  readonly portalBuild?: string;
  // The default application checks this executable. The live gate uses LIGHTPANDA_BIN from its environment.
  readonly rendererExecutable?: string;
  // The TLS key and certificate in PEM. The default is a new self-signed certificate for this run.
  readonly certificate?: TlsCertificate;
  // The logger of the Thermus listener and of the default application. With this option, the log of the site stays
  // empty.
  readonly logger?: SystemLog;
  // Opens the application behind the front. It gets the logger option, or else the log of the site. The default is the
  // hosted composition with the staging settings, the trusted rules fixture, and a random cookie password.
  readonly application?: (logger: SystemLog) => Promise<Application>;
}

// The HTTPS front sends every live gate request to the production application, including portal and health requests.
// A work slice with a custom application keeps the static portal front. Failed starts release their resources.
export class LocalHttpsSite {
  readonly log: OperatorLogSpy;
  readonly #thermus: HttpServer;
  // The fronts close first. Then listener drain starts, application work stops, and the drain completes.
  readonly #resources: AsyncDisposableStack;

  private constructor(parts: { thermus: HttpServer; resources: AsyncDisposableStack; log: OperatorLogSpy }) {
    this.#thermus = parts.thermus;
    this.#resources = parts.resources;
    this.log = parts.log;
  }

  // The plain HTTP address of Thermus behind the front. MCP clients of the test call it directly.
  get thermusUrl(): URL {
    return this.#thermus.url;
  }

  static async start(settings: HostedLiveSettings, options: LocalHttpsSiteOptions = {}): Promise<LocalHttpsSite> {
    const files = await frontFiles(options);
    await using owned = new AsyncDisposableStack();
    const certificateDirectory = owned.adopt(await mkdtemp(join(tmpdir(), 'thermus-hosted-live-')), (path) => rm(path, { recursive: true, force: true }));
    const log = new OperatorLogSpy();
    const logger = options.logger ?? log;
    const openApplication = options.application ?? ((applicationLogger: SystemLog) => stagingApplication(settings, applicationLogger, options));
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
    const site: PortalSite = { files, headers: options.application === undefined ? {} : portalHeaders(settings.authkitIssuer), thermus: thermus.url };
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

async function stagingApplication(settings: HostedLiveSettings, logger: SystemLog, options: Pick<LocalHttpsSiteOptions, 'rendererExecutable' | 'signupDocuments' | 'storageEnvironment'>): Promise<Application> {
  const executable = options.rendererExecutable ?? process.env.LIGHTPANDA_BIN;
  const documents = options.signupDocuments;
  const environment = {
    ...options.storageEnvironment,
    DEPLOYMENT: 'hosted',
    PUBLIC_BASE_URL: publicBaseUrl,
    AD_RULES_FILE: trustedAdRulesFile,
    LIGHTPANDA_BIN: executable,
    WORKOS_API_KEY: settings.apiKey,
    WORKOS_CLIENT_ID: settings.clientId,
    WORKOS_AUTHKIT_ISSUER: settings.authkitIssuer,
    WORKOS_REDIRECT_URI: browserRedirectUri,
    WORKOS_COOKIE_PASSWORD: randomBytes(32).toString('base64url'),
  };
  const config = loadDeploymentConfig(environment, 'http');
  if (documents === undefined) return createApplication(config, logger, environment);
  const { composeWorkOSApplication, openWorkOSConnection } = await import('../../../src/app/hosted-workos-application.ts');
  const { createHostedToolOperations, fetchToolServers } = await import('../../../src/app/fetch-tool.ts');
  const { assertHostedRenderer } = await import('../../../src/app/hosted-renderer-startup.ts');
  const { HostedPortal } = await import('../../../src/app/hosted-portal.ts');
  await assertHostedRenderer(executable);
  const connection = await openWorkOSConnection(config, logger, environment);
  const portal = await HostedPortal.load(['https://api.workos.com', settings.authkitIssuer]);
  const application = await composeWorkOSApplication(config, connection, {
    logger, buildServer: fetchToolServers(createHostedToolOperations(environment, logger), logger),
    signup: { enabled: true, documents },
  });
  return portal.withApplication(application);
}

async function frontFiles(options: LocalHttpsSiteOptions): ReturnType<typeof portalFiles> {
  if (options.application === undefined) {
    if (options.portalBuild !== undefined) throw new Error('portalBuild requires a custom application; the production application owns its portal.');
    return new Map();
  }
  return portalFiles(options.portalBuild ?? portalBuild);
}
