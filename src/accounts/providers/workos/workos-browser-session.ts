import { decodeJwt, errors } from 'jose';
import type { AuthenticatedUser } from '../../identity/access-context.ts';
import type { CookieEffects, OrganizationSwitch } from '../../identity/browser-session.ts';
import type { BrowserProfile, BrowserSessionControls, BrowserSignInCompletion, ProfiledBrowserSessionState, ProfiledSignedInBrowserSession, SessionEnd } from '../../identity/browser-session-controls.ts';
import { sessionCookie, type SealedCookie, type SessionEnvelope } from './session-cookies.ts';
import { isDamagedSeal, isNewSigningKey, isOAuthRefusal, sealedSessionOf } from './workos-session-client.ts';
import type { SealRefresh, SessionFacts, WorkOSSealedSession, WorkOSSessionClient } from './workos-session-client.ts';
import { AuthKitSignIn, type SignInCallback, type SignInStart, type SignInOnboarding } from './workos-sign-in.ts';
import type { WorkOSSettings } from './workos-settings.ts';

export interface WorkOSBrowserSessionOptions {
  readonly onboarding?: SignInOnboarding;
  readonly workos: WorkOSSessionClient;
  readonly settings: Pick<WorkOSSettings, 'clientId' | 'redirectUri' | 'cookiePassword'>;
  // From workosAuthority(), so that browser sessions and Connect tokens map their users into the same authority.
  readonly authority: string;
  // Milliseconds since the Unix epoch.
  readonly clock?: () => number;
}

type SignedOut = Extract<ProfiledBrowserSessionState, { status: 'signed-out' }>;
type RefreshFailure = Extract<SealRefresh, { authenticated: false }>;
type RefreshSuccess = Extract<SealRefresh, { authenticated: true }>;

// The hosted browser session of WorkOS AuthKit. The session cookie holds the sealed WorkOS session together with the
// CSRF token, because the WorkOS seal changes at each refresh.
export class WorkOSBrowserSession implements BrowserSessionControls {
  private readonly userManagement: WorkOSSessionClient['userManagement'];
  private readonly cookiePassword: string;
  private readonly authority: string;
  private readonly sessionCookie: SealedCookie<SessionEnvelope>;
  private readonly signIn: AuthKitSignIn;

  constructor(options: WorkOSBrowserSessionOptions) {
    this.userManagement = options.workos.userManagement;
    this.cookiePassword = options.settings.cookiePassword;
    this.authority = options.authority;
    this.sessionCookie = sessionCookie(options.settings.cookiePassword);
    const clock = options.clock ?? Date.now;
    this.signIn = new AuthKitSignIn({ userManagement: this.userManagement, settings: options.settings, clock, sessionCookie: this.sessionCookie, ...(options.onboarding === undefined ? {} : { onboarding: options.onboarding }) });
  }

  async authenticate(cookieHeader: string | null): Promise<ProfiledBrowserSessionState> {
    if (!this.sessionCookie.isSentIn(cookieHeader)) return { status: 'signed-out', cookies: [] };
    const stored = this.sessionCookie.contentOf(cookieHeader);
    if (stored === undefined) return this.signedOut();
    // Discard the old inferred bit before a read, refresh, or organization switch can use or keep it.
    const envelope = { ...stored, mfa: false };
    const check = await this.checkSeal(envelope.seal);
    if (check === 'ended') return this.signedOut();
    if (check === 'refresh') return this.refreshed(envelope);
    return this.signedIn(envelope, check, []);
  }

  startSignIn(request: { readonly returnTo?: string }): Promise<SignInStart> {
    return this.signIn.start(request.returnTo);
  }

  async completeSignIn(callback: SignInCallback): Promise<BrowserSignInCompletion> {
    const completion = await this.signIn.complete(callback);
    if (completion.status === 'refused') return completion;
    const { facts, ...answer } = completion;
    return { ...answer, user: this.userOf(facts) };
  }

  // For the logout route after its CSRF check. The logout URL ends the session at WorkOS.
  async endSession(cookieHeader: string | null): Promise<SessionEnd> {
    const cookies = [this.sessionCookie.clearCookie()];
    const envelope = this.sessionCookie.contentOf(cookieHeader);
    const sessionId = envelope === undefined ? undefined : await this.sessionIdOf(envelope.seal);
    if (sessionId === undefined) return { cookies };
    return { logoutUrl: this.userManagement.getLogoutUrl({ sessionId }), cookies };
  }

  // Without a check or a refresh of the WorkOS session, so that the logout route causes no WorkOS call before its checks.
  csrfTokenOf(cookieHeader: string | null): string | undefined {
    return this.sessionCookie.contentOf(cookieHeader)?.csrf;
  }

