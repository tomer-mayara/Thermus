import { HostedBrowser, type BrowserAnswer, type BrowserTransport } from './drivers/browser/hosted-browser.ts';
import type { WorkOSWorld, WorldUser } from './workos-world.ts';

// A hosted server that uses the WorkOS provider with the fake WorkOS API of the world.
export interface WorkOSServerSite {
  readonly world: WorkOSWorld;
  readonly transport: BrowserTransport;
  readonly publicBaseUrl: string;
}

export interface ServerSignIn {
  readonly browser: HostedBrowser;
  readonly start: BrowserAnswer;
  readonly callback: BrowserAnswer;
}

// The browser starts the sign-in at the server; AuthKit, which the test plays, sends it back with a code and the state.
export async function signInThroughServer(site: WorkOSServerSite, user: WorldUser, organizationId?: string): Promise<ServerSignIn> {
  const browser = new HostedBrowser(site.transport, site.publicBaseUrl);
  const start = await browser.open('login');
  const state = start.location?.searchParams.get('state') ?? '';
  const callback = await browser.open(`callback?code=${site.world.codeFor(user, organizationId)}&state=${encodeURIComponent(state)}`);
  return { browser, start, callback };
}
