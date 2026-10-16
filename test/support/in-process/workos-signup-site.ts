import { signupDocuments } from '../fixtures/signup-documents.ts';
import { WorkOSSignupFake } from '../doubles/workos/workos-signup-fake.ts';
import type { TestContext } from 'node:test';
import { composeWorkOSApplication } from '../../../src/hosted-workos-application.ts';
import { loadDeploymentConfig } from '../../../src/config/deployment-config.ts';
import { startHttpServer } from '../../../src/http/server.ts';
import { listenerTransport } from '../drivers/browser/hosted-browser.ts';
import type { WorkOSServerSite } from '../dsl/workos-sign-in.ts';
import { WorkOSFake } from '../doubles/workos/workos-fake.ts';

export async function openWorkOSSignupSite(t: TestContext, enabled = false): Promise<WorkOSServerSite & { signupFake: WorkOSSignupFake }> {
  const config = loadDeploymentConfig({ DEPLOYMENT: 'hosted', PUBLIC_BASE_URL: 'https://thermus.example/' }, 'http');
  const world = await WorkOSFake.start(t, config.publicBaseUrl, ['org_INTERNAL']);
  const signupFake = new WorkOSSignupFake(world);
  const logger = { info: (_message: string): void => {}, error: (_message: string): void => {} };
  const application = await composeWorkOSApplication(config, world.connection(), { logger, ...(enabled ? { signup: { enabled: true, documents: signupDocuments } } : {}) });
  const server = await startHttpServer(application.handle, { listen: { host: '127.0.0.1', port: 0 }, publicBaseUrl: config.publicBaseUrl, logger });
  t.after(async () => {
    await server.close();
    await application.close();
  });
  return { world, signupFake, transport: listenerTransport(server.url), publicBaseUrl: config.publicBaseUrl };
}