  // The SDK cannot tell an expired access token from one that is not valid, and a token can come from a key that the
  // cached key set does not have yet. Only this server makes a seal, so a refresh decides these cases. A damaged seal
  // ends the session. Each other failure, such as a key-set outage, throws, so that the cookie stays.
  private async checkSeal(seal: string): Promise<SessionFacts | 'refresh' | 'ended'> {
    try {
      const check = await this.sealedSession(seal).authenticate();
      if (check.authenticated) return check;
      return check.reason === 'invalid_jwt' ? 'refresh' : 'ended';
    } catch (error) {
      if (isNewSigningKey(error)) return 'refresh';
      if (isDamagedSeal(error)) return 'ended';
      throw error;
    }
  }

  // The refresh stays in the organization of the session.
  private async refreshed(envelope: SessionEnvelope): Promise<ProfiledBrowserSessionState> {
    const refresh = await this.sealedSession(envelope.seal).refresh();
    if (!refresh.authenticated) return this.signedOutAfter(refresh);
    const renewed = renewedEnvelope(envelope, refresh);
    return this.signedIn(renewed, refresh, [this.sessionCookie.setCookie(renewed)]);
  }

  // The switch keeps the new seal also when WorkOS gives another organization, because the refresh token can rotate.
  private async switchOrganization(envelope: SessionEnvelope, organizationId: string): Promise<OrganizationSwitch> {
    const refresh = await this.refreshInto(envelope.seal, organizationId);
    if (refresh === 'refused') return { status: 'refused', cookies: [] };
    if (!refresh.authenticated) return this.signedOutAfter(refresh);
    const cookies = [this.sessionCookie.setCookie(renewedEnvelope(envelope, refresh))];
    return { status: refresh.organizationId === organizationId ? 'switched' : 'refused', cookies };
  }

  // WorkOS refuses an organization without a membership of the user. The session stays usable.
  private async refreshInto(seal: string, organizationId: string): Promise<SealRefresh | 'refused'> {
    try {
      return await this.sealedSession(seal).refresh({ organizationId });
    } catch (error) {
      if (isOAuthRefusal(error)) return 'refused';
      throw error;
    }
  }

  private signedIn(envelope: SessionEnvelope, facts: SessionFacts, cookies: CookieEffects): ProfiledSignedInBrowserSession {
    return {
      status: 'signed-in',
      user: this.userOf(facts),
      profile: profileOf(facts.user),
      csrfToken: envelope.csrf,
      mfaCompleted: envelope.mfa,
      cookies,
      selectOrganization: (organizationId) => this.switchOrganization(envelope, organizationId),
    };
  }

  private userOf({ user, organizationId }: SessionFacts): AuthenticatedUser {
    const selected = typeof organizationId === 'string' && organizationId !== '' ? { selectedOrganizationId: organizationId } : {};
    return Object.freeze({ authority: this.authority, subject: user.id, ...selected });
  }

  // Only a terminal refusal ends the session. A retryable failure is an outage: it throws, so that the cookie stays.
  private signedOutAfter(failure: RefreshFailure): SignedOut {
    if (failure.retryable) throw new Error(`The WorkOS session refresh failed for a time: ${failure.reason}`, { cause: failure.error });
    return this.signedOut();
  }

  private signedOut(): SignedOut {
    return { status: 'signed-out', cookies: [this.sessionCookie.clearCookie()] };
  }

  // Only this server makes a seal, so its access token needs no new check, and an expired token still names its
  // session. The SDK gives an empty record for a seal that does not open.
  private async sessionIdOf(seal: string): Promise<string | undefined> {
    try {
      const stored = await this.userManagement.getSessionFromCookie({ sessionData: seal, cookiePassword: this.cookiePassword });
      const sessionId = stored?.accessToken === undefined ? undefined : decodeJwt(stored.accessToken).sid;
      return typeof sessionId === 'string' && sessionId !== '' ? sessionId : undefined;
    } catch (error) {
      if (isDamagedSeal(error) || error instanceof errors.JWTInvalid) return undefined;
      throw error;
    }
  }

  private sealedSession(seal: string): WorkOSSealedSession {
    return this.userManagement.loadSealedSession({ sessionData: seal, cookiePassword: this.cookiePassword });
  }
}

function renewedEnvelope(envelope: SessionEnvelope, refresh: RefreshSuccess): SessionEnvelope {
  return { ...envelope, seal: sealedSessionOf(refresh) };
}

function profileOf(user: SessionFacts['user']): BrowserProfile {
  return Object.freeze({
    email: user.email,
    ...(user.firstName ? { firstName: user.firstName } : {}),
    ...(user.lastName ? { lastName: user.lastName } : {}),
  });
}
