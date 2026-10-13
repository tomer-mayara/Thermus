import { ann, organization, postForm, serve, signedIn, type Setup } from './account-routes-fixtures.ts';
import type { SignedInSetup } from './browser-session-double.ts';

export const sessionCookies = ['session=refreshed; Path=/; Secure; HttpOnly; SameSite=Lax'];
export const switchCookies = ['session=switched; Path=/; Secure; HttpOnly; SameSite=Lax'];
export const annToken = 'csrf-token-of-user-ann';
export const annOrganizations = [organization('org-a', 'Acme', true), organization('org-b', 'Globex')];
export const validSelection = { csrf_token: annToken, organization_id: 'org-b', return_to: '/administration/users' };

export function serveAnn(session: SignedInSetup = {}, setup: Setup = {}) {
  const annSession = signedIn(ann, { cookies: sessionCookies, ...session });
  const served = serve({ sessions: new Map([['session=ann', annSession]]), organizations: new Map([[ann.subject, annOrganizations]]), ...setup });
  return { ...served, annSession };
}

// A string body goes unchanged, so that a test can send a duplicate field.
export function selection(fields: Readonly<Record<string, string>> | string, headers: Readonly<Record<string, string>> = {}): Request {
  const body = typeof fields === 'string' ? fields : new URLSearchParams(fields).toString();
  return postForm('/organizations/select', { cookie: 'session=ann', body, headers });
}
