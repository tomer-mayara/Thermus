import type { InvitationOverview, MemberOverview } from '../../../../src/accounts/organizations/administration-overviews.ts';
import type { SignedInSetup } from '../../../support/doubles/auth/browser-session-double.ts';
import { adminGrant, allowedFor, ann, contextOf, postForm, serve, signedIn, userGrant, type Setup } from './account-routes-fixtures.ts';
import type { AdministrationSetup } from './organization-administration-double.ts';

export const sessionCookies = ['session=refreshed; Path=/; Secure; HttpOnly; SameSite=Lax'];
export const annToken = 'csrf-token-of-user-ann';
export const annContext = contextOf(ann, [userGrant, adminGrant], adminGrant.permissions);
export const acmeMembers: MemberOverview = {
  organizationId: 'org-a',
  organizationName: 'Acme',
  activeUserSeats: 1,
  members: [
    { membershipId: 'membership-ann', subject: 'user-ann', email: 'ann@example.com', status: 'active', roles: ['user', 'admin'], revision: 'r7', removable: true },
    { membershipId: 'membership-dora', subject: 'user-dora', email: 'dora@example.com', status: 'active', roles: [], revision: 'r2', removable: false },
    { membershipId: 'membership-ivy', subject: 'user-ivy', email: 'ivy@example.com', status: 'inactive', roles: ['user'], revision: 'r3', removable: false },
  ],
};

export const acmeInvitations: InvitationOverview = {
  organizationId: 'org-a',
  invitableRoles: ['user', 'admin'],
  identityPolicy: 'invited-address',
  invitations: [
    { invitationId: 'invitation-1', expiresAt: '2099-01-01T00:00:00.000Z', email: 'new@example.com', role: 'user', state: 'pending', changes: ['resend', 'revoke'] },
    { invitationId: 'invitation-2', expiresAt: '2099-01-02T00:00:00.000Z', email: 'boss@example.com', role: 'admin', state: 'pending', changes: ['resend', 'revoke'] },
    { invitationId: 'invitation-3', expiresAt: '2020-01-01T00:00:00.000Z', email: 'old@example.com', role: 'user', state: 'expired', changes: [] },
  ],
};

export const validChanges = {
  send: { path: '/invitations/send', fields: { csrf_token: annToken, organization_id: 'org-a', role: 'user', email: 'new.user@example.com' } },
  resend: { path: '/invitations/resend', fields: { csrf_token: annToken, organization_id: 'org-a', invitation_id: 'invitation-1' } },
  revoke: { path: '/invitations/revoke', fields: { csrf_token: annToken, organization_id: 'org-a', invitation_id: 'invitation-1' } },
} as const;

export interface AdministrationServe {
  readonly session?: SignedInSetup;
  readonly routes?: Setup;
}

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
