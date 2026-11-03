import type { BrowserSessionControls } from '../../../../accounts/identity/browser-session-controls.ts';
import { waitForRequest } from '../../../../runtime/http/request-cancellation.ts';
import { noticePage, seeOther } from './workos-session-pages.ts';
import { limitedAnswer } from './workos-signup-admission.ts';
import { SignupEmailCheck, type SignupEmailCheckOptions } from './workos-signup-email.ts';
import { signupClosedPage, signupRequestNotice, signupUnavailablePage } from './workos-signup-pages.ts';
import type { RequestOperation, SignupTenantHandoff } from './workos-signup-tenants.ts';

/** The parts of signup that the account creation of step 1 uses. */
export interface SignupStartOptions extends SignupEmailCheckOptions {
  /** The switch. Closed signup starts no lookup and no provider sign-in. */
  readonly enabled: boolean;
  /** The public origin. A POST from another origin changes nothing. */
  readonly origin: string;
  /** The signup path, where the provider returns after the account creation. */
  readonly returnTo: string;
  /** Starts the provider sign-in at its sign-up screen. */
  readonly session: Pick<BrowserSessionControls, 'startSignIn'>;
  /** The free-tenant cap. Without the tenant registry, signup checks no cap. */
  readonly handoff?: SignupTenantHandoff;
}

/** The methods of the account creation path. */
const METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'POST']);
/** The fixed line of a failed request. */
const REQUEST_FAILED = 'Hosted signup request failed.';

/**
 * The account creation of step 1 of free access, at the account creation path. GET and HEAD open the sign-up screen of
 * the provider without an email. A POST takes the email of the step 1 form, which the email check answers.
 */
export class SignupStart {
  /** The switch, the paths, and the collaborators of signup. */
  private readonly options: SignupStartOptions;
  /** The email check of the POST. */
  private readonly emailCheck: SignupEmailCheck;

  constructor(options: SignupStartOptions) {
    this.options = options;
    this.emailCheck = new SignupEmailCheck(options);
  }

  /** HEAD gets the status and headers of GET. Another method gets the branded refusal. */
  async handle(request: Request): Promise<Response> {
    if (!METHODS.has(request.method)) return signupRequestNotice(noticePage('methodNotAllowed', { Allow: 'GET, HEAD, POST' }));
    if (request.method === 'POST') return this.handlePost(request);
    const answer = await this.startAnswer(request);
    return request.method === 'HEAD' ? new Response(null, { status: answer.status, headers: answer.headers }) : answer;
  }

  /** Like the sign-in route, GET reads no session and needs no Origin check. Closed signup and a full cap start nothing. */
  private async startAnswer(request: Request): Promise<Response> {
    if (!this.options.enabled) return signupClosedPage();
    const run: RequestOperation = (start) => waitForRequest(request.signal, start);
    return this.guarded(request, () => this.unlessClosed(request, run, () => this.startSignUp(run)));
  }

  /**
   * The form of step 1 has no CSRF token, because step 1 has no session. The Origin check protects it. The POST holds
   * an admission slot from the cap read to the provider start.
   */
  private async handlePost(request: Request): Promise<Response> {
    if (request.headers.get('Origin') !== this.options.origin) return signupRequestNotice(noticePage('forgedRequest'));
    if (!this.options.enabled) return signupClosedPage(403);
    const answer = await this.options.admission.inSlot(request, (run) => this.guarded(request, () => this.emailAnswer(request, run)));
    return answer ?? limitedAnswer();
  }

  /** The cap comes first, then the email check, which can open the sign-up screen with the email as login hint. */
  private emailAnswer(request: Request, run: RequestOperation): Promise<Response> {
    return this.unlessClosed(request, run, () => this.emailCheck.answer(request, run, (loginHint) => this.startSignUp(run, loginHint)));
  }

  /** A full cap gives the closed notice, and a cap that cannot be read gives the failure page. */
  private async unlessClosed(request: Request, run: RequestOperation, next: () => Promise<Response>): Promise<Response> {
    const closed = await this.options.handoff?.closedAnswer(request, run);
    return closed ?? next();
  }

  /** Opens the sign-up screen of the provider, which returns to signup. The login hint fills in its email. */
  private async startSignUp(run: RequestOperation, loginHint?: string): Promise<Response> {
    const start = await run(() => this.options.session.startSignIn({ returnTo: this.options.returnTo, screenHint: 'sign-up', ...(loginHint === undefined ? {} : { loginHint }) }));
    return seeOther(start.url, start.cookies);
  }

  /** A cancelled request logs nothing. Another failure logs only fixed text and gives the failure page. */
  private async guarded(request: Request, answer: () => Promise<Response>): Promise<Response> {
    try {
      return await answer();
    } catch (error) {
      if (request.signal.aborted) throw error;
      this.options.reportFailure(REQUEST_FAILED);
      return signupUnavailablePage();
    }
  }
}
