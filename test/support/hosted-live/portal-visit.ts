import assert from 'node:assert/strict';
import type { Page } from 'playwright';
import { completeAuthKit } from './authkit-driver.ts';
import type { LiveRun } from './live-run.ts';
import { originAndPath } from './navigations.ts';
import { localOrigin } from './settings.ts';
import type { LiveUser } from './staging-fixtures.ts';

export interface PortalVisit {
  readonly page: Page;
  readonly pages: readonly string[];
  readonly signedInAt: number;
}

export interface ServerAnswer {
  readonly status: number;
  readonly body: string;
  readonly setCookies: readonly string[];
  readonly location: string | undefined;
}

// A sign-in through the portal of the local HTTPS site: the Sign in link, /login, the AuthKit pages, and the
// callback of the server. The browser keeps the cookies of the server, as a user's browser does.
export async function signInThroughPortal(run: LiveRun, user: LiveUser, organizationName?: string): Promise<PortalVisit> {
  await run.site();
  const authkitHost = new URL(run.settings.authkitIssuer).host;
  const page = await run.browser.newPage();
  await page.goto(`${localOrigin}/`);
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  const pages = await completeAuthKit(page, { user, authkitHost, mfaPolicy: run.settings.mfaPolicy, ...(organizationName === undefined ? {} : { organizationName }) });
  await waitForPortal(page);
  return { page, pages, signedInAt: Date.now() };
}

// The acceptance of an organization invitation through its link. AuthKit sends the browser through the Initiate login
// URI to /login of the server, which starts a sign-in. AuthKit then shows the invitation again, the sign-in pages, and
// the callback of the server. The link holds the invitation token, so no message shows it.
export async function acceptInvitationThroughPortal(run: LiveRun, user: LiveUser, invitationLink: string): Promise<PortalVisit> {
  await run.site();
  const authkitHost = new URL(run.settings.authkitIssuer).host;
  const page = await run.browser.newPage();
  await openInvitationLink(page, invitationLink, authkitHost);
  const pages = await completeAuthKit(page, { user, authkitHost, mfaPolicy: run.settings.mfaPolicy });
  await waitForPortal(page);
  return { page, pages, signedInAt: Date.now() };
}

// A request of the browser with its cookies, which follows no redirect.
export async function serverGet(page: Page, path: string): Promise<ServerAnswer> {
  const answer = await page.context().request.get(new URL(path, `${localOrigin}/`).href, { maxRedirects: 0 });
  return { status: answer.status(), body: await answer.text(), setCookies: setCookiesOf(answer.headersArray()), location: answer.headers().location };
}

// A form post of the browser with its cookies. The Origin header is the site, unless the post names another one.
export async function serverPost(page: Page, path: string, form: { readonly fields: Readonly<Record<string, string>>; readonly origin?: string }): Promise<ServerAnswer> {
  const answer = await page.context().request.post(new URL(path, `${localOrigin}/`).href, { form: { ...form.fields }, headers: { Origin: form.origin ?? localOrigin }, maxRedirects: 0 });
  return { status: answer.status(), body: await answer.text(), setCookies: setCookiesOf(answer.headersArray()), location: answer.headers().location };
}

export async function sessionJson(page: Page): Promise<Readonly<Record<string, unknown>>> {
  const answer = await serverGet(page, 'session');
  assert.equal(answer.status, 200, `GET /session gave ${answer.status}.`);
  return JSON.parse(answer.body) as Readonly<Record<string, unknown>>;
}

function setCookiesOf(headers: readonly { readonly name: string; readonly value: string }[]): string[] {
  return headers.filter(({ name }) => name.toLowerCase() === 'set-cookie').map(({ value }) => value);
}

async function waitForPortal(page: Page): Promise<void> {
  await page.waitForURL(`${localOrigin}/`);
  await page.getByRole('heading', { name: /^Welcome, / }).waitFor();
  await page.locator('.product-access').filter({ hasNotText: 'Checking' }).waitFor({ state: 'attached' });
}

// The sign-in that the server starts shows the invitation again, with the AuthKit authorization session in the query.
async function openInvitationLink(page: Page, invitationLink: string, authkitHost: string): Promise<void> {
  try {
    await page.goto(invitationLink, { waitUntil: 'commit' });
    await page.waitForURL((url) => url.host === authkitHost && url.searchParams.has('authorization_session_id'), { waitUntil: 'commit' });
  } catch (error) {
    // A Playwright message can quote the link, so the error gives only the page of the browser, without its query.
    const name = error instanceof Error ? error.name : 'Error';
    throw new Error(`The invitation link did not lead to a sign-in of the server: the browser stopped at ${originAndPath(page.url())} (${name}).`);
  }
}
