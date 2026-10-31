import type { Page, Route } from 'playwright';
import type { LiveUser } from './staging-fixtures.ts';

interface AuthKitPlan {
  readonly user: LiveUser;
  readonly authkitHost: string;
  readonly callback: string;
  readonly organizationName?: string;
}

export interface AuthKitVisit {
  readonly pages: readonly string[];
  readonly callback: URL;
}

type AuthKitStep = (page: Page, plan: AuthKitPlan) => Promise<void>;

const stepTimeout = 30_000;
const maxPages = 10;

// Playwright messages can quote URLs and typed values. Keep the first line and drop each query.
function safeMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return (message.split('\n')[0] ?? '').replace(/\?\S*/g, '?…');
}

async function leavePage(page: Page, action: () => Promise<unknown>): Promise<void> {
  const before = page.url();
  await Promise.all([page.waitForURL((url) => url.href !== before, { waitUntil: 'commit', timeout: stepTimeout }), action()]);
}

const enterEmail: AuthKitStep = async (page, { user }) => {
  await page.locator('input[name=email]').fill(user.email);
  await leavePage(page, () => page.getByRole('button', { name: 'Continue with email' }).click());
};

const enterPassword: AuthKitStep = async (page, { user }) => {
  await page.locator('input[type=password]').fill(user.password);
  await leavePage(page, () => page.getByRole('button', { name: 'Sign in', exact: true }).click());
};

const chooseOrganization: AuthKitStep = async (page, { organizationName }) => {
  if (organizationName === undefined) throw new Error('AuthKit asks for an organization, but this sign-in has no organization to choose.');
  await leavePage(page, () => page.getByText(organizationName, { exact: true }).click());
};

// For a user with several memberships, the consent page also asks for the organization of the grant.
const allowAccess: AuthKitStep = async (page, { organizationName }) => {
  const picker = page.getByRole('combobox', { name: 'Organization access' });
  if (await picker.count() > 0) {
    if (organizationName === undefined) throw new Error('The consent page asks for an organization, but this authorization has no organization to choose.');
    if (await picker.evaluate((element) => element.tagName === 'SELECT')) await picker.selectOption({ label: organizationName });
    else {
      await picker.click();
      await page.getByRole('option', { name: organizationName, exact: true }).click();
    }
  }
  await leavePage(page, () => page.getByRole('button', { name: 'Allow access' }).click());
};

const awaitNextPage: AuthKitStep = async (page) => {
  const before = page.url();
  await page.waitForURL((url) => url.href !== before, { waitUntil: 'commit', timeout: stepTimeout });
};

const steps: ReadonlyArray<readonly [RegExp, AuthKitStep]> = [
  [/^\/$/, enterEmail],
  // AuthKit shows the invitation of a sign-in that started after the browser opened an invitation link.
  [/^\/invite\/?$/, enterEmail],
  [/^\/password/, enterPassword],
  [/^\/organization-selection/, chooseOrganization],
  [/^\/application-authorization\/?$/, allowAccess],
];

function stepFor(path: string): AuthKitStep {
  return steps.find(([pattern]) => pattern.test(path))?.[1] ?? awaitNextPage;
}

async function walkAuthKit(page: Page, plan: AuthKitPlan, callback: () => URL | undefined): Promise<AuthKitVisit> {
  const pages: string[] = [];
  for (let count = 0; count < maxPages; count += 1) {
    await page.waitForLoadState('domcontentloaded');
    const reached = callback();
    if (reached) return { pages, callback: reached };
    const { host, origin, pathname } = new URL(page.url());
    if (host !== plan.authkitHost) throw new Error(`AuthKit sent the browser to ${origin}${pathname}, not to the callback, after ${pages.join(' > ')}.`);
    if (pathname.startsWith('/mfa/')) {
      throw new Error(`Password-only sign-in unexpectedly reached ${pathname}; this proof does not enroll or verify MFA.`);
    }
    pages.push(pathname);
    await stepFor(pathname)(page, plan).catch((error: unknown) => {
      throw new Error(`The AuthKit page ${pathname} failed after ${pages.join(' > ')}: ${safeMessage(error)}`);
    });
  }
  throw new Error(`AuthKit did not reach the callback after ${maxPages} pages: ${pages.join(' > ')}.`);
}

// Opens a sign-in or authorization URL and completes each AuthKit page until AuthKit sends the browser to the callback.
// No server listens at the callback: the route keeps its URL and answers with a stub page.
export async function visitAuthKit(page: Page, start: string, plan: AuthKitPlan): Promise<AuthKitVisit> {
  let reached: URL | undefined;
  const pattern = `${plan.callback}**`;
  const capture = async (route: Route): Promise<void> => {
    reached ??= new URL(route.request().url());
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<p>The hosted live proof received the callback.</p>' });
  };
  await page.route(pattern, capture);
  try {
    await page.goto(start, { waitUntil: 'commit' }).catch((error: unknown) => {
      if (reached === undefined) throw new Error(`The browser could not open the AuthKit start page: ${safeMessage(error)}`);
    });
    return await walkAuthKit(page, plan, () => reached);
  } finally {
    await page.unroute(pattern, capture);
  }
}

export async function completeAuthKit(page: Page, plan: Omit<AuthKitPlan, 'callback'>): Promise<readonly string[]> {
  const pages: string[] = [];
  await page.waitForURL((url) => url.host === plan.authkitHost, { waitUntil: 'commit', timeout: stepTimeout });
  for (let count = 0; count < maxPages; count += 1) {
    await page.waitForLoadState('domcontentloaded');
    const { host, pathname } = new URL(page.url());
    if (host !== plan.authkitHost) return pages;
    if (pathname.startsWith('/mfa/')) {
      throw new Error(`Password-only sign-in unexpectedly reached ${pathname}; this proof does not enroll or verify MFA.`);
    }
    pages.push(pathname);
    await stepFor(pathname)(page, { ...plan, callback: '' }).catch((error: unknown) => {
      throw new Error(`The AuthKit page ${pathname} failed after ${pages.join(' > ')}: ${safeMessage(error)}`);
    });
  }
  throw new Error(`AuthKit did not send the browser back after ${maxPages} pages: ${pages.join(' > ')}.`);
}
