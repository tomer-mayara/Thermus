import type { AuthenticatedUser } from './access-context.ts';
export type CookieEffects = readonly string[];
export type OrganizationSwitch = {
    readonly status: 'switched';
    readonly cookies: CookieEffects;
} | {
    readonly status: 'refused';
    readonly cookies: CookieEffects;
} | {
    readonly status: 'signed-out';
    readonly cookies: CookieEffects;
};
export interface SignedInBrowserSession {
    readonly status: 'signed-in';
    readonly user: AuthenticatedUser;
    readonly csrfToken: string;
    readonly mfaCompleted: boolean;
    readonly cookies: CookieEffects;
    selectOrganization(organizationId: string): Promise<OrganizationSwitch>;
}
export type BrowserSessionState = SignedInBrowserSession | {
    readonly status: 'signed-out';
    readonly cookies: CookieEffects;
};
export interface BrowserSession {
    authenticate(cookieHeader: string | null): Promise<BrowserSessionState>;
}
