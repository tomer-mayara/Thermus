import type { TestContext } from 'node:test';
import type { Application } from '../../../src/app/application.ts';
import type { HostedPortal } from '../../../src/app/hosted-portal.ts';
import { composeWorkOSApplication, type WorkOSApplicationParts } from '../../../src/app/hosted-workos-application.ts';
import { startHttpServer } from '../../../src/runtime/http/server.ts';
import type { RequestServerBuilder } from '../../../src/interfaces/mcp/mcp-server.ts';
import { OperatorLogSpy } from '../doubles/application/operator-log-spy.ts';
import { WorkOSFake } from '../doubles/workos/workos-fake.ts';
import { WorkOSSignupFake } from '../doubles/workos/workos-signup-fake.ts';
import { listenerTransport, type BrowserTransport } from '../drivers/browser/hosted-browser.ts';
import { mcpRequest } from '../drivers/mcp/mcp-http-request.ts';
import { hostedConfig } from '../fixtures/hosted-config.ts';

// A hosted server that uses the WorkOS provider with the fake WorkOS API of the world.
export interface WorkOSServerSite {
  readonly world: WorkOSFake;
  readonly transport: BrowserTransport;
  readonly publicBaseUrl: string;
}

interface WorkOSSiteOptions {
  // The hosted configuration of the site. Without it, the site uses hostedConfig.
  readonly config?: typeof hostedConfig;
  // Browser layout checks use the real loaded portal build and its fonts and images.
  readonly portal?: HostedPortal;
  // The organizations that a new fake knows. Each gets the environment roles.
  readonly organizations: readonly string[];
  // Reuse provider state for a fresh application. Install the signup fake only on the first site.
  readonly world?: WorkOSFake;
  // The MCP tool server of the composition. Without it, the MCP server of the composition has no tools.
  readonly buildServer?: RequestServerBuilder;
  // The signup setting of the composition. Without it, signup is closed.
  readonly signup?: WorkOSApplicationParts['signup'];
  readonly loggingStorage?: WorkOSApplicationParts['loggingStorage'];
  readonly audit?: WorkOSApplicationParts['audit'];
  readonly toolOperations?: WorkOSApplicationParts['toolOperations'];
  readonly auditSink?: WorkOSApplicationParts['auditSink'];
  readonly snapshotOptions?: WorkOSApplicationParts['snapshotOptions'];
  // When true, the fake also keeps the personal organizations of signup. The signup fake starts before setUp.
  readonly signupFake?: boolean;
  // Gives the fake its memberships, names, external IDs, and users before the application starts.
  readonly setUp?: (world: WorkOSFake) => void;
}

export interface WorkOSSite extends WorkOSServerSite {
  readonly log: OperatorLogSpy;
  // Close admission and drain the listener before closing the application. Repeated calls share the result.
  close(): Promise<void>;
  // The answer of the MCP endpoint to server/discover, with this Connect token or without a token.
  discover(token?: string): Promise<Response>;
}

interface WorkOSSignupSite extends WorkOSSite {
  readonly signupFake: WorkOSSignupFake;
}

// The one place that composes the real hosted application against the fake: composeWorkOSApplication() with the
// connection of the fake. A site of another deployment, such as LocalHttpsSite, can serve
// the application.
export function composeApplicationWithWorkOSFake(
  config: typeof hostedConfig,
  world: WorkOSFake,
  parts: WorkOSApplicationParts,
): Promise<Application> {
  return composeWorkOSApplication(config, world.connection(), parts);
}

// The real hosted composition with the WorkOS provider behind the real HTTP server on a loopback port, at the public
// base URL of the configuration. The fake stands in for WorkOS. The server closes before the application.
export function serveWorkOSSite(t: TestContext, options: WorkOSSiteOptions & { readonly signupFake: true }): Promise<WorkOSSignupSite>;
export function serveWorkOSSite(t: TestContext, options: WorkOSSiteOptions): Promise<WorkOSSite>;
export async function serveWorkOSSite(t: TestContext, options: WorkOSSiteOptions): Promise<WorkOSSite | WorkOSSignupSite> {
  const { config = hostedConfig, organizations, buildServer, signup, loggingStorage, audit, toolOperations, auditSink, snapshotOptions, setUp } = options;
  const world = options.world ?? await WorkOSFake.start(t, config.publicBaseUrl, organizations);
  const signupFake = options.signupFake === true ? new WorkOSSignupFake(world) : undefined;
  setUp?.(world);
  const log = new OperatorLogSpy();
  const backend = await composeApplicationWithWorkOSFake(config, world, { logger: log, buildServer, signup, loggingStorage, audit, toolOperations, auditSink, snapshotOptions });
  const application = options.portal?.withApplication(backend) ?? backend;
  const server = await startHttpServer(application.handle, { listen: { host: '127.0.0.1', port: 0 }, publicBaseUrl: config.publicBaseUrl, logger: log });
  let closing: Promise<void> | undefined;
  const close = () => (closing ??= server.close().then(() => application.close()));
  t.after(close);
  const transport = listenerTransport(server.url);
  const site: WorkOSSite = {
    world,
    transport,
    publicBaseUrl: config.publicBaseUrl,
    log,
    close,
    discover: (token) => transport(mcpRequest({ url: config.mcpResourceUrl, method: 'server/discover', ...(token === undefined ? {} : { token }) })),
  };
  return signupFake === undefined ? site : { ...site, signupFake };
}
