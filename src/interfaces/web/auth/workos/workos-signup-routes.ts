import type { BrowserSession, CookieEffects, OrganizationSwitch, SignedInBrowserSession } from '../../../../accounts/identity/browser-session.ts';
import type { BrowserSessionControls } from '../../../../accounts/identity/browser-session-controls.ts';
import { waitForRequest } from '../../../../runtime/http/request-cancellation.ts';
import { readForm, type FormRefusal } from '../../account/account-form.ts';
import { noticePage, seeOther } from './workos-session-pages.ts';
import { validateSignupDocuments } from '../../../../accounts/providers/workos/workos-signup-documents.ts';
import { signupRequestIn } from './workos-signup-form.ts';
import { signupClosedPage, signupContinuePage, signupCreateAccountPage, signupExistingAccountPage, signupFailurePage, signupFormPage, signupRequestNotice, signupUnavailablePage, type AccountCreationState, type AccountPaths } from './workos-signup-pages.ts';
import type { SignupActivation, SignupDocuments, SignupResult } from '../../../../accounts/organizations/signup-activation.ts';
import { SignupTenantHandoff, type RequestOperation, type SignupTenants } from './workos-signup-tenants.ts';
import { limitedAnswer, SignupAdmission } from './workos-signup-admission.ts';
import { SignupStart } from './workos-signup-start.ts';

export interface WorkOSSignupRoutesOptions {
  readonly publicBaseUrl: string;
  readonly enabled: boolean;
  readonly documents?: SignupDocuments;
  // Signup reads the session. Create account looks up the email and starts the account creation of the provider, which
  // returns to signup.
  readonly session: BrowserSession & Pick<BrowserSessionControls, 'startSignIn'>;
  readonly activation: SignupActivation;
  readonly reportFailure: (message: string) => void;
  readonly clock?: () => number;
  // Without the tenant registry, signup checks no cap and requests no tenant.
  readonly tenants?: SignupTenants;
  // The URLs of the provider sign-in, where the POST of step 1 redirects. The step 1 page allows their origins as form
  // destinations.
  readonly providerOrigins?: readonly string[];
}

// Fixed text: the operator log gets no request value and no provider detail.
const REQUEST_FAILED = 'Hosted signup request failed.';

export class WorkOSSignupRoutes {
  private readonly options: WorkOSSignupRoutesOptions;
  private readonly documents?: SignupDocuments;
  private readonly origin: string;
  private readonly path: string;
  // The account creation path is also the route of Create account.
  private readonly account: AccountPaths;
  private readonly destination: URL;
  private readonly selector: string;
  private readonly quickStartDestination: URL;
  private readonly admission: SignupAdmission;
  private readonly handoff?: SignupTenantHandoff;
  // Step 1: the account creation at the account creation path.
  private readonly start: SignupStart;

  constructor(options: WorkOSSignupRoutesOptions) {
    this.options = options;
    this.documents = options.documents === undefined ? undefined : validateSignupDocuments(options.documents);
    if (options.enabled && this.documents === undefined) throw new Error('Enabled signup requires approved documents.');
    if (options.enabled && this.documents?.purpose !== 'organization-creation') throw new Error('Enabled organization creation requires organization-creation documents.');
    const base = new URL(options.publicBaseUrl);
    if (!base.pathname.endsWith('/')) base.pathname += '/';
    this.origin = base.origin;
    this.path = new URL('signup', base).pathname;
    this.account = accountPathsOf(base, options.providerOrigins);
    this.quickStartDestination = new URL('quick-start', base);
    this.destination = new URL('organizations', base);
    this.destination.searchParams.set('return_to', base.pathname);
    this.selector = this.destination.pathname + this.destination.search;
    this.admission = new SignupAdmission(options.clock ?? Date.now);
    if (options.tenants !== undefined) this.handoff = new SignupTenantHandoff(options.tenants, options.reportFailure);
    this.start = new SignupStart({
      enabled: options.enabled, origin: this.origin, returnTo: this.path, session: options.session, activation: options.activation,
      admission: this.admission, handoff: this.handoff, reportFailure: options.reportFailure, accountPage: (state) => this.createAccountPage(state),
    });
  }

  handles(pathname: string): boolean {
    return pathname === this.path || pathname === this.account.creation;
  }

  async handle(request: Request): Promise<Response> {
    request.signal.throwIfAborted();
    const pathname = new URL(request.url).pathname;
    if (pathname === this.account.creation) return this.start.handle(request);
    if (pathname !== this.path) return signupRequestNotice(noticePage('notFound'));
    if (!['GET', 'HEAD', 'POST'].includes(request.method)) return signupRequestNotice(noticePage('methodNotAllowed', { Allow: 'GET, HEAD, POST' }));
    // Only the free tier exists, so the route ignores the tier of the marketing link (plan section 4.2).
    if (request.method === 'HEAD') return this.headAnswer(request);
    if (!this.options.enabled) return signupClosedPage(request.method === 'POST' ? 403 : 200);
    return this.handleEnabled(request);
  }

  // HEAD gets the headers of the page that GET gives before the session: closed with the switch off or a full cap, and
  // else step 1.
  private async headAnswer(request: Request): Promise<Response> {
    const closed = this.options.enabled ? await this.handoff?.closedAnswer(request, (start) => waitForRequest(request.signal, start)) : signupClosedPage();
    const answer = closed ?? this.createAccountPage();
    return new Response(null, { status: answer.status, headers: answer.headers });
  }

