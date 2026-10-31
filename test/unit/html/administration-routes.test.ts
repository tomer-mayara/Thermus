import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RequestContext } from '../../../src/accounts/identity/access-context.ts';
import type { SignedInBrowserSession } from '../../../src/accounts/identity/browser-session.ts';
import type { ChangeResult } from '../../../src/accounts/organizations/change-records.ts';
import type { RemovalResult } from '../../../src/accounts/organizations/organization-administration.ts';
import { AdministrationRoutes, type AdministrationService } from '../../../src/interfaces/web/account/administration-routes.ts';
import type { AdministrationChange } from '../../../src/logs/audit/audit-log.ts';

const origin = 'https://thermus.example';
const context: RequestContext = { user: { authority: 'test', subject: 'admin' }, tenantId: 'tenant-a', organizationId: 'org-a', grants: [], permissions: ['product:access'] };
const session: SignedInBrowserSession = { status: 'signed-in', user: context.user, csrfToken: 'csrf', mfaCompleted: false, cookies: [], selectOrganization: async () => ({ status: 'refused', cookies: [] }) };
const forms = {
  send: { path: '/invitations/send', fields: { csrf_token: 'csrf', organization_id: 'org-a', role: 'admin', email: 'new@example.com' } },
  resend: { path: '/invitations/resend', fields: { csrf_token: 'csrf', organization_id: 'org-a', invitation_id: 'invitation-1' } },
  remove: { path: '/members/remove', fields: { csrf_token: 'csrf', organization_id: 'org-a', membership_id: 'membership-1', revision: 'r1' } },
};

function fixture(answers: { change?: () => Promise<ChangeResult>; removal?: () => Promise<RemovalResult> } = {}) {
  const records: AdministrationChange[] = [];
  const calls: string[] = [];
  const change = async (name: string) => { calls.push(name); return answers.change?.() ?? 'applied'; };
  const organizations: AdministrationService = {
    memberOverview: async () => 'denied',
    invitationOverview: async () => 'denied',
    billingState: async () => 'denied',
    sendInvitation: () => change('sendInvitation'),
    resendInvitation: () => change('resendInvitation'),
    revokeInvitation: () => change('revokeInvitation'),
    removeMember: async () => { calls.push('removeMember'); return answers.removal?.() ?? 'applied'; },
  };
  const routes = new AdministrationRoutes({ publicBaseUrl: `${origin}/`, organizations, organizationsPage: '/organizations', audit: { administrationChanged: (record) => { records.push(record); } } });
  const post = async (form: { path: string; fields: Record<string, string> }, overrides: { fields?: Record<string, string>; method?: string; origin?: string } = {}) => {
    const handler = routes.handlerFor(form.path);
    assert.ok(handler, `A handler serves ${form.path}`);
    const method = overrides.method ?? 'POST';
    const body = method === 'POST' ? new URLSearchParams({ ...form.fields, ...overrides.fields }) : undefined;
    return handler(new Request(`${origin}${form.path}`, { method, headers: { Origin: overrides.origin ?? origin }, body }), session, context);
  };
  return { records, calls, post };
}

test('Given an applied invitation, when it is sent, then the browser goes to Members and one record keeps the target and the role', async () => {
  const { records, post } = fixture();
  const response = await post(forms.send);
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('Location'), `${origin}/members`);
  assert.deepEqual(records.map(({ organizationId, actor, action, outcome, target, role }) => ({ organizationId, actor, action, outcome, target, role })), [
    { organizationId: 'tenant-a', actor: context.user, action: 'invite', outcome: 'applied', target: { email: 'new@example.com' }, role: 'admin' },
  ]);
});

test('Given a refused invitation change, when it is resent, then the notice of the refusal answers and the record has no role', async () => {
  const { records, post } = fixture({ change: async () => 'limit-reached' });
  const response = await post(forms.resend);
  assert.equal(response.status, 409);
  assert.match(await response.text(), /5 of 5 seats/);
  assert.deepEqual(records.map(({ action, outcome, target, role }) => ({ action, outcome, target, role })), [
    { action: 'resend-invitation', outcome: 'limit-reached', target: { invitationId: 'invitation-1' }, role: undefined },
  ]);
});

test('Given a form for another organization, when it is posted, then the change is stale, no service write runs, and the stale outcome is recorded', async () => {
  const { records, calls, post } = fixture();
  for (const form of [forms.send, forms.remove]) {
    assert.equal((await post(form, { fields: { organization_id: 'org-b' } })).status, 409);
  }
  assert.deepEqual(calls, []);
  assert.deepEqual(records.map(({ action, outcome }) => [action, outcome]), [['invite', 'stale'], ['remove-member', 'stale']]);
});

test('Given a failed service write, when an invitation is sent, then the failure is recorded and the error reaches the caller', async () => {
  const { records, post } = fixture({ change: async () => { throw new Error('directory outage'); } });
  await assert.rejects(post(forms.send), { message: 'directory outage' });
  assert.deepEqual(records.map(({ outcome }) => outcome), ['failed']);
});

test('Given a member removal, when it is applied or its write fails, then each removal page answers and each outcome is recorded with the membership', async () => {
  const applied = fixture();
  assert.equal((await applied.post(forms.remove)).status, 200);
  const failed = fixture({ removal: async () => { throw new Error('removal outage'); } });
  assert.equal((await failed.post(forms.remove)).status, 503);
  assert.deepEqual([...applied.records, ...failed.records].map(({ action, outcome, target }) => ({ action, outcome, target })), [
    { action: 'remove-member', outcome: 'applied', target: { membershipId: 'membership-1' } },
    { action: 'remove-member', outcome: 'unknown', target: { membershipId: 'membership-1' } },
  ]);
});

test('Given a change request that is not a valid same-origin form post, when it arrives, then a notice refuses it before any write or record', async () => {
  const { records, calls, post } = fixture();
  for (const form of [forms.send, forms.remove]) {
    assert.equal((await post(form, { method: 'GET' })).headers.get('Allow'), 'POST');
    assert.equal((await post(form, { origin: 'https://other.example' })).status, 403);
    assert.equal((await post(form, { fields: { csrf_token: 'forged' } })).status, 403);
    assert.equal((await post(form, { fields: { extra: 'field' } })).status, 400);
  }
  assert.deepEqual(calls, []);
  assert.deepEqual(records, []);
});
