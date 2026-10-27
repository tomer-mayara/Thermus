import { type KeyObject } from 'node:crypto';
import type { RoleGrant } from './access-context.ts';
export declare const ACCESS_CONTEXT_HEADER = "Thermus-Access";
export declare const ACCESS_CONTEXT_TYPE = "thermus-access+jwt";
export declare const ACCESS_CONTEXT_ALGORITHM = "EdDSA";
export declare const ACCESS_CONTEXT_LIFETIME_SECONDS = 120;
export interface AccessContextClaims {
    readonly authority: string;
    readonly subject: string;
    readonly name?: string;
    readonly organizationId: string;
    readonly grants: readonly RoleGrant[];
}
export interface VerifiedAccessContext extends AccessContextClaims {
    readonly expiresAtUnixSeconds: number;
}
export type AccessContextRefusal = 'missing' | 'malformed' | 'signature' | 'organization' | 'expired' | 'token';
export type AccessContextVerification = {
    readonly status: 'verified';
    readonly context: VerifiedAccessContext;
} | {
    readonly status: 'refused';
    readonly reason: AccessContextRefusal;
};
export declare function accessTokenHash(bearerToken: string): string;
export declare function requireEd25519Key(key: KeyObject, type: 'private' | 'public'): KeyObject;
