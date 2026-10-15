import { randomBytes } from 'node:crypto';
import type { CookieEffects } from '../browser-session.ts';
import { sameSecret, SIGN_IN_MAX_AGE_SECONDS, signInCookie, type SealedCookie, type SessionEnvelope, type SignInEnvelope } from './session-cookies.ts';
import { isOAuthRefusal, sealedSessionOf, type CodeExchange, type WorkOSSessionClient } from './workos-session-client.ts';
import type { WorkOSSettings } from './workos-settings.ts';

export interface SignInStart {
  readonly url: string;
  readonly cookies: CookieEffects;
}

export interface SignInCallback {
  readonly query: URLSearchParams;
  readonly cookieHeader: string | null;
}

export type SignInRefusal = 'sign-in-missing' | 'sign-in-expired' | 'provider-error' | 'invalid-callback' | 'state-mismatch' | 'code-refused';

export type SignInCompletion =
  | { readonly status: 'signed-in'; readonly returnTo: string; readonly cookies: CookieEffects }
  | { readonly status: 'refused'; readonly reason: SignInRefusal; readonly cookies: CookieEffects };

export interface SignInOnboarding {
  complete(exchange: CodeExchange): Promise<CodeExchange>;
}

// Password proves MFA only in an environment that requires its second step before the callback.
export type MfaEvidencePolicy = 'password-mfa-required' | 'unproven';

export interface AuthKitSignInOptions {
  readonly mfaEvidence?: MfaEvidencePolicy;
  readonly onboarding?: SignInOnboarding;
  readonly userManagement: Pick<WorkOSSessionClient['userManagement'], 'getAuthorizationUrlWithPKCE' | 'authenticateWithCode'>;
  readonly settings: Pick<WorkOSSettings, 'clientId' | 'redirectUri' | 'cookiePassword'>;
  readonly clock: () => number;
  readonly sessionCookie: SealedCookie<SessionEnvelope>;
}

interface PendingSignIn {
  readonly code: string;
  readonly codeVerifier: string;
  readonly returnTo: string;
}

const CSRF_TOKEN_BYTES = 32;

// The AuthKit sign-in of a browser with PKCE. The sign-in cookie keeps the state and the verifier of the browser until
// the callback, and the callback turns the code into a new session cookie.
export class AuthKitSignIn {
  private readonly userManagement: AuthKitSignInOptions['userManagement'];
  private readonly settings: AuthKitSignInOptions['settings'];
  private readonly clock: () => number;
  private readonly sessionCookie: SealedCookie<SessionEnvelope>;
  private readonly signInCookie: SealedCookie<SignInEnvelope>;
  private readonly onboarding: SignInOnboarding | undefined;
  private readonly mfaEvidence: MfaEvidencePolicy;

  constructor(options: AuthKitSignInOptions) {
    this.userManagement = options.userManagement;
    this.onboarding = options.onboarding;
    this.mfaEvidence = options.mfaEvidence ?? 'unproven';
    this.settings = options.settings;
    this.clock = options.clock;
    this.sessionCookie = options.sessionCookie;
    this.signInCookie = signInCookie(options.settings.cookiePassword);
  }

  async start(returnTo: string): Promise<SignInStart> {
    const { url, state, codeVerifier } = await this.userManagement.getAuthorizationUrlWithPKCE({
      provider: 'authkit',
      redirectUri: this.settings.redirectUri,
      clientId: this.settings.clientId,
    });
    const expiresAt = this.clock() + SIGN_IN_MAX_AGE_SECONDS * 1_000;
    return { url, cookies: [this.signInCookie.setCookie({ state, codeVerifier, returnTo, expiresAt })] };
  }

  // Each answer clears the sign-in cookie, so that its state and verifier serve one callback only.
  async complete(callback: SignInCallback): Promise<SignInCompletion> {
    const pending = this.pending(callback);
    if (typeof pending === 'string') return this.refused(pending);
    const exchange = await this.exchange(pending);
    if (exchange === undefined) return this.refused('code-refused');
    sealedSessionOf(exchange);
    const completed = this.onboarding === undefined ? exchange : await this.onboarding.complete(exchange);
    const session: SessionEnvelope = {
      seal: sealedSessionOf(completed),
      csrf: randomBytes(CSRF_TOKEN_BYTES).toString('base64url'),
      // WorkOS gives no MFA claim. Optional MFA cannot prove that this sign-in completed its second step.
      mfa: this.mfaEvidence === 'password-mfa-required' && exchange.authenticationMethod === 'Password',
    };
    return { status: 'signed-in', returnTo: pending.returnTo, cookies: [this.signInCookie.clearCookie(), this.sessionCookie.setCookie(session)] };
  }

  // The checks before the code exchange: the sign-in of this browser, the answer of AuthKit, and its state.
  private pending({ query, cookieHeader }: SignInCallback): PendingSignIn | SignInRefusal {
    const signIn = this.signInCookie.contentOf(cookieHeader);
    if (signIn === undefined) return 'sign-in-missing';
    if (signIn.expiresAt <= this.clock()) return 'sign-in-expired';
    if (query.has('error')) return 'provider-error';
    const code = onlyValue(query, 'code');
    const state = onlyValue(query, 'state');
    if (code === undefined || state === undefined) return 'invalid-callback';
    if (!sameSecret(state, signIn.state)) return 'state-mismatch';
    return { code, codeVerifier: signIn.codeVerifier, returnTo: signIn.returnTo };
  }

  // WorkOS refuses a code that is not valid, was used, or has expired.
  private async exchange(pending: PendingSignIn): Promise<CodeExchange | undefined> {
    try {
      return await this.userManagement.authenticateWithCode({
        clientId: this.settings.clientId,
        code: pending.code,
        codeVerifier: pending.codeVerifier,
        session: { sealSession: true, cookiePassword: this.settings.cookiePassword },
      });
    } catch (error) {
      if (isOAuthRefusal(error)) return undefined;
      throw error;
    }
  }

  private refused(reason: SignInRefusal): SignInCompletion {
    return { status: 'refused', reason, cookies: [this.signInCookie.clearCookie()] };
  }
}

// A callback value must appear exactly one time and must not be empty.
function onlyValue(query: URLSearchParams, name: string): string | undefined {
  const values = query.getAll(name);
  return values.length === 1 && values[0] !== '' ? values[0] : undefined;
}
