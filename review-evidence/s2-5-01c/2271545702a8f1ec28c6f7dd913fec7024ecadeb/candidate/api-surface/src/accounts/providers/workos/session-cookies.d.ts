export interface SessionEnvelope {
    readonly seal: string;
    readonly csrf: string;
    readonly mfa: boolean;
}
export interface SignInEnvelope {
    readonly state: string;
    readonly codeVerifier: string;
    readonly returnTo?: string;
    readonly expiresAt: number;
}
interface CookieKind<Content> {
    readonly name: string;
    readonly purpose: string;
    readonly maxAgeSeconds: number;
    readonly isContent: (value: unknown) => value is Content;
}
export declare const SIGN_IN_MAX_AGE_SECONDS = 600;
export declare class SealedCookie<Content> {
    readonly name: string;
    private readonly kind;
    private readonly key;
    constructor(cookiePassword: string, kind: CookieKind<Content>);
    setCookie(content: Content): string;
    clearCookie(): string;
    isSentIn(cookieHeader: string | null): boolean;
    contentOf(cookieHeader: string | null): Content | undefined;
}
export declare function sessionCookie(cookiePassword: string): SealedCookie<SessionEnvelope>;
export declare function signInCookie(cookiePassword: string): SealedCookie<SignInEnvelope>;
export declare function sameSecret(sent: string, secret: string): boolean;
export {};
