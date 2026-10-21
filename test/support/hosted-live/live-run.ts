import assert from 'node:assert/strict';
import type { WorkOS } from '@workos-inc/node';
import { createAdministrationFixtures, type AdministrationFixtures } from './administration-fixtures.ts';
import { signInWithAuthKit, type BrowserSignIn } from './browser-session.ts';
import { authorizeWithConnect, type ConnectGrant } from './connect-grant.ts';
import { FixtureRegistry, type FixtureKind } from './fixture-registry.ts';
import { LiveBrowser } from './live-browser.ts';
import type { SignupDocuments } from '../../../src/accounts/providers/workos/workos-signup.ts';
import { createSignupFixtures } from './signup-fixtures.ts';
import { LocalHttpsSite } from './local-https-site.ts';
import { createOrganizationFixtures, type OrganizationFixtures } from './organization-fixtures.ts';
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
// each dependent test by itself. A run without existingFixtures makes its staging fixtures at the first need and
// deletes them at the end. A run with existingFixtures uses the staging fixtures that the caller gives, and does not
// make or delete these fixtures. At the end, each run deletes the other fixtures that the run makes or records.
export class LiveRun {
  readonly settings: HostedLiveSettings;
  readonly workos: WorkOS;
  readonly browser: LiveBrowser;
  readonly #registry: FixtureRegistry;
  readonly fixtures: () => Promise<StagingFixtures>;
  readonly organizationFixtures: () => Promise<OrganizationFixtures>;
  readonly administrationFixtures: () => Promise<AdministrationFixtures>;
  readonly signupFixtures: () => ReturnType<typeof createSignupFixtures>;
  readonly newUserSignIn: () => Promise<BrowserSignIn>;
  readonly newUserLaterSignIn: () => Promise<BrowserSignIn>;
  readonly organizationSignIn: () => Promise<BrowserSignIn>;
  readonly connectGrant: () => Promise<ConnectGrant>;
  readonly site: () => Promise<LocalHttpsSite>;
  #site: Promise<LocalHttpsSite> | undefined;

  constructor(settings: HostedLiveSettings, options: { readonly signupDocuments?: SignupDocuments; readonly existingFixtures?: () => Promise<StagingFixtures> } = {}) {
    this.settings = settings;
    this.workos = workosClient(settings);
    this.browser = new LiveBrowser(() => checkAuthKitReachable(settings.authkitIssuer));
    this.#registry = new FixtureRegistry(this.workos, settings.clientId);
    this.fixtures = options.existingFixtures ?? once(() => createStagingFixtures(this.workos, this.#registry));
    this.organizationFixtures = once(async () => createOrganizationFixtures(this.workos, this.#registry, await this.fixtures()));
    this.administrationFixtures = once(async () => createAdministrationFixtures(this.workos, this.#registry, await this.fixtures()));
    this.signupFixtures = once(async () => createSignupFixtures(this.workos, this.#registry, (await this.fixtures()).runId));
    this.newUserSignIn = once(async () => signInWithAuthKit(this, { user: (await this.fixtures()).newUser }));
    this.newUserLaterSignIn = once(async () => {
      await this.newUserSignIn();
      return signInWithAuthKit(this, { user: (await this.fixtures()).newUser });
    });
    this.organizationSignIn = once(async () => {
      const { twoOrganizationUser, organizationA } = await this.fixtures();
      return signInWithAuthKit(this, { user: twoOrganizationUser, organizationName: organizationA.name });
    });
    this.site = () => (this.#site ??= LocalHttpsSite.start(settings, options.signupDocuments === undefined ? {} : { signupDocuments: options.signupDocuments }));
    this.connectGrant = once(async () => {
      const { connectUser, organizationA, oauthApplication } = await this.fixtures();
      return authorizeWithConnect(this, { user: connectUser, organizationName: organizationA.name, clientId: oauthApplication.clientId });
    });
  }

  // A proof that makes staging data itself records it here, so that the run deletes it at the end.
  recordFixture(kind: FixtureKind, id: string): void {
    this.#registry.record(kind, id);
  }

  async stopSite(): Promise<void> {
    const site = this.#site;
    this.#site = undefined;
    await (await site?.catch(() => undefined))?.close();
  }

  async end(): Promise<void> {
    try {
      await this.browser.close();
      await this.stopSite();
    } finally {
      await this.#registry.deleteAll();
    }
  }
}
