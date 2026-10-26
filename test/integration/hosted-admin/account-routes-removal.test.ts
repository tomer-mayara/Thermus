import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formsIn } from '../../support/drivers/browser/hosted-browser.ts';
import { accountRequest, ann, publicOrigin } from './fixtures/account-routes-fixtures.ts';
import { acmeInvitations, acmeMembers, annToken, changePost, serveAdministration, sessionCookies } from './fixtures/administration-routes-fixtures.ts';

const path = '/members/remove';
const fields = { csrf_token: annToken, organization_id: 'org-a', membership_id: 'membership-ann', revision: 'r7' };

test('Given an ordinary active member, when Members opens, then native confirmation carries only the selected membership and Cancel is a read', async () => {
  const members = { ...acmeMembers, members: acmeMembers.members.map(member => ({ ...member, removable: member.membershipId === 'membership-ann' })) };
  const { routes, organizations } = serveAdministration({ members, invitations: acmeInvitations });
  const body = await (await routes.handle(accountRequest('/members', 'session=ann'))).text();
  const removals = formsIn(body).filter(form => form.action === path);
  assert.equal(removals.length, 1);
  assert.deepEqual(removals[0]?.fields, fields);
  assert.match(body, /<details[^>]*>[\s\S]*<summary[^>]*>Remove/);
  assert.match(body, /href="\/members">Cancel<\/a>/);
  assert.doesNotMatch(body, /role="dialog"|<script/);
  assert.deepEqual(organizations.administrationCalls.map(call => call.operation), ['memberOverview', 'invitationOverview']);
});

test('Given the last-Admin refusal, when recovery is shown, then the existing invitation link explains the ordinary Members task and waits for acceptance', async () => {
  const { routes } = serveAdministration({ removal: 'last-admin' });
  const body = await (await routes.handle(changePost(path, fields))).text();
  assert.match(body, /href="\/invitations">Invite another Admin<\/a>/);
  assert.match(body, /On Members, open Invite member, select Admin, and wait for acceptance\./);
  assert.deepEqual(formsIn(body), []);
});

test('Given password-only Admin access, when a valid removal is confirmed, then only the coordinator runs and completion requires no Members read', async () => {
  const { routes, organizations, failures } = serveAdministration({ removal: 'applied', members: new Error('later read fails') }, { session: { mfaCompleted: false } });
  const response = await routes.handle(changePost(path, fields, { 'X-Organization-Id': 'org-b' }));
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.deepEqual(response.headers.getSetCookie(), sessionCookies);
  assert.match(body, /Member removed/);
  assert.match(body, /href="\/members">/);
  assert.match(body, /href="\/organizations">/);
  assert.deepEqual(formsIn(body), []);
  assert.deepEqual(organizations.administrationCalls, [{ operation: 'removeMember', actor: { user: ann }, request: { organizationId: 'org-a', membershipId: 'membership-ann', revision: 'r7' } }]);
  assert.deepEqual(failures, []);
  assert.equal((await routes.handle(accountRequest('/members', 'session=ann'))).status, 500);
  assert.equal(organizations.administrationCalls.filter(call => call.operation === 'removeMember').length, 1);
});

for (const [outcome, status, text] of [
  ['denied', 403, /Change refused/],
  ['stale', 409, /Page out of date/],
  ['unsupported', 503, /Change not available/],
  ['last-admin', 409, /another Admin must join/i],
  ['busy', 409, /removal is still pending/i],
  ['unavailable', 503, /Removal unavailable/],
  ['unknown', 503, /Removal not confirmed/],
] as const) {
  test(`Given a removal result of ${outcome}, when it is shown, then it remains distinct and provides read-only navigation`, async () => {
    const { routes, organizations } = serveAdministration({ removal: outcome });
    const response = await routes.handle(changePost(path, fields));
    const body = await response.text();
    assert.equal(response.status, status);
    assert.match(body, text);
    assert.match(body, /href="\/organizations">/);
    assert.deepEqual(formsIn(body), []);
    assert.equal(organizations.administrationCalls.length, 1);
    if (outcome === 'last-admin') assert.match(body, /href="\/invitations">/);
    if (outcome === 'busy' || outcome === 'unknown') assert.doesNotMatch(body, /Nothing changed|Try again|Retry|settled|membership-ann|r7/);
  });
}

for (const method of ['GET', 'HEAD', 'PUT', 'DELETE']) {
  test(`Given ${method} at the removal endpoint, when it is handled, then no coordinator call runs`, async () => {
    const { routes, organizations } = serveAdministration();
    const response = await routes.handle(accountRequest(path, 'session=ann', { method }));
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('Allow'), 'POST');
    assert.deepEqual(organizations.administrationCalls, []);
  });
}

for (const [label, body, headers, status] of [
  ['wrong origin', fields, { Origin: 'https://attacker.example' }, 403],
  ['missing origin', fields, { Origin: '' }, 403],
  ['wrong CSRF', { ...fields, csrf_token: 'other' }, {}, 403],
  ['changed organization', { ...fields, organization_id: 'org-b' }, {}, 409],
  ['missing revision', { csrf_token: annToken, organization_id: 'org-a', membership_id: 'membership-ann' }, {}, 400],
  ['extra field', { ...fields, user_id: 'another-person' }, {}, 400],
  ['duplicate target', `${new URLSearchParams(fields)}&membership_id=another`, {}, 400],
  ['empty target', { ...fields, membership_id: '' }, {}, 400],
  ['invalid revision', { ...fields, revision: 'revision with spaces' }, {}, 400],
  ['unsupported content type', fields, { 'Content-Type': 'application/json' }, 415],
] as const) {
  test(`Given ${label}, when a removal form is submitted, then it is refused before the coordinator`, async () => {
    const { routes, organizations } = serveAdministration();
    const response = await routes.handle(changePost(path, body, headers));
    assert.equal(response.status, status);
    assert.deepEqual(organizations.administrationCalls, []);
  });
}

test('Given a removal that throws without an outcome, when the route answers, then uncertainty has no replay form or provider details', async () => {
  const { routes, organizations } = serveAdministration({ removal: new Error('private-provider-cause') });
  const response = await routes.handle(changePost(path, fields));
  const body = await response.text();
  assert.equal(response.status, 503);
  assert.match(body, /Removal not confirmed/);
  assert.doesNotMatch(body, /private-provider-cause|Try again|Nothing changed/);
  assert.deepEqual(formsIn(body), []);
  assert.equal(organizations.administrationCalls.length, 1);
});

test('Given no current access, when the old removal form is submitted, then only identity-level navigation remains', async () => {
  const { routes, organizations } = serveAdministration({}, { routes: { decisions: new Map([[ann.subject, { allowed: false, reason: 'membership-inactive' }]]) } });
  const response = await routes.handle(changePost(path, fields));
  const body = await response.text();
  assert.equal(response.status, 403);
  assert.match(body, /href="\/organizations">/);
  assert.doesNotMatch(body, /membership-ann|Removal not confirmed|Member removed/);
  assert.deepEqual(organizations.administrationCalls, []);
});

test('Given a public base path, when removal completes, then all navigation stays inside that base path', async () => {
  const { routes } = serveAdministration({ removal: 'applied' }, { routes: { publicBaseUrl: `${publicOrigin}/team` } });
  const body = await (await routes.handle(changePost('/team/members/remove', fields))).text();
  assert.match(body, /href="\/team\/members">/);
  assert.match(body, /href="\/team\/organizations">/);
});
