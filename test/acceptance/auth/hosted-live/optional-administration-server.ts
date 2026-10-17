import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { Page } from 'playwright';
import { once, type LiveRun } from '../../../support/hosted-live/live-run.ts';
import { rolesOf } from '../../../support/hosted-live/operator-runbook.ts';
import { acceptInvitationThroughPortal, serverGet, serverPost, sessionJson, signInThroughPortal, type ServerAnswer } from '../../../support/hosted-live/portal-visit.ts';

const signInOptions = { timeout: 240_000 };

function assertMfaRefusal(answer: ServerAnswer): void {
  assert.equal(answer.status, 403, answer.body);
  assert.match(answer.body, /Administration needs a sign-in that completed multi-factor authentication/);
  assert.doesNotMatch(answer.body, /<form/);
}

async function organizationState(run: LiveRun, organizationId: string) {
  const memberships = await (await run.workos.userManagement.listOrganizationMemberships({ organizationId, statuses: ['active', 'inactive', 'pending'], limit: 100 })).autoPagination();
  const invitations = await (await run.workos.userManagement.listInvitations({ organizationId, limit: 100 })).autoPagination();
  return {
    memberships: memberships.map((membership) => ({ id: membership.id, status: membership.status, roles: rolesOf(membership), updatedAt: membership.updatedAt })).toSorted((a, b) => a.id.localeCompare(b.id)),
    invitations: invitations.map(({ id, state, updatedAt }) => ({ id, state, updatedAt })).toSorted((a, b) => a.id.localeCompare(b.id)),
  };
}

async function refusedChange(run: LiveRun, page: Page, change: { readonly path: string; readonly fields: Readonly<Record<string, string>> }): Promise<void> {
  const { organizationC } = await run.administrationFixtures();
  const before = await organizationState(run, organizationC.id);
  const session = await sessionJson(page);
  assert.equal(session.mfaCompleted, false);
  const answer = await serverPost(page, change.path, { fields: { csrf_token: String(session.csrfToken), organization_id: organizationC.id, ...change.fields } });
  assertMfaRefusal(answer);
  assert.deepEqual(await organizationState(run, organizationC.id), before, 'A refused administration post changed WorkOS data.');
}

