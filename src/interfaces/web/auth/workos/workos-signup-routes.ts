import type { BrowserSession, CookieEffects, OrganizationSwitch, SignedInBrowserSession } from '../../../../accounts/identity/browser-session.ts';
import { waitForRequest } from '../../../../runtime/http/request-cancellation.ts';
import { readForm, type FormRefusal } from '../../account/account-form.ts';
import { noticePage, seeOther } from './workos-session-pages.ts';
import { validateSignupDocuments } from '../../../../accounts/providers/workos/workos-signup-documents.ts';
import { signupRequestIn } from './workos-signup-form.ts';
import { signupClosedPage, signupContinuePage, signupFailurePage, signupFormPage, signupRequestNotice, signupSignInPage } from './workos-signup-pages.ts';
import type { SignupActivation, SignupDocuments, SignupResult } from '../../../../accounts/organizations/signup-activation.ts';
import { SignupTenantHandoff, type RequestOperation, type SignupTenants } from './workos-signup-tenants.ts';

export interface WorkOSSignupRoutesOptions {
  readonly publicBaseUrl: string;
  readonly enabled: boolean;
  readonly documents?: SignupDocuments;
  readonly session: BrowserSession;
  readonly activation: SignupActivation;
  readonly reportFailure: (message: string) => void;
  readonly clock?: () => number;
  // Without the tenant registry, signup checks no cap and requests no tenant.
  readonly tenants?: SignupTenants;
}

// Process-local admission only: eight concurrent POSTs, three attempts per subject per minute, at most 1,024
// subjects retained. A full table refuses new subjects until an entry expires. It is not a global provider quota.
const MAX_CONCURRENT_POSTS = 8;
const MAX_SUBJECTS = 1024;
const ATTEMPTS_PER_MINUTE = 3;
const WINDOW_MS = 60_000;

export class WorkOSSignupRoutes {
  private readonly options: WorkOSSignupRoutesOptions;
  private readonly documents?: SignupDocuments;
  private readonly origin: string;
  private readonly path: string;
  private readonly destination: URL;
  private readonly quickStartDestination: URL;
  private readonly login: string;
  private readonly clock: () => number;
  private readonly handoff?: SignupTenantHandoff;
  private readonly attempts = new Map<string, { until: number; count: number }>();
  private pending = 0;

  constructor(options: WorkOSSignupRoutesOptions) {
    this.options = options;
    this.documents = options.documents === undefined ? undefined : validateSignupDocuments(options.documents);
    if (options.enabled && this.documents === undefined) throw new Error('Enabled signup requires approved documents.');
    if (options.enabled && this.documents?.purpose !== 'organization-creation') throw new Error('Enabled organization creation requires organization-creation documents.');
    const base = new URL(options.publicBaseUrl);
    if (!base.pathname.endsWith('/')) base.pathname += '/';
    this.origin = base.origin;
    this.path = new URL('signup', base).pathname;
    this.quickStartDestination = new URL('quick-start', base);
    this.destination = new URL('organizations', base);
    this.destination.searchParams.set('return_to', base.pathname);
    const login = new URL('login', base);
    login.searchParams.set('return_to', this.path);
    this.login = login.pathname + login.search;
    this.clock = options.clock ?? Date.now;
    if (options.tenants !== undefined) this.handoff = new SignupTenantHandoff(options.tenants, options.reportFailure);
  }

  handles(pathname: string): boolean {
    return pathname === this.path;
  }

  async handle(request: Request): Promise<Response> {
    request.signal.throwIfAborted();
    if (!this.handles(new URL(request.url).pathname)) return signupRequestNotice(noticePage('notFound'));
    if (!['GET', 'HEAD', 'POST'].includes(request.method)) return signupRequestNotice(noticePage('methodNotAllowed', { Allow: 'GET, HEAD, POST' }));
    // Only the free tier exists, so the route ignores the tier of the marketing link (plan section 4.2).
    if (request.method === 'HEAD') return this.headAnswer(request);
    if (!this.options.enabled) return signupClosedPage(request.method === 'POST' ? 403 : 200);
    return this.handleEnabled(request);
  }

  // HEAD gets the headers of the page that GET gives before the session: closed with the switch off or a full cap.
  private async headAnswer(request: Request): Promise<Response> {
    const closed = this.options.enabled ? await this.handoff?.closedAnswer(request, (start) => waitForRequest(request.signal, start)) : signupClosedPage();
    const answer = closed ?? signupFailurePage(200, 'Sign in to start free access.');
    return new Response(null, { status: answer.status, headers: answer.headers });
  }

