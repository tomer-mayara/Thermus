import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formLabelled, formsIn } from '../../support/drivers/browser/hosted-browser.ts';
import { signInThroughServer } from '../../support/dsl/workos-sign-in.ts';
import type { FakeMembership } from '../../support/doubles/workos/workos-fake.ts';
import { serveWorkOSSite } from '../../support/in-process/workos-site.ts';

const organizationId = 'org_01ACME';
const admin = { id: 'user_01ADMIN', email: 'admin@example.com', firstName: 'Admin' };
const user = { id: 'user_01USER', email: 'user@example.com', firstName: 'User' };

test('Given an active Admin-only membership and password sign-in, when the Admin uses the product, MCP, members, billing, and invitations, then access is allowed and either customer role can be invited without MFA', async (t) => {
  const site = await serveWorkOSSite(t, {
    organizations: [organizationId],
    setUp: (world) => {
      world.users = [admin];
      world.memberships = [{ userId: admin.id, organizationId, roles: ['admin'] }];
    },
  });
  const { browser, callback } = await signInThroughServer(site, admin, organizationId);
  assert.equal(callback.status, 303, callback.body);
  assert.equal((await browser.open('portal/access')).status, 200);
  assert.equal((await site.discover(await site.world.connectToken(admin, { org_id: organizationId }))).status, 200);
  assert.equal((await browser.open('members')).status, 200);
  assert.equal((await browser.open('billing')).status, 200);

  const invitations = await browser.open('members');
  assert.equal(invitations.status, 200, invitations.body);
  for (const role of ['User', 'Admin']) {
    const form = formLabelled(formsIn(invitations.body), 'Invite');
    const answer = await browser.submit({ ...form, fields: { ...form.fields, role: role.toLowerCase(), email: `new-${role.toLowerCase()}@example.com` } });
    assert.equal(answer.status, 303, answer.body);
  }
  assert.deepEqual(site.world.invitations.map(({ email, roleSlug }) => [email, roleSlug]), [
    ['new-user@example.com', 'user'], ['new-admin@example.com', 'admin'],
  ]);
});

test('Given an active User-only membership and password sign-in, when the User uses product and MCP or attempts administration, then product access works and member, billing, and invitation operations are denied', async (t) => {
  const site = await serveWorkOSSite(t, {
    organizations: [organizationId],
    setUp: (world) => {
      world.users = [user];
      world.memberships = [{ userId: user.id, organizationId, roles: ['user'] }];
    },
  });
  const { browser, callback } = await signInThroughServer(site, user, organizationId);
  assert.equal(callback.status, 303, callback.body);
  assert.equal((await browser.open('portal/access')).status, 200);
  assert.equal((await site.discover(await site.world.connectToken(user, { org_id: organizationId }))).status, 200);
  const session = await browser.open('session', { Accept: 'application/json' });
  const { csrfToken } = JSON.parse(session.body) as { csrfToken: string };
  for (const path of ['members', 'invitations', 'billing']) assert.equal((await browser.open(path)).status, 403, path);
  for (const role of ['user', 'admin']) {
    const answer = await browser.post('invitations/send', {
      organization_id: organizationId, email: `new-${role}@example.com`, role, csrf_token: csrfToken,
    });
    assert.equal(answer.status, 403, answer.body);
  }
  assert.deepEqual(site.world.invitations, []);
});

for (const { label, replacement, status } of [
  { label: 'the default role', replacement: { userId: admin.id, organizationId, roles: ['member'] }, status: 403 },
  { label: 'the retired Super Admin role', replacement: { userId: admin.id, organizationId, roles: ['super-admin'] }, status: 403 },
  { label: 'an unknown role absent from the catalog', replacement: { userId: admin.id, organizationId, roles: ['unknown'] }, status: 500 },
  { label: 'an inactive membership', replacement: { userId: admin.id, organizationId, roles: ['admin'], status: 'inactive' }, status: 403 },
  { label: 'no membership after removal', replacement: undefined, status: 403 },
  { label: 'only another person’s membership', replacement: { userId: user.id, organizationId, roles: ['admin'] }, status: 403 },
] satisfies ReadonlyArray<{ label: string; replacement: FakeMembership | undefined; status: number }>) {
  test(`Given an Admin session in Acme and valid User access in Globex, when the current Acme record becomes ${label}, then existing sessions and tokens lose Acme access while Globex still works`, async (t) => {
    const globex = 'org_01GLOBEX';
    const globexMembership: FakeMembership = { userId: admin.id, organizationId: globex, roles: ['user'] };
    const site = await serveWorkOSSite(t, {
      organizations: [organizationId, globex],
      setUp: (world) => {
        world.users = [admin, user];
        world.memberships = [{ userId: admin.id, organizationId, roles: ['admin'] }, globexMembership];
      },
    });
    const acmeSignIn = await signInThroughServer(site, admin, organizationId);
    const globexSignIn = await signInThroughServer(site, admin, globex);
    assert.equal(acmeSignIn.callback.status, 303);
    assert.equal(globexSignIn.callback.status, 303);
    const acmeToken = await site.world.connectToken(admin, { org_id: organizationId });
    const globexToken = await site.world.connectToken(admin, { org_id: globex });
    assert.equal((await acmeSignIn.browser.open('members')).status, 200);

    site.world.memberships = replacement === undefined ? [globexMembership] : [replacement, globexMembership];

    for (const path of ['portal/access', 'members', 'invitations']) assert.equal((await acmeSignIn.browser.open(path)).status, status, path);
    assert.equal((await site.discover(acmeToken)).status, status);
    assert.equal((await globexSignIn.browser.open('portal/access')).status, 200);
    assert.equal((await site.discover(globexToken)).status, 200);
  });
}
