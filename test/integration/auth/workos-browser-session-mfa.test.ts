import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorkOSBrowserSession } from '../../../src/accounts/providers/workos/workos-browser-session.ts';
import { sessionCookie } from '../../../src/accounts/providers/workos/session-cookies.ts';
import { WorkOSFake } from '../../support/doubles/workos/workos-fake.ts';

const organizationId = 'org_MFA';
const otherOrganizationId = 'org_OTHER';
const user = { id: 'user_MFA', email: 'mfa@thermus.ai', firstName: 'Mfa' };

for (const expired of [false, true]) {
  test(`Given a real SDK session cookie with MFA evidence and expired=${expired}, when unproven mode reads it and switches organization, then the session and each replacement cookie have no MFA evidence`, async (t) => {
    const world = await WorkOSFake.start(t, 'https://thermus.example/', [organizationId, otherOrganizationId]);
    world.users = [user];
    world.memberships = [organizationId, otherOrganizationId].map((organizationId) => ({ userId: user.id, organizationId, roles: ['user'] }));
    if (expired) world.expireAccessTokens();
    const { workos, settings } = world.connection();
    const options = { workos, settings, authority: 'workos:client_test' };
    const required = new WorkOSBrowserSession({ ...options, mfaEvidence: 'password-mfa-required' });
    const unproven = new WorkOSBrowserSession({ ...options, mfaEvidence: 'unproven' });
    const start = await required.startSignIn({ returnTo: '/' });
    const completion = await required.completeSignIn({ query: new URLSearchParams({ code: world.codeFor(user, organizationId), state: new URL(start.url).searchParams.get('state') ?? '' }), cookieHeader: headerOf(start.cookies) });
    const cookie = headerOf(completion.cookies);
    assert.equal(sessionCookie(settings.cookiePassword).contentOf(cookie)?.mfa, true);
    const read = await unproven.authenticate(cookie);
    assert.equal(read.status, 'signed-in');
    if (read.status !== 'signed-in') assert.fail('The session must stay signed in');
    assert.equal(read.mfaCompleted, false);
    for (const cookie of read.cookies) assert.equal(sessionCookie(settings.cookiePassword).contentOf(headerOf([cookie]))?.mfa, false);
    const switchResult = await read.selectOrganization(otherOrganizationId);
    assert.equal(switchResult.status, 'switched');
    assert.equal(sessionCookie(settings.cookiePassword).contentOf(headerOf(switchResult.cookies))?.mfa, false);
    const switched = await unproven.authenticate(headerOf(switchResult.cookies));
    assert.equal(switched.status, 'signed-in');
    if (switched.status !== 'signed-in') assert.fail('The switched session must stay signed in');
    assert.equal(switched.user.selectedOrganizationId, otherOrganizationId);
    assert.equal(switched.mfaCompleted, false);
  });
}

function headerOf(cookies: readonly string[]): string {
  return cookies.map((cookie) => cookie.split(';')[0]).join('; ');
}