  private async handleEnabled(request: Request): Promise<Response> {
    const post = request.method === 'POST';
    if (post && request.headers.get('Origin') !== this.origin) return signupRequestNotice(noticePage('forgedRequest'));
    if (post && this.pending >= MAX_CONCURRENT_POSTS) return limited();
    if (post) this.pending++;
    let outstanding: Promise<unknown> | undefined;
    const run: RequestOperation = (start) => waitForRequest(request.signal, () => {
      const operation = start();
      outstanding = operation;
      return operation;
    });
    try {
      return await this.answerSession(request, run);
    } finally {
      if (post) {
        // A disconnected request still holds its slot until its last provider operation settles.
        if (outstanding === undefined) this.pending--;
        else void outstanding.then(() => { this.pending--; }, () => { this.pending--; });
      }
    }
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
      const documents = this.requireDocuments();
      if (state.status === 'signed-out') {
        const answer = signupSignInPage(documents, this.login, request.method === 'GET' ? 200 : 401);
        return withCookies(answer, cookies);
      }
      const answer = request.method === 'GET' ? await this.inspectSignup(request, state, run) : await this.activateForm(request, state, run);
      return withCookies(answer, cookies);
    } catch (error) {
      if (request.signal.aborted) throw error;
      this.options.reportFailure('Hosted signup request failed.');
      return withCookies(signupFailurePage(503, 'Activation is temporarily unavailable. Try again later.'), cookies);
    }
  }

  private async inspectSignup(request: Request, state: SignedInBrowserSession, run: RequestOperation): Promise<Response> {
    const result = await run(() => this.options.activation.inspect({ user: state.user, signal: request.signal }));
    request.signal.throwIfAborted();
    const destination = this.destination.pathname + this.destination.search;
    if (result.status === 'sign-in-required') return signupSignInPage(this.requireDocuments(), this.login);
    if (result.status === 'existing-access') return signupContinuePage(destination);
    if (result.status === 'eligible') return signupFormPage(this.requireDocuments(), state.csrfToken, this.path);
    if (result.status === 'support-required') return signupFailurePage(409, 'Contact support to review this activation.', result.canContinue ? destination : undefined);
    return signupFailurePage(503, 'Activation is temporarily unavailable. Try again later.');
  }

  private async activateForm(request: Request, state: SignedInBrowserSession, run: RequestOperation): Promise<Response> {
    if (!this.admit(state.user.subject)) return limited();
    const documents = this.requireDocuments();
    const creation = await creationIn(request, state.csrfToken, documents.version);
    if (typeof creation === 'string') return signupRequestNotice(noticePage(creation));
    const result = await run(() => this.options.activation.activate({ user: state.user, organizationName: creation.organizationName, documents, signal: request.signal }));
    request.signal.throwIfAborted();
    if (result.status !== 'active') return this.activationAnswer(result);
    // An active result confirms the first Admin membership, so the tenant request comes now, before Quick start opens.
    await this.handoff?.requestTenant(request, result.organizationId, run);
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
    if (result.status === 'sign-in-required') return signupSignInPage(this.requireDocuments(), this.login, 401);
    if (result.status === 'existing-access') return seeOther(this.destination.href, []);
    if (result.status === 'unverified') return signupFailurePage(403, 'Verify your email before you activate access.');
    if (result.status === 'support-required') return signupFailurePage(409, 'Contact support to review this activation.');
    return signupFailurePage(503, 'Activation is temporarily unavailable. Try again later.');
  }

  private requireDocuments(): SignupDocuments {
    if (this.documents === undefined) throw new Error('Enabled signup requires approved documents.');
    return this.documents;
  }

  private admit(subject: string): boolean {
    const now = this.clock();
    for (const [key, entry] of this.attempts) if (entry.until <= now) this.attempts.delete(key);
    const prior = this.attempts.get(subject);
    if (prior !== undefined) {
      if (prior.count >= ATTEMPTS_PER_MINUTE) return false;
      prior.count++;
      return true;
    }
    if (this.attempts.size >= MAX_SUBJECTS) return false;
    this.attempts.set(subject, { until: now + WINDOW_MS, count: 1 });
    return true;
  }
}

async function creationIn(request: Request, csrfToken: string, documentVersion: string): Promise<{ readonly organizationName: string } | FormRefusal> {
  const form = await readForm(request);
  request.signal.throwIfAborted();
  return typeof form === 'string' ? form : signupRequestIn(form, csrfToken, documentVersion);
}

function limited(): Response {
  const answer = signupFailurePage(429, 'Too many activation requests. Try again later.');
  answer.headers.set('Retry-After', '60');
  return answer;
}

function withCookies(answer: Response, cookies: CookieEffects): Response {
  const headers = new Headers([...answer.headers].filter(([name]) => name !== 'set-cookie'));
  for (const cookie of [...cookies, ...answer.headers.getSetCookie()]) headers.append('Set-Cookie', cookie);
  return new Response(answer.body, { status: answer.status, statusText: answer.statusText, headers });
}
