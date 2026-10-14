import assert from 'node:assert/strict';
import type { WorkOS } from '@workos-inc/node';
import { signInWithAuthKit, type BrowserSignIn } from './browser-session.ts';
import { authorizeWithConnect, type ConnectGrant } from './connect-grant.ts';
import { FixtureRegistry } from './fixture-registry.ts';
import { LiveBrowser } from './live-browser.ts';
import { requestTimeout, workosClient, type HostedLiveSettings } from './settings.ts';
import { createStagingFixtures, type StagingFixtures } from './staging-fixtures.ts';

export function once<T>(make: () => Promise<T>): () => Promise<T> {
  let result: Promise<T> | undefined;
  return () => (result ??= make());
}

async function checkAuthKitReachable(issuer: string): Promise<void> {
  const url = `${issuer}/.well-known/oauth-authorization-server`;
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(requestTimeout) });
  await response.body?.cancel();
  assert.equal(response.status, 200, `GET ${url} gave HTTP ${response.status}.`);
}

// The shared state of one run of the hosted live gate. Each test awaits what it needs, so a failed setup fails
// each dependent test by itself. The run makes its staging fixtures at the first need and deletes them at the end.
export class LiveRun {
  readonly settings: HostedLiveSettings;
  readonly workos: WorkOS;
  readonly browser: LiveBrowser;
  readonly #registry: FixtureRegistry;
  readonly fixtures: () => Promise<StagingFixtures>;
  readonly newUserSignIn: () => Promise<BrowserSignIn>;
  readonly newUserLaterSignIn: () => Promise<BrowserSignIn>;
  readonly organizationSignIn: () => Promise<BrowserSignIn>;
  readonly connectGrant: () => Promise<ConnectGrant>;

  constructor(settings: HostedLiveSettings) {
    this.settings = settings;
    this.workos = workosClient(settings);
    this.browser = new LiveBrowser(() => checkAuthKitReachable(settings.authkitIssuer));
    this.#registry = new FixtureRegistry(this.workos);
    this.fixtures = once(() => createStagingFixtures(this.workos, this.#registry));
    this.newUserSignIn = once(async () => signInWithAuthKit(this, { user: (await this.fixtures()).newUser }));
    this.newUserLaterSignIn = once(async () => {
      await this.newUserSignIn();
      return signInWithAuthKit(this, { user: (await this.fixtures()).newUser });
    });
    this.organizationSignIn = once(async () => {
      const { twoOrganizationUser, organizationA } = await this.fixtures();
      return signInWithAuthKit(this, { user: twoOrganizationUser, organizationName: organizationA.name });
    });
    this.connectGrant = once(async () => {
      const { connectUser, organizationA, oauthApplication } = await this.fixtures();
      return authorizeWithConnect(this, { user: connectUser, organizationName: organizationA.name, clientId: oauthApplication.clientId });
    });
  }

  async end(): Promise<void> {
    try {
      await this.browser.close();
    } finally {
      await this.#registry.deleteAll();
    }
  }
}