  // A POST runs in an admission slot, after the Origin check.
  private async handleEnabled(request: Request): Promise<Response> {
    if (request.method !== 'POST') return this.answerSession(request, (start) => waitForRequest(request.signal, start));
    if (request.headers.get('Origin') !== this.origin) return signupRequestNotice(noticePage('forgedRequest'));
    return await this.admission.inSlot(request, (run) => this.answerSession(request, run)) ?? limitedAnswer();
  }

  private async answerSession(request: Request, run: RequestOperation): Promise<Response> {
    let cookies: CookieEffects = [];
    try {
      // The cap comes before the notice, and a POST reads it inside its admission slot.
      const closed = this.handoff === undefined ? undefined : await this.handoff.closedAnswer(request, run);
      if (closed !== undefined) return closed;
      const state = await run(() => this.options.session.authenticate(request.headers.get('Cookie')));
      request.signal.throwIfAborted();
      cookies = state.cookies;
      if (state.status === 'signed-out') return withCookies(this.createAccountPage({ status: request.method === 'GET' ? 200 : 401 }), cookies);
      const answer = request.method === 'GET' ? await this.inspectSignup(request, state, run) : await this.activateForm(request, state, run);
      return withCookies(answer, cookies);
    } catch (error) {
      if (request.signal.aborted) throw error;
      this.options.reportFailure(REQUEST_FAILED);
      return withCookies(signupUnavailablePage(), cookies);
    }
  }

  private async inspectSignup(request: Request, state: SignedInBrowserSession, run: RequestOperation): Promise<Response> {
    const result = await run(() => this.options.activation.inspect({ user: state.user, signal: request.signal }));
    request.signal.throwIfAborted();
    if (result.status === 'sign-in-required') return this.createAccountPage();
    if (result.status === 'existing-access') return signupContinuePage(this.selector);
    if (result.status === 'existing-account') return signupExistingAccountPage(this.selector);
    if (result.status === 'eligible') return signupFormPage(this.requireDocuments(), state.csrfToken, this.path);
    if (result.status === 'support-required') return signupFailurePage(409, 'Contact support to review this activation.', result.canContinue ? this.selector : undefined);
    return signupUnavailablePage();
  }

  private async activateForm(request: Request, state: SignedInBrowserSession, run: RequestOperation): Promise<Response> {
    if (!this.admission.admit(state.user.subject)) return limitedAnswer();
    const documents = this.requireDocuments();
    const creation = await creationIn(request, state.csrfToken, documents.version);
    if (typeof creation === 'string') return signupRequestNotice(noticePage(creation));
    const result = await run(() => this.options.activation.activate({ user: state.user, organizationName: creation.organizationName, documents, signal: request.signal }));
    request.signal.throwIfAborted();
    if (result.status !== 'active') return this.activationAnswer(result);
    // An active result confirms the first Admin membership, so the tenant request comes now, before Quick start opens.
    await this.handoff?.requestTenant(request, { organizationId: result.organizationId, organizationName: creation.organizationName }, run);
    const selected = await run(() => state.selectOrganization(result.organizationId));
    request.signal.throwIfAborted();
    return this.selectionAnswer(selected);
  }

  private selectionAnswer(selected: OrganizationSwitch): Response {
    if (selected.status === 'switched') return seeOther(this.quickStartDestination.href, selected.cookies);
    const status = selected.status === 'signed-out' ? 401 : 403;
    return withCookies(signupFailurePage(status, 'Your organization could not be opened. Sign in again to continue.'), selected.cookies);
  }

  private activationAnswer(result: SignupResult): Response {
    if (result.status === 'sign-in-required') return this.createAccountPage({ status: 401 });
    if (result.status === 'existing-access') return seeOther(this.destination.href, []);
    if (result.status === 'existing-account') return signupExistingAccountPage(this.selector, 403);
    if (result.status === 'unverified') return signupFailurePage(403, 'Verify your email before you activate access.');
    if (result.status === 'support-required') return signupFailurePage(409, 'Contact support to review this activation.');
    return signupUnavailablePage();
  }

  // Step 1 of free access: the notice, the email form of Create account, and a sign-in line for a person who has an
  // account. After a POST of the form, it also shows the answer to the posted email.
  private createAccountPage(state: AccountCreationState = {}): Response {
    return signupCreateAccountPage(this.requireDocuments(), this.account, state);
  }

  private requireDocuments(): SignupDocuments {
    if (this.documents === undefined) throw new Error('Enabled signup requires approved documents.');
    return this.documents;
  }
}

// The two ways to an account in step 1 under the public base path, and the origin of each provider sign-in URL once.
function accountPathsOf(base: URL, providerUrls: readonly string[] = []): AccountPaths {
  return { creation: new URL('signup/start', base).pathname, signIn: new URL('login', base).pathname,
    providerOrigins: [...new Set(providerUrls.map((value) => new URL(value).origin))] };
}

async function creationIn(request: Request, csrfToken: string, documentVersion: string): Promise<{ readonly organizationName: string } | FormRefusal> {
  const form = await readForm(request);
  request.signal.throwIfAborted();
  return typeof form === 'string' ? form : signupRequestIn(form, csrfToken, documentVersion);
}


function withCookies(answer: Response, cookies: CookieEffects): Response {
  const headers = new Headers([...answer.headers].filter(([name]) => name !== 'set-cookie'));
  for (const cookie of [...cookies, ...answer.headers.getSetCookie()]) headers.append('Set-Cookie', cookie);
  return new Response(answer.body, { status: answer.status, statusText: answer.statusText, headers });
}
