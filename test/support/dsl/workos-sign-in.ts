import { HostedBrowser, type BrowserAnswer } from '../drivers/browser/hosted-browser.ts';
import type { FakeUser } from '../doubles/workos/workos-fake.ts';
import type { WorkOSServerSite } from '../in-process/workos-site.ts';

interface ServerSignIn {
  readonly browser: HostedBrowser;
  readonly start: BrowserAnswer;
  readonly callback: BrowserAnswer;
}

export async function signInThroughServer(site: WorkOSServerSite, user: FakeUser, organizationId?: string): Promise<ServerSignIn> {
  const browser = new HostedBrowser(site.transport, site.publicBaseUrl);
  const start = await browser.open('login');
  const state = start.location?.searchParams.get('state') ?? '';
  const callback = await browser.open(`callback?code=${site.world.codeFor(user, organizationId)}&state=${encodeURIComponent(state)}`);
  return { browser, start, callback };
}