export function describeOptionalAdministrationServerCases(run: LiveRun): void {
  const administrator = once(async () => signInThroughPortal(run, (await run.administrationFixtures()).users['c-administrator']));

  describe('Hosted live Optional MFA profile (AUTH-08W): administration stays closed without MFA evidence', () => {
    test('Given Admin, Super Admin, both roles, and User with Admin under Optional MFA, when each signs in and opens members, invitations, and billing, then every read gives the MFA refusal without a form and no WorkOS membership or invitation changes', signInOptions, async () => {
      const { users, organizationC } = await run.administrationFixtures();
      const before = await organizationState(run, organizationC.id);
      for (const label of ['c-admin-only', 'c-super-admin', 'c-administrator', 'c-selective'] as const) {
        const { page } = await signInThroughPortal(run, users[label]);
        assert.equal((await sessionJson(page)).mfaCompleted, false);
        for (const path of ['members', 'invitations', 'billing']) assertMfaRefusal(await serverGet(page, path));
        await page.context().close();
      }
      assert.deepEqual(await organizationState(run, organizationC.id), before);
    });

    test('Given Super Admin and Admin without MFA evidence, when a valid same-origin form grants Admin to the Super Admin, then the post is refused and every WorkOS role and revision stays unchanged', signInOptions, async () => {
      const { memberships } = await run.administrationFixtures();
      await refusedChange(run, (await administrator()).page, { path: 'members/grants', fields: { membership_id: memberships.superAdminInC, revision: 'live', role: 'admin', action: 'grant' } });
    });

    test('Given Super Admin and Admin without MFA evidence, when a valid same-origin form grants User, then the post is refused and WorkOS creates no grant or User seat', signInOptions, async () => {
      const { memberships } = await run.administrationFixtures();
      await refusedChange(run, (await administrator()).page, { path: 'members/grants', fields: { membership_id: memberships.superAdminInC, revision: 'live', role: 'user', action: 'grant' } });
    });

    test('Given Super Admin and Admin without MFA evidence, when a valid same-origin form revokes its own Admin, then the post is refused and both roles stay in WorkOS', signInOptions, async () => {
      const { memberships } = await run.administrationFixtures();
      await refusedChange(run, (await administrator()).page, { path: 'members/grants', fields: { membership_id: memberships.administratorInC, revision: 'live', role: 'admin', action: 'revoke' } });
    });

    test('Given Super Admin and Admin without MFA evidence and a member with only User, when a valid same-origin form revokes User, then the post is refused and its current and second-organization memberships stay unchanged', signInOptions, async () => {
      const { memberships } = await run.administrationFixtures();
      const secondBefore = await run.workos.userManagement.getOrganizationMembership(memberships.lastUserInB);
      await refusedChange(run, (await administrator()).page, { path: 'members/grants', fields: { membership_id: memberships.lastUserInC, revision: 'live', role: 'user', action: 'revoke' } });
      assert.deepEqual(await run.workos.userManagement.getOrganizationMembership(memberships.lastUserInB), secondBefore);
    });

    test('Given Super Admin and Admin without MFA evidence, when forged forms request Super Admin or disable, deactivate, or reset-password, then every post is refused and WorkOS changes nothing', signInOptions, async () => {
      const { memberships } = await run.administrationFixtures();
      for (const change of [{ role: 'super-admin', action: 'grant' }, ...['disable', 'deactivate', 'reset-password'].map((action) => ({ role: 'user', action }))]) {
        await refusedChange(run, (await administrator()).page, { path: 'members/grants', fields: { membership_id: memberships.targetInC, revision: 'live', ...change } });
      }
    });

    test('Given Super Admin and Admin without MFA evidence and a pending WorkOS invitation, when valid forms send, resend, and revoke invitations, then every post is refused and WorkOS keeps exactly the same invitations and membership revisions', signInOptions, async () => {
      const { users, organizationC } = await run.administrationFixtures();
      const pending = await run.workos.userManagement.sendInvitation({ organizationId: organizationC.id, email: users['c-invitee-revoked'].email, roleSlug: 'user' });
      const { page } = await administrator();
      await refusedChange(run, page, { path: 'invitations/send', fields: { email: users['c-invitee-user'].email, role: 'user' } });
      for (const path of ['invitations/resend', 'invitations/revoke']) await refusedChange(run, page, { path, fields: { invitation_id: pending.id } });
    });

    test('Given User and Admin invitations made by the operator under Optional MFA, when the invitees accept through AuthKit without an MFA demand, then both sessions have no MFA evidence, User opens the product, Admin opens no administration page, and WorkOS gives only each invited role', signInOptions, async () => {
      const { users, organizationC } = await run.administrationFixtures();
      for (const [label, role] of [['c-invitee-user', 'user'], ['c-invitee-admin', 'admin']] as const) {
        const user = users[label];
        const invitation = await run.workos.userManagement.sendInvitation({ organizationId: organizationC.id, email: user.email, roleSlug: role });
        const { acceptInvitationUrl } = await run.workos.userManagement.getInvitation(invitation.id);
        const { page, pages } = await acceptInvitationThroughPortal(run, user, acceptInvitationUrl);
        assert.ok(pages.every((path) => !path.startsWith('/mfa/')));
        assert.equal((await sessionJson(page)).mfaCompleted, false);
        assert.equal((await serverGet(page, 'portal/access')).status, role === 'user' ? 200 : 403);
        for (const path of ['members', 'invitations', 'billing']) assertMfaRefusal(await serverGet(page, path));
        const memberships = await (await run.workos.userManagement.listOrganizationMemberships({ userId: user.id, organizationId: organizationC.id, statuses: ['active'] })).autoPagination();
        assert.equal(memberships.length, 1);
        assert.deepEqual(rolesOf(memberships[0]), [role]);
        assert.equal((await run.workos.userManagement.getInvitation(invitation.id)).state, 'accepted');
        await page.context().close();
      }
    });
  });
}
