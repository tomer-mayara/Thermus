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

export interface SignupActivation {
  inspect(request: { readonly user: AuthenticatedUser; readonly signal: AbortSignal }): Promise<SignupState>;
  activate(request: { readonly user: AuthenticatedUser; readonly organizationName: string; readonly documents: SignupDocuments; readonly signal: AbortSignal }): Promise<SignupResult>;
}

export function organizationNameIn(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.isWellFormed() || /\p{Cc}/u.test(value)) return undefined;
  const name = value.trim();
  return name.length > 0 && name.length <= 100 ? name : undefined;
}
