import type { Page, Request } from 'playwright';

// A redirect is a navigation request of the main frame, but not a page: framenavigated and waitForURL do not report
// it, and a Playwright route does not catch it. Thus the live cases watch the navigation requests, which include each
// redirect. The WorkOS logout and the Initiate login URI reach the local site only through redirects.

export function originAndPath(url: string | URL): string {
  const { origin, pathname } = new URL(url);
  return `${origin}${pathname}`;
}

function isPageNavigation(page: Page, request: Request): boolean {
  return request.isNavigationRequest() && request.frame() === page.mainFrame();
}

// Without the query, which can hold the logout context or the state of a sign-in.
export function recordNavigations(page: Page): readonly string[] {
  const navigations: string[] = [];
  page.on('request', (request) => {
    if (isPageNavigation(page, request)) navigations.push(originAndPath(request.url()));
  });
  return navigations;
}

// Start it before the navigation: it sees only the requests after the call.
export function nextNavigation(page: Page, matches: (url: URL) => boolean, timeout: number): Promise<string | undefined> {
  return page.waitForRequest((request) => isPageNavigation(page, request) && matches(new URL(request.url())), { timeout })
    .then((request) => originAndPath(request.url()), () => undefined);
}
