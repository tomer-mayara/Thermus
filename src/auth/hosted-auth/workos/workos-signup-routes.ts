import type { BrowserSession, CookieEffects, SignedInBrowserSession } from '../browser-session.ts';
import { waitForRequest } from '../../../http/request-cancellation.ts';
import { readForm } from '../../../hosted-admin/account-form.ts';
import { noticePage, seeOther } from './workos-session-pages.ts';
import { validateSignupDocuments } from './workos-signup-documents.ts';
import { signupAgreementIn } from './workos-signup-form.ts';
import { signupClosedPage, signupContinuePage, signupFailurePage, signupFormPage, signupSignInPage } from './workos-signup-pages.ts';
import type { SignupActivation, SignupDocuments, SignupResult } from './workos-signup.ts';

export interface WorkOSSignupRoutesOptions {
  readonly publicBaseUrl: string;
  readonly enabled: boolean;
  readonly documents?: SignupDocuments;
  readonly session: BrowserSession;
  readonly activation: SignupActivation;
  readonly reportFailure: (message: string) => void;
  readonly clock?: () => number;
}

// Process-local admission only: eight concurrent POSTs, three attempts per subject per minute, at most 1,024
// subjects retained. A full table refuses new subjects until an entry expires. It is not a global provider quota.
const MAX_CONCURRENT_POSTS = 8;
const MAX_SUBJECTS = 1024;
const ATTEMPTS_PER_MINUTE = 3;
const WINDOW_MS = 60_000;

type RequestOperation = <T>(start: () => Promise<T>) => Promise<T>;

export class WorkOSSignupRoutes {
  private readonly options: WorkOSSignupRoutesOptions;
  private readonly documents?: SignupDocuments;
  private readonly origin: string;
  private readonly path: string;
  private readonly destination: URL;
  private readonly login: string;
  private readonly clock: () => number;
  private readonly attempts = new Map<string, { until: number; count: number }>();
  private pending = 0;

  constructor(options: WorkOSSignupRoutesOptions) {
    this.options = options;
    this.documents = options.documents === undefined ? undefined : validateSignupDocuments(options.documents);
    if (options.enabled && this.documents === undefined) throw new Error('Enabled signup requires approved documents.');
    const base = new URL(options.publicBaseUrl);
    if (!base.pathname.endsWith('/')) base.pathname += '/';
    this.origin = base.origin;
    this.path = new URL('signup', base).pathname;
    this.destination = new URL('organizations', base);
    this.destination.searchParams.set('return_to', base.pathname);
    const login = new URL('login', base);
    login.searchParams.set('return_to', this.path);
    this.login = login.pathname + login.search;
    this.clock = options.clock ?? Date.now;
  }

  handles(pathname: string): boolean {
    return pathname === this.path;
  }

  async handle(request: Request): Promise<Response> {
    request.signal.throwIfAborted();
    if (!this.handles(new URL(request.url).pathname)) return noticePage('notFound');
    if (!['GET', 'HEAD', 'POST'].includes(request.method)) return noticePage('methodNotAllowed', { Allow: 'GET, HEAD, POST' });
    if (request.method === 'HEAD') {
      const answer = this.options.enabled ? signupFailurePage(200, 'Sign in to start free access.') : signupClosedPage();
      return new Response(null, { status: answer.status, headers: answer.headers });
    }
    if (!this.options.enabled) return signupClosedPage(request.method === 'POST' ? 403 : 200);
    return this.handleEnabled(request);
  }

  private async handleEnabled(request: Request): Promise<Response> {
    const post = request.method === 'POST';
    if (post && request.headers.get('Origin') !== this.origin) return noticePage('forgedRequest');
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
      const state = await run(() => this.options.session.authenticate(request.headers.get('Cookie')));
      request.signal.throwIfAborted();
      cookies = state.cookies;
      const documents = this.requireDocuments();
      if (state.status === 'signed-out') {
        const answer = request.method === 'GET' ? signupSignInPage(documents, this.login) : signupFailurePage(401, 'Sign in before you activate access.');
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
    if (result.status === 'existing-access') return signupContinuePage(destination);
    if (result.status === 'eligible') return signupFormPage(this.requireDocuments(), state.csrfToken, this.path);
    if (result.status === 'support-required') return signupFailurePage(409, 'Contact support to review this activation.', result.canContinue ? destination : undefined);
    return signupFailurePage(503, 'Activation is temporarily unavailable. Try again later.');
  }

  private async activateForm(request: Request, state: SignedInBrowserSession, run: RequestOperation): Promise<Response> {
    if (!this.admit(state.user.subject)) return limited();
    const documents = this.requireDocuments();
    const form = await readForm(request);
    request.signal.throwIfAborted();
    const agreement = typeof form === 'string' ? form : signupAgreementIn(form, state.csrfToken, documents.version);
    if (agreement !== 'accepted') return noticePage(agreement);
    const result = await run(() => this.options.activation.activate({ user: state.user, documents, signal: request.signal }));
    request.signal.throwIfAborted();
    return this.activationAnswer(result);
  }

  private activationAnswer(result: SignupResult): Response {
    if (result.status === 'active' || result.status === 'existing-access') return seeOther(this.destination.href, []);
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

function limited(): Response {
  const answer = signupFailurePage(429, 'Too many activation requests. Try again later.');
  answer.headers.set('Retry-After', '60');
  return answer;
}

function withCookies(answer: Response, cookies: CookieEffects): Response {
  for (const cookie of cookies) answer.headers.append('Set-Cookie', cookie);
  return answer;
}
