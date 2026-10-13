import type { InvitationOverview, MemberOverview } from '../../../../src/organizations/organization-administration.ts';
import { adminGrant, allowedFor, ann, contextOf, postForm, serve, signedIn, userGrant, type Setup } from './account-routes-fixtures.ts';
import type { SignedInSetup } from './browser-session-double.ts';
import type { AdministrationSetup } from './organization-administration-double.ts';

export const sessionCookies = ['session=refreshed; Path=/; Secure; HttpOnly; SameSite=Lax'];
export const annToken = 'csrf-token-of-user-ann';
export const annContext = contextOf(ann, [userGrant, adminGrant], ['product:access', 'user-grants:manage']);
export const formPageHeaders = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'content-security-policy': "default-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
};

export const acmeMembers: MemberOverview = {
  organizationId: 'org-a',
  activeUserSeats: 2,
  members: [
    { membershipId: 'membership-ann', email: 'ann@example.com', status: 'active', roles: ['user', 'admin'], revision: 'r7', changes: [{ role: 'user', action: 'revoke' }] },
    { membershipId: 'membership-dora', email: 'dora@example.com', status: 'active', roles: [], revision: 'r2', changes: [{ role: 'user', action: 'grant' }] },
    { membershipId: 'membership-ivy', email: 'ivy@example.com', status: 'inactive', roles: ['user'], revision: 'r3', changes: [] },
  ],
};

export const acmeInvitations: InvitationOverview = {
  organizationId: 'org-a',
  invitableRoles: ['user'],
  identityPolicy: 'invited-address',
  invitations: [
    { invitationId: 'invitation-1', email: 'new@example.com', role: 'user', state: 'pending', changes: ['resend', 'revoke'] },
    { invitationId: 'invitation-2', email: 'boss@example.com', role: 'admin', state: 'pending', changes: [] },
    { invitationId: 'invitation-3', email: 'old@example.com', role: 'user', state: 'expired', changes: [] },
  ],
};

export const validChanges = {
  grant: { path: '/members/grants', fields: { csrf_token: annToken, organization_id: 'org-a', membership_id: 'membership-dora', revision: 'r2', role: 'user', action: 'grant' } },
  send: { path: '/invitations/send', fields: { csrf_token: annToken, organization_id: 'org-a', role: 'user', email: 'new.user@example.com' } },
  resend: { path: '/invitations/resend', fields: { csrf_token: annToken, organization_id: 'org-a', invitation_id: 'invitation-1' } },
  revoke: { path: '/invitations/revoke', fields: { csrf_token: annToken, organization_id: 'org-a', invitation_id: 'invitation-1' } },
} as const;

export interface AdministrationServe {
  readonly session?: SignedInSetup;
  readonly routes?: Setup;
}

// Ann has a signed-in session with a refreshed session cookie and allowed access to Acme (org-a).
export function serveAdministration(administration: AdministrationSetup = {}, setup: AdministrationServe = {}) {
  const annSession = signedIn(ann, { cookies: sessionCookies, ...setup.session });
  const served = serve({
    sessions: new Map([['session=ann', annSession]]),
    decisions: new Map([[ann.subject, allowedFor(annContext)]]),
    administration,
    ...setup.routes,
  });
  return { ...served, annSession };
}

// A string body goes unchanged, so that a test can send a duplicate field.
export function changePost(path: string, fields: Readonly<Record<string, string>> | string, headers: Readonly<Record<string, string>> = {}): Request {
  const body = typeof fields === 'string' ? fields : new URLSearchParams(fields).toString();
  return postForm(path, { cookie: 'session=ann', body, headers });
}
