import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formsIn, type PageForm } from '../../support/drivers/browser/hosted-browser.ts';
import { signInThroughServer } from '../../support/dsl/workos-sign-in.ts';
import { removalForm } from '../../support/dsl/hosted-member-removal.ts';
import { otherOrganization, remainingAdmin, removalAdmin, removalOrganization, removalUser, serveMemberRemovalSite } from '../../support/in-process/hosted-member-removal-site.ts';

test('Given a password-authenticated Admin, two active Admins, and an ordinary User, when the Admin confirms Remove through Members, then only that membership is removed and the current count is two', async (t) => {
  const site = await serveMemberRemovalSite(t, { setUp: world => world.setRoles(remainingAdmin, removalOrganization, ['user', 'admin']) });
  const { browser } = await signInThroughServer(site, removalAdmin, removalOrganization);
  const targetId = site.world.membershipId(removalUser, removalOrganization);
  const form = await removalForm(browser, targetId);

  const answer = await browser.submit(form);

  assert.ok(answer.status < 400, answer.body);
  assert.deepEqual([...site.world.deletedMembershipIds], [targetId]);
  assert.equal(site.removalStore.operations.get(removalOrganization)?.outcome, 'applied');
  const refreshed = await browser.open('members');
  assert.equal(refreshed.status, 200, refreshed.body);
  assert.match(refreshed.body, /Active product members: 2/);
  assert.doesNotMatch(refreshed.body, /user@example\.com/);
});

for (const invalid of ['actor authority changed', 'saved organization stale', 'organization forged', 'saved target stale', 'target forged', 'revision stale', 'revision forged', 'method invalid', 'origin invalid', 'CSRF invalid']) {
  test(`Given a valid removable target and only ${invalid}, when the removal form is submitted, then no provider deletion occurs`, async (t) => {
    const site = await serveMemberRemovalSite(t, { setUp: world => {
      world.memberships = [...world.memberships, { userId: removalAdmin.id, organizationId: otherOrganization, roles: ['admin'], directoryManaged: false }];
    } });
    const { browser } = await signInThroughServer(site, removalAdmin, removalOrganization);
    const targetId = site.world.membershipId(removalUser, removalOrganization);
    const original = await removalForm(browser, targetId);
    let form: PageForm = original;
    if (invalid === 'actor authority changed') site.world.setRoles(removalAdmin, removalOrganization, ['user']);
    if (invalid === 'saved organization stale') {
      const choice = formsIn((await browser.open('organizations')).body).find(each => each.fields.organization_id === otherOrganization);
      assert.ok(choice);
      assert.equal((await browser.submit(choice)).status, 303);
    }
    if (invalid === 'organization forged') form = { ...form, fields: { ...form.fields, organization_id: 'org_FORGED' } };
    if (invalid === 'saved target stale') site.world.deletedMembershipIds.add(targetId);
    if (invalid === 'target forged') form = { ...form, fields: { ...form.fields, membership_id: 'om_FORGED' } };
    if (invalid === 'revision stale') site.world.setRoles(removalUser, removalOrganization, ['admin']);
    if (invalid === 'revision forged') form = { ...form, fields: { ...form.fields, revision: 'forged' } };
    if (invalid === 'CSRF invalid') form = { ...form, fields: { ...form.fields, csrf_token: 'forged' } };
    site.world.fake.takeRequests();

    const answer = invalid === 'method invalid' ? await browser.open(form.action) : await browser.submit(form, invalid === 'origin invalid' ? { origin: 'https://forged.example' } : {});

    assert.ok(answer.status >= 400, answer.body);
    assert.deepEqual(site.world.fake.takeRequests().filter(request => request.method === 'DELETE'), []);
    assert.equal(site.removalStore.operations.get(removalOrganization)?.outcome === 'applied', false);
  });
}

test('Given a password-only last Admin and a valid self-removal form, when Remove is confirmed, then the page asks for another Admin and links to invitations without deleting the membership', async (t) => {
  const site = await serveMemberRemovalSite(t, { setUp: world => world.setRoles(remainingAdmin, removalOrganization, ['user']) });
  const { browser } = await signInThroughServer(site, removalAdmin, removalOrganization);
  const form = await removalForm(browser, site.world.membershipId(removalAdmin, removalOrganization));

  const answer = await browser.submit(form);

  assert.equal(answer.status, 409, answer.body);
  assert.match(answer.body, /another Admin/i);
  assert.match(answer.body, /href="[^\"]*invitations[^\"]*"/);
  assert.equal(site.world.deletedMembershipIds.size, 0);
  assert.doesNotMatch(answer.body, /MFA|authenticator|verification code/i);
});

test('Given an uncertain removal that deleted its target, when the Admin repeats the same POST and refreshes Members, then the POST is busy, current facts are shown, and no deletion is replayed', async (t) => {
  const site = await serveMemberRemovalSite(t);
  const { browser } = await signInThroughServer(site, removalAdmin, removalOrganization);
  const targetId = site.world.membershipId(removalUser, removalOrganization);
  const form = await removalForm(browser, targetId);
  site.world.fake.answer(`DELETE /user_management/organization_memberships/${targetId}`, () => { site.world.deletedMembershipIds.add(targetId); return 'close'; });
  site.world.fake.takeRequests();

  const uncertain = await browser.submit(form);
  const held = structuredClone(site.removalStore.operations.get(removalOrganization));
  const repeated = await browser.submit(form);
  const current = await browser.open('members');

  assert.equal(uncertain.status, 503, uncertain.body);
  assert.match(uncertain.body, /not confirmed|unconfirmed/i);
  assert.deepEqual(formsIn(uncertain.body), []);
  assert.equal(repeated.status, 409, repeated.body);
  assert.match(repeated.body, /progress|busy|pending/i);
  assert.equal(current.status, 200, current.body);
  assert.doesNotMatch(current.body, /user@example\.com|removal (is|was) confirmed/i);
  assert.deepEqual(site.removalStore.operations.get(removalOrganization), held);
  assert.equal(site.removalStore.admissions.length, 1);
  assert.equal(site.world.fake.takeRequests().filter(request => request.method === 'DELETE').length, 1);
});

test('Given a confirmed removal followed by failed Members reads, when the Admin refreshes, then completion remains separate from the read failure and no deletion is replayed', async (t) => {
  const site = await serveMemberRemovalSite(t);
  const { browser } = await signInThroughServer(site, removalAdmin, removalOrganization);
  const form = await removalForm(browser, site.world.membershipId(removalUser, removalOrganization));
  site.world.fake.takeRequests();

  const applied = await browser.submit(form);
  site.world.membershipOutage = { status: 503, body: { message: 'private read failure' } };
  const refresh = await browser.open('members');

  assert.equal(applied.status, 200, applied.body);
  assert.match(applied.body, /removed/i);
  assert.deepEqual(formsIn(applied.body), []);
  assert.equal(refresh.status, 500, refresh.body);
  assert.deepEqual(formsIn(refresh.body), []);
  assert.doesNotMatch(refresh.body, /private read failure/);
  assert.equal(site.world.fake.takeRequests().filter(request => request.method === 'DELETE').length, 1);
});
