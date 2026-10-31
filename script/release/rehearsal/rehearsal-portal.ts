// The browser steps of the rehearsal on the portal of the staging control plane: the free signup of organization B
// (R9) and the Connect view of B (R9 to R11). Each sign-in starts at the staging control plane, because the
// initiate-login URI of WorkOS Staging stays with the hosted live gate (section 3.2).
import assert from 'node:assert/strict';
import type { WorkOS } from '@workos-inc/node';
import type { Page } from 'playwright';
import { completeAuthKit } from '../../../test/support/hosted-live/authkit-driver.ts';
import { LiveBrowser } from '../../../test/support/hosted-live/live-browser.ts';
import { personalExternalId } from '../../../test/support/hosted-live/signup-fixtures.ts';
import type { HostedLiveSettings } from '../../../test/support/hosted-live/settings.ts';
import { utcNow } from './rehearsal-settings.ts';
import { readState, savedUser, updateState, type SavedUser } from './rehearsal-state.ts';

type Print = (line: string) => void;

const SETTING_UP = 'Setting up your workspace. This takes about two minutes.';
const PAUSED = 'Your workspace was paused after 14 days without use. It restarts on the next request, which can take about a minute.';
const GUIDE_WITHIN_MS = 600_000;

export interface ConnectView {
  readonly at: string;
  readonly heading: boolean;
  readonly settingUp: boolean;
  readonly paused: boolean;
  readonly guide: boolean;
  readonly refresh: string | null;
}

/** A sign-in that starts at the Sign in link of the staging control plane and ends back at its origin. */
export interface PortalVisit {
  readonly settings: HostedLiveSettings;
  readonly origin: string;
  readonly user: SavedUser;
  readonly organizationName?: string;
}

export async function signIn(browser: LiveBrowser, { settings, origin, user, organizationName }: PortalVisit): Promise<Page> {
  const page = await browser.newPage();
  await page.goto(`${origin}/`);
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await completeAuthKit(page, { user, authkitHost: new URL(settings.authkitIssuer).host, ...(organizationName === undefined ? {} : { organizationName }) });
  await page.waitForURL((url) => url.origin === origin, { waitUntil: 'commit' });
  return page;
}

export async function connectView(page: Page): Promise<ConnectView> {
  await page.waitForLoadState('domcontentloaded');
  const count = async (selector: ReturnType<Page['locator']>): Promise<boolean> => (await selector.count()) > 0;
  return {
    at: utcNow(),
    heading: await count(page.getByRole('heading', { name: 'Connect your MCP client' })),
    settingUp: await count(page.getByText(SETTING_UP, { exact: true })),
    paused: await count(page.getByText(PAUSED, { exact: true })),
    guide: await count(page.locator('.connection-guide')),
    refresh: await page.locator('meta[http-equiv="refresh"]').getAttribute('content').catch(() => null),
  };
}

export function viewLine(view: ConnectView): string {
  return `${view.at} Connect: heading ${view.heading ? 'yes' : 'no'}; setup words ${view.settingUp ? 'yes' : 'no'}; pause notice ${view.paused ? 'yes' : 'no'}; connection guide ${view.guide ? 'yes' : 'no'}; meta refresh ${view.refresh ?? 'none'}`;
}

/** R9: the signup of organization B at /signup?tier=free, then the Connect view until the connection guide shows. */
export interface SignupServices {
  readonly settings: HostedLiveSettings;
  readonly workos: WorkOS;
  readonly dir: string;
  readonly print: Print;
}

export async function signupB(services: SignupServices, origin: string, organizationName: string): Promise<void> {
  const { dir, print } = services;
  const user = savedUser(readState(dir), 'B');
  const browser = new LiveBrowser(async () => {});
  try {
    const page = await signIn(browser, { settings: services.settings, origin, user });
    print(`${utcNow()} signed in as user B; the page is ${new URL(page.url()).pathname}`);
    await page.goto(`${origin}/signup?tier=free`);
    const agreement = page.getByRole('checkbox');
    assert.equal(await agreement.isChecked(), false, 'The agreement box is checked before the user checks it.');
    await page.getByRole('textbox', { name: 'Organization name', exact: true }).fill(organizationName);
    await agreement.check();
    const clicked = performance.now();
    print(`${utcNow()} Create organization`);
    await page.getByRole('button', { name: 'Create organization', exact: true }).click();
    await page.waitForURL(`${origin}/quick-start`);
    print(`${utcNow()} Quick start opened, ${((performance.now() - clicked) / 1_000).toFixed(1)} s after Create organization`);
    const organization = await services.workos.organizations.getOrganizationByExternalId(personalExternalId(services.settings.clientId, user.id));
    updateState(dir, (state) => { state.organizations.B = { id: organization.id, name: organization.name }; });
    print(`Organization B ${organization.id} "${organization.name}"`);
    await page.goto(`${origin}/`);
    await watchUntilGuide(page, clicked, print);
  } finally {
    await browser.close();
  }
}

/** Prints the Connect view at each load until the connection guide shows. */
async function watchUntilGuide(page: Page, since: number, print: Print): Promise<void> {
  let last = '';
  while (performance.now() - since < GUIDE_WITHIN_MS) {
    const view = await connectView(page);
    const line = viewLine(view);
    if (line.slice(25) !== last) print(line);
    last = line.slice(25);
    if (view.guide) {
      print(`The connection guide showed ${((performance.now() - since) / 1_000).toFixed(1)} s after Create organization.`);
      return;
    }
    await page.waitForEvent('load', { timeout: 15_000 }).catch(() => page.reload());
  }
  throw new Error(`The connection guide did not show within ${GUIDE_WITHIN_MS / 1_000} s.`);
}
