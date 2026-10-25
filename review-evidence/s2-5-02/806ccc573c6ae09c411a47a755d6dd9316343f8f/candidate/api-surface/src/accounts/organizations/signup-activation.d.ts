import type { AuthenticatedUser } from '../identity/access-context.ts';
export interface SignupDocuments {
    readonly purpose?: 'organization-creation';
    readonly version: string;
    readonly terms: {
        readonly version: string;
        readonly sha256: string;
        readonly text: string;
    };
    readonly notice: {
        readonly version: string;
        readonly sha256: string;
        readonly text: string;
    };
    readonly agreement: {
        readonly version: string;
        readonly text: string;
    };
}
export type SignupResult = {
    readonly status: 'active';
    readonly organizationId: string;
} | {
    readonly status: 'existing-access' | 'unverified' | 'support-required' | 'unavailable' | 'sign-in-required';
};
export type SignupState = {
    readonly status: 'eligible' | 'existing-access' | 'unavailable' | 'sign-in-required';
} | {
    readonly status: 'support-required';
    readonly canContinue: boolean;
};
export interface SignupActivation {
    inspect(request: {
        readonly user: AuthenticatedUser;
        readonly signal: AbortSignal;
    }): Promise<SignupState>;
    activate(request: {
        readonly user: AuthenticatedUser;
        readonly organizationName: string;
        readonly documents: SignupDocuments;
        readonly signal: AbortSignal;
    }): Promise<SignupResult>;
}
export declare function organizationNameIn(value: unknown): string | undefined;
