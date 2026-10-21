import type { TestContext } from 'node:test';
import { loadDeploymentConfig } from '../../../src/runtime/config/deployment-config.ts';
import { openWorkOSApplication } from '../../../src/app/hosted-workos-application.ts';
import { HostedPortal } from '../../../src/app/hosted-portal.ts';
import { browserSessionIssuer } from '../../../src/accounts/providers/workos/workos-settings.ts';
import { startHttpServer } from '../../../src/runtime/http/server.ts';
import { listenerTransport } from '../drivers/browser/hosted-browser.ts';
import { WorkOSFake, type FakeUser } from '../doubles/workos/workos-fake.ts';
import { WorkOSSignupFake } from '../doubles/workos/workos-signup-fake.ts';
import { hostedFetchSettings } from '../fixtures/hosted-placeholder.ts';
import { hostedPortalFixture } from '../processes/module-paths.ts';

// Keep production startup and document composition real. Only WorkOS transport and portal build files use fixtures.
export async function openProductionSignupSite(t: TestContext, enabled?: boolean) {
  const config = loadDeploymentConfig({ DEPLOYMENT: 'hosted', PUBLIC_BASE_URL: 'https://thermus.example/' }, 'http');
  const world = await WorkOSFake.start(t, config.publicBaseUrl, []);
  const signupFake = new WorkOSSignupFake(world);
  const originalFetch = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.origin === 'https://api.workos.com') return originalFetch(new URL(url.pathname + url.search, world.fake.origin), init);
    if (url.origin === world.fake.origin) return originalFetch(input, init);
    throw new Error('The production signup test refuses external network access.');
  });
  t.mock.method(world, 'browserToken', (user: FakeUser, organizationId?: string) => world.browserKey.sign({
    sub: user.id, sid: `session_${user.id}`, client_id: world.settings.clientId,
    ...(organizationId === undefined ? {} : { org_id: organizationId }),
  }, { issuer: browserSessionIssuer(world.settings.clientId), expiresAtUnixSeconds: Math.floor(Date.now() / 1_000) + 300 }));
  const loadPortal = HostedPortal.load;
  t.mock.method(HostedPortal, 'load', (issuer: string) => loadPortal(issuer, hostedPortalFixture));
  const logger = { info: (_message: string): void => {}, error: (_message: string): void => {} };
  const application = await openWorkOSApplication(config, logger, {
    ...hostedFetchSettings,
    WORKOS_API_KEY: world.settings.apiKey, WORKOS_CLIENT_ID: world.settings.clientId,
    WORKOS_AUTHKIT_ISSUER: 'https://thermus-test.authkit.app', WORKOS_REDIRECT_URI: world.settings.redirectUri,
    WORKOS_COOKIE_PASSWORD: world.settings.cookiePassword,
    ...(enabled === undefined ? {} : { SELF_SERVE_SIGNUP_ENABLED: String(enabled) }),
  });
  const server = await startHttpServer(application.handle, { listen: { host: '127.0.0.1', port: 0 }, publicBaseUrl: config.publicBaseUrl, logger });
  t.after(async () => {
    await server.close();
    await application.close();
  });
  return { world, signupFake, transport: listenerTransport(server.url), publicBaseUrl: config.publicBaseUrl };
}
