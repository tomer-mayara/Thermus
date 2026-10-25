import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AuditLog, type AuditEvent } from '../../../src/logs/audit/audit-log.ts';
import { formsIn, formLabelled } from '../../support/drivers/browser/hosted-browser.ts';
import { signInThroughServer } from '../../support/dsl/workos-sign-in.ts';
import { removalForm } from '../../support/dsl/hosted-member-removal.ts';
import { otherOrganization, removalAdmin, removalOrganization, removalUser, serveMemberRemovalSite } from '../../support/in-process/hosted-member-removal-site.ts';

test('Given a target Admin with two memberships, a global account, and a personal factor, when Members removes one membership and a fresh User invitation is accepted, then only invited User access returns and the other account state stays intact', async (t) => {
  const site = await serveMemberRemovalSite(t, { setUp: world => world.setRoles(removalUser, removalOrganization, ['admin']) });
  const { browser: admin } = await signInThroughServer(site, removalAdmin, removalOrganization);
  const { browser: target } = await signInThroughServer(site, removalUser, removalOrganization);
  const { browser: other } = await signInThroughServer(site, removalUser, otherOrganization);
  const targetId = site.world.membershipId(removalUser, removalOrganization);
  const otherId = site.world.membershipId(removalUser, otherOrganization);
  const token = await site.world.connectToken(removalUser, { org_id: removalOrganization });
  const otherToken = await site.world.connectToken(removalUser, { org_id: otherOrganization });
  const oldInvitationForm = formLabelled(formsIn((await target.open('members')).body), 'Invite');
  const factor = { object: 'authentication_factor', id: 'auth_factor_PERSONAL', type: 'totp', totp: { issuer: 'Thermus', user: removalUser.email }, created_at: '2026-10-01T08:00:00.000Z', updated_at: '2026-10-01T08:00:00.000Z' };
  site.world.fake.answer(`GET /user_management/users/${removalUser.id}/auth_factors`, { status: 200, body: { object: 'list', data: [factor], list_metadata: { before: null, after: null } } });
  const { workos } = site.world.connection();
  const account = await workos.userManagement.getUser(removalUser.id);
  const factors = (await workos.multiFactorAuth.listUserAuthFactors({ userId: removalUser.id })).data;
  const otherMembership = await workos.userManagement.getOrganizationMembership(otherId);
  const form = await removalForm(admin, targetId);
  site.world.fake.takeRequests();

  assert.equal((await admin.submit(form)).status, 200);

  assert.equal((await target.open('portal/access')).status, 403);
  assert.equal((await target.open('members')).status, 403);
  assert.equal((await site.discover(token)).status, 403);
  assert.equal((await other.open('portal/access')).status, 200);
  assert.equal((await site.discover(otherToken)).status, 200);
  assert.deepEqual(await workos.userManagement.getOrganizationMembership(otherId), otherMembership);
  assert.deepEqual(await workos.userManagement.getUser(removalUser.id), account);
  assert.deepEqual((await workos.multiFactorAuth.listUserAuthFactors({ userId: removalUser.id })).data, factors);
  const deletionWrites = site.world.fake.takeRequests().filter(request => request.method !== 'GET');
  assert.deepEqual(deletionWrites.map(({ method, path }) => [method, path]), [['DELETE', `/user_management/organization_memberships/${targetId}`]]);

  const invitationForm = formLabelled(formsIn((await admin.open('members')).body), 'Invite');
  const sent = await admin.submit({ ...invitationForm, fields: { ...invitationForm.fields, email: removalUser.email, role: 'user' } });
  assert.equal(sent.status, 303, sent.body);
  const invitation = site.world.invitations.find(each => each.email === removalUser.email && each.state === 'pending');
  assert.ok(invitation);
  assert.equal((await site.discover(token)).status, 403, 'A pending invitation gives no access');
  site.world.acceptInvitation(invitation.id);
  const returning = await signInThroughServer(site, removalUser, removalOrganization);
  assert.equal(returning.callback.location?.href, site.publicBaseUrl);
  assert.equal((await returning.browser.open('portal/access')).status, 200);
  assert.equal((await site.discover(token)).status, 200);
  assert.equal((await returning.browser.open('members')).status, 403, 'The new invitation grants only User access');
  assert.equal((await target.submit({ ...oldInvitationForm, fields: { ...oldInvitationForm.fields, email: 'unwanted@example.com' } })).status, 403);
  assert.deepEqual(await workos.userManagement.getOrganizationMembership(otherId), otherMembership);
  assert.deepEqual(await workos.userManagement.getUser(removalUser.id), account);
  assert.deepEqual((await workos.multiFactorAuth.listUserAuthFactors({ userId: removalUser.id })).data, factors);
  assert.equal(site.world.deletedMembershipIds.has(targetId), true, 'The former membership stays deleted');
});

for (const outcome of ['applied', 'unknown'] as const) {
  test(`Given ${outcome} removal and a throwing customer Audit sink, when Members submits and reads again, then the outcome and receipt or hold stay unchanged with one deletion`, async (t) => {
    const events: AuditEvent[] = [];
    const audit = new AuditLog({ writeAuditEvent: event => { events.push(event); throw new Error('customer export unavailable'); } });
    const site = await serveMemberRemovalSite(t, { audit });
    const { browser } = await signInThroughServer(site, removalAdmin, removalOrganization);
    const targetId = site.world.membershipId(removalUser, removalOrganization);
    const form = await removalForm(browser, targetId);
    if (outcome === 'unknown') site.world.fake.answer(`DELETE /user_management/organization_memberships/${targetId}`, () => { site.world.deletedMembershipIds.add(targetId); return 'close'; });
    site.world.fake.takeRequests();

    const answer = await browser.submit(form);
    const retained = structuredClone(site.removalStore.operations.get(removalOrganization));
    assert.equal((await browser.open('members')).status, 200);
    if (outcome === 'unknown') assert.equal((await browser.submit(form)).status, 409);

    assert.equal(answer.status, outcome === 'applied' ? 200 : 503, answer.body);
    assert.equal(retained?.outcome, outcome === 'applied' ? 'applied' : null);
    assert.deepEqual(site.removalStore.operations.get(removalOrganization), retained);
    const captured = events.filter(event => event.eventName === 'organization.changed');
    assert.equal(captured[0]?.outcome, outcome);
    assert.deepEqual(captured[0]?.target, { membershipId: targetId });
    assert.equal(captured[0]?.organizationId, `workos:${site.world.settings.clientId}:${removalOrganization}`);
    assert.equal(site.world.fake.takeRequests().filter(request => request.method === 'DELETE').length, 1);
  });
}

test('Given a valid Admin form with a forged organization, when Members refuses it, then no customer event is captured for the forged tenant and no provider deletion is sent', async (t) => {
  const events: AuditEvent[] = [];
  const site = await serveMemberRemovalSite(t, { audit: new AuditLog({ writeAuditEvent: event => { events.push(event); } }) });
  const { browser } = await signInThroughServer(site, removalAdmin, removalOrganization);
  const form = await removalForm(browser, site.world.membershipId(removalUser, removalOrganization));
  site.world.fake.takeRequests();

  const answer = await browser.submit({ ...form, fields: { ...form.fields, organization_id: otherOrganization } });

  assert.equal(answer.status, 409, answer.body);
  assert.equal(events.some(event => event.organizationId === `workos:${site.world.settings.clientId}:${otherOrganization}`), false);
  assert.deepEqual(site.world.fake.takeRequests().filter(request => request.method === 'DELETE'), []);
  assert.equal(site.removalStore.admissions.length, 0);
});
