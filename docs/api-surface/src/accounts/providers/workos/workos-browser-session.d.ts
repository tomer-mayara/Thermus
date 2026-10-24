import type { BrowserSessionControls, BrowserSignInCompletion, ProfiledBrowserSessionState, SessionEnd } from '../../identity/browser-session-controls.ts';
import type { WorkOSSessionClient } from './workos-session-client.ts';
import { type SignInCallback, type SignInStart, type SignInOnboarding } from './workos-sign-in.ts';
import type { WorkOSSettings } from './workos-settings.ts';
export interface WorkOSBrowserSessionOptions {
    readonly onboarding?: SignInOnboarding;
    readonly workos: WorkOSSessionClient;
    readonly settings: Pick<WorkOSSettings, 'clientId' | 'redirectUri' | 'cookiePassword'>;
    readonly authority: string;
    readonly clock?: () => number;
}
export declare class WorkOSBrowserSession implements BrowserSessionControls {
    private readonly userManagement;
    private readonly cookiePassword;
    private readonly authority;
    private readonly sessionCookie;
    private readonly signIn;
    constructor(options: WorkOSBrowserSessionOptions);
    authenticate(cookieHeader: string | null): Promise<ProfiledBrowserSessionState>;
    startSignIn(request: {
        readonly returnTo?: string;
    }): Promise<SignInStart>;
    completeSignIn(callback: SignInCallback): Promise<BrowserSignInCompletion>;
    endSession(cookieHeader: string | null): Promise<SessionEnd>;
    csrfTokenOf(cookieHeader: string | null): string | undefined;
    private checkSeal;
    private refreshed;
    private switchOrganization;
    private refreshInto;
    private signedIn;
    private userOf;
    private signedOutAfter;
    private signedOut;
    private sessionIdOf;
    private sealedSession;
}
