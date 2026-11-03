import type { AuthenticatedUser } from '../identity/access-context.ts';

export interface SignupDocuments {
  readonly purpose?: 'organization-creation';
  readonly version: string;
  readonly terms: { readonly version: string; readonly sha256: string; readonly text: string };
  readonly notice: { readonly version: string; readonly sha256: string; readonly text: string };
  readonly agreement: { readonly version: string; readonly text: string };
}

// existing-access: current product access in an organization. existing-account: a membership record of any status
// (active, pending, or inactive) without current product access. eligible: no membership record and no retained
// signup organization. Only an eligible user can create an organization.
export type SignupResult =
  // Active means that a current read confirmed usable membership in this organization.
  | { readonly status: 'active'; readonly organizationId: string }
  | { readonly status: 'existing-access' | 'existing-account' | 'unverified' | 'support-required' | 'unavailable' | 'sign-in-required' };

export type SignupState =
  | { readonly status: 'eligible' | 'existing-access' | 'existing-account' | 'unavailable' | 'sign-in-required' }
  | { readonly status: 'support-required'; readonly canContinue: boolean };

// found: the identity provider has a user with this email. absent: it has none. unavailable: it could not say. The
// answer grants nothing: step 1 of signup uses it only to offer Sign in instead of the account creation.
export type AccountLookup = { readonly status: 'found' | 'absent' | 'unavailable' };

export interface SignupActivation {
  inspect(request: { readonly user: AuthenticatedUser; readonly signal: AbortSignal }): Promise<SignupState>;
  activate(request: { readonly user: AuthenticatedUser; readonly organizationName: string; readonly documents: SignupDocuments; readonly signal: AbortSignal }): Promise<SignupResult>;
  findAccount(request: { readonly email: string; readonly signal: AbortSignal }): Promise<AccountLookup>;
}

export function organizationNameIn(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.isWellFormed() || /\p{Cc}/u.test(value)) return undefined;
  const name = value.trim();
  return name.length > 0 && name.length <= 100 ? name : undefined;
}
