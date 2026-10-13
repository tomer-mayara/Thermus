import type { AccessResolver, RequestContext } from '../auth/access-context.ts';
import type { OrganizationAdministration } from '../organizations/organization-administration.ts';
import { readForm, ReturnDestinations, selectionIn, single } from './account-form.ts';
import { noticePage, organizationSelectionPage } from './account-pages.ts';
import type { BrowserSession, CookieEffects, OrganizationSwitch, SignedInBrowserSession } from './browser-session.ts';

// The routes check the session and current access, but not the permission of an operation: each operation checks
// its own permission before work starts.
export type AccountOperation = (request: Request, context: RequestContext) => Promise<Response>;

export interface AccountFailureReport {
  readonly path: string;
  readonly cause: unknown;
}

export type AccountFailureReporter = (report: AccountFailureReport) => void;

type OrganizationChoices = Pick<OrganizationAdministration, 'listOrganizations' | 'authorizeSelection'>;

export interface HostedAccountRoutesOptions {
  readonly publicBaseUrl: string;
  readonly session: BrowserSession;
  readonly accessResolver: AccessResolver;
  readonly organizations: OrganizationChoices;
  readonly reportFailure: AccountFailureReporter;
  readonly operation?: AccountOperation;
}

export class HostedAccountRoutes {
  private readonly session: BrowserSession;
  private readonly accessResolver: AccessResolver;
  private readonly organizations: OrganizationChoices;
  private readonly reportFailure: AccountFailureReporter;
  private readonly operation?: AccountOperation;
  private readonly publicOrigin: string;
  private readonly paths: { readonly organizations: string; readonly selection: string };
  private readonly destinations: ReturnDestinations;

  constructor(options: HostedAccountRoutesOptions) {
    this.session = options.session;
    this.accessResolver = options.accessResolver;
    this.organizations = options.organizations;
    this.reportFailure = options.reportFailure;
    this.operation = options.operation;
    this.publicOrigin = new URL(options.publicBaseUrl).origin;
    this.paths = {
      organizations: new URL('organizations', options.publicBaseUrl).pathname,
      selection: new URL('organizations/select', options.publicBaseUrl).pathname,
    };
    this.destinations = new ReturnDestinations(options.publicBaseUrl, this.paths.organizations);
  }

  async handle(request: Request): Promise<Response> {
    const session = await this.session.authenticate(request.headers.get('Cookie'));
    if (session.status === 'unavailable') return noticePage('unavailable');
    if (session.status === 'signed-out') return withCookies(noticePage('signedOut'), session.cookies);
    return withCookies(await this.answerSignedIn(request, session), session.cookies);
  }

  // A failure after the sign-in gets a page instead of an exception, so that the cookie effects of the session still
  // reach the browser.
  private async answerSignedIn(request: Request, session: SignedInBrowserSession): Promise<Response> {
    const path = new URL(request.url).pathname;
    try {
      if (path === this.paths.organizations) return await this.organizationPage(request, session);
      if (path === this.paths.selection) return await this.selectOrganization(request, session);
      return await this.tenantOperation(request, session);
    } catch (cause) {
      if (request.signal.aborted) throw cause;
      this.reportFailure({ path, cause });
      return noticePage('requestFailed');
    }
  }

  private async tenantOperation(request: Request, session: SignedInBrowserSession): Promise<Response> {
    const decision = await this.accessResolver.resolve(session.user);
    if (decision.allowed !== true) return noticePage('denied');
    const context = requireTrustedTenant(frozenCopy(decision.context));
    if (this.operation === undefined) return noticePage('notFound');
    return this.operation(request, context);
  }

  // The page needs the identity only, not access to an organization, so that a user without one gets the onboarding
  // guidance.
  private async organizationPage(request: Request, session: SignedInBrowserSession): Promise<Response> {
    if (request.method !== 'GET') return noticePage('methodNotAllowed', { Allow: 'GET' });
    const destinations = new URL(request.url).searchParams.getAll('return_to');
    const returnTo = destinations.length === 0 ? this.destinations.fallback : this.destinations.check(single(destinations));
    if (returnTo === undefined) return noticePage('invalidRequest');
    const organizations = await this.organizations.listOrganizations(session.user);
    if (organizations.length === 0) return noticePage('noOrganization');
    return organizationSelectionPage({ action: this.paths.selection, csrfToken: session.csrfToken, returnTo, organizations });
  }

  // The origin check comes before the body is read, so that a post from another site causes no work. Only the current
  // memberships of the session user decide; the session switches to the organization that the service gives.
  private async selectOrganization(request: Request, session: SignedInBrowserSession): Promise<Response> {
    if (request.method !== 'POST') return noticePage('methodNotAllowed', { Allow: 'POST' });
    if (request.headers.get('Origin') !== this.publicOrigin) return noticePage('forgedRequest');
    const form = await readForm(request);
    const selection = typeof form === 'string' ? form : selectionIn(form, session.csrfToken, this.destinations);
    if (typeof selection === 'string') return noticePage(selection);
    const organization = await this.organizations.authorizeSelection(session.user, selection.organizationId);
    if (organization === undefined) return noticePage('organizationDenied');
    const change = await session.selectOrganization(organization.organizationId);
    return withCookies(this.switchAnswer(change, selection.returnTo), change.cookies);
  }

  private switchAnswer(change: OrganizationSwitch, returnTo: string): Response {
    if (change.status === 'switched') return seeOther(this.destinations.urlOf(returnTo));
    return noticePage(change.status === 'signed-out' ? 'signedOut' : 'organizationDenied');
  }
}

// The cookie effects come before the cookies that the answer has already, so that a later cookie, such as the cookie
// of an organization switch, replaces an earlier one in the browser. A new answer also takes a redirect whose headers
// cannot change.
function withCookies(response: Response, cookies: CookieEffects): Response {
  if (cookies.length === 0) return response;
  const headers = new Headers([...response.headers].filter(([name]) => name !== 'set-cookie'));
  for (const cookie of [...cookies, ...response.headers.getSetCookie()]) headers.append('Set-Cookie', cookie);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function seeOther(location: string): Response {
  return new Response(null, { status: 303, headers: { Location: location, 'Cache-Control': 'no-store' } });
}

function requireTrustedTenant(context: RequestContext): RequestContext {
  if (typeof context.tenantId !== 'string' || context.tenantId === '') {
    throw new Error('The access decision has no trusted tenant');
  }
  return context;
}

// The copy keeps later changes to the resolver's records out of a running operation.
function frozenCopy<T>(value: T): T {
  return deepFreeze(structuredClone(value));
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}
