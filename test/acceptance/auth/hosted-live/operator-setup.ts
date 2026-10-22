import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import type { OrganizationMembership } from '@workos-inc/node';
import type { RoleGrant } from '../../../../src/accounts/identity/access-context.ts';
import { WorkOSOrganizations } from '../../../../src/accounts/providers/workos/workos-organizations.ts';
import { workosAuthority } from '../../../../src/accounts/providers/workos/workos-settings.ts';
import { BillingFree } from '../../../../src/accounts/billing/billing-free.ts';
import { OrganizationAdministration } from '../../../../src/accounts/organizations/organization-administration.ts';
import type { LiveRun } from '../../../support/hosted-live/live-run.ts';
import { rolesOf, adminRole, type OperatorRecord } from '../../../support/hosted-live/operator-runbook.ts';
import type { OrganizationFixtures } from '../../../support/hosted-live/organization-fixtures.ts';
import type { LiveUser } from '../../../support/hosted-live/staging-fixtures.ts';

const proofOptions = { timeout: 120_000 };
const adminGrant = { role: 'admin', permissions: ['admin-grants:manage', 'billing:manage', 'product:access', 'user-grants:manage'] };

function assertAdminGrant(grants: readonly RoleGrant[] | undefined): void {
  assert.deepEqual(grants?.map(({ role, permissions }) => ({ role, permissions: permissions.toSorted() })), [adminGrant]);
}

function describeRecord(t: TestContext, record: OperatorRecord): void {
  t.diagnostic(`record: ${record.action} ${record.outcome}; roles ${JSON.stringify(record.rolesBefore ?? null)} > ${JSON.stringify(record.rolesAfter ?? null)}${record.reason === undefined ? '' : `; ${record.reason}`}`);
}

export function describeOperatorSetupProofs(run: LiveRun): void {
  const { workos, settings } = run;
  // The application reads of the hosted edition, against the staging environment.
  const directory = new WorkOSOrganizations({
    authority: workosAuthority(settings.clientId),
    userManagement: workos.userManagement,
    authorization: workos.authorization,
  });

  async function membershipOf(fixtures: OrganizationFixtures, user: LiveUser, organizationId = fixtures.operatorOrganization.id): Promise<OrganizationMembership | undefined> {
    return fixtures.runbook.membership(user.id, organizationId);
  }

  async function membershipsOfUser(userId: string): Promise<string[]> {
    const { data } = await workos.userManagement.listOrganizationMemberships({ userId, statuses: ['active', 'inactive', 'pending'], limit: 100 });
    return data.map((membership) => `${membership.organizationId} ${membership.status} ${JSON.stringify(rolesOf(membership))}`).toSorted();
  }

  describe('Hosted live proofs (AUTH-07W): external operator setup and recovery with the pinned SDK', () => {
    test('Given a verified identity without a membership, when the operator grants Admin, then WorkOS has exactly the role admin with product and administration permissions, and a second grant changes nothing', proofOptions, async (t) => {
      const fixtures = await run.organizationFixtures();
      const user = fixtures.users['new-admin'];
      const organizationId = fixtures.operatorOrganization.id;

      const granted = await fixtures.runbook.grantAdmin({ organizationId, email: user.email });
      const grants = await directory.activeGrants(user.id, organizationId);
      const again = await fixtures.runbook.grantAdmin({ organizationId, email: user.email });
      describeRecord(t, granted);
      describeRecord(t, again);

      assert.deepEqual([granted.outcome, granted.rolesBefore, granted.rolesAfter], ['applied', [], [adminRole]]);
      assertAdminGrant(grants);
      assert.deepEqual([again.outcome, again.rolesAfter], ['unchanged', [adminRole]]);
      assert.deepEqual(rolesOf(await membershipOf(fixtures, user)), [adminRole]);
    });

    test('Given an identity with User in two organizations, when the operator grants and then revokes Admin in one organization, then User stays at each step, and the identity and the other membership do not change', proofOptions, async (t) => {
      const fixtures = await run.organizationFixtures();
      const user = fixtures.users.independent;
      const organizationId = fixtures.operatorOrganization.id;
      const before = await membershipsOfUser(user.id);

      const granted = await fixtures.runbook.grantAdmin({ organizationId, email: user.email });
      const grantsWithAdmin = await directory.activeGrants(user.id, organizationId);
      const revoked = await fixtures.runbook.revokeAdmin({ organizationId, email: user.email });
      const identity = await workos.userManagement.getUser(user.id);
      const after = await membershipsOfUser(user.id);
      describeRecord(t, granted);
      describeRecord(t, revoked);

      assert.deepEqual([granted.outcome, granted.rolesBefore, granted.rolesAfter], ['applied', ['user'], [adminRole, 'user']]);
      assert.deepEqual(grantsWithAdmin?.map(({ role }) => role).toSorted(), [adminRole, 'user']);
      assert.deepEqual([revoked.outcome, revoked.rolesAfter], ['applied', ['user']]);
      assert.deepEqual([identity.id, identity.email], [user.id, user.email]);
      assert.deepEqual(after, before);
    });

    test('Given a membership whose only grant is Admin, when the operator revokes it, then the membership stays active with only the default role, which gives no application permission: the organization service lists no organization for the identity, and the identity stays', proofOptions, async (t) => {
      const fixtures = await run.organizationFixtures();
      const user = fixtures.users['sole-admin'];
      const organizationId = fixtures.operatorOrganization.id;
      const service = new OrganizationAdministration({ directory, records: { record: () => {} }, billing: new BillingFree() });
      const identity = { authority: workosAuthority(settings.clientId), subject: user.id };
      const listedBefore = await service.listOrganizations(identity);

      const revoked = await fixtures.runbook.revokeAdmin({ organizationId, email: user.email });
      const membership = await membershipOf(fixtures, user);
      const listedAfter = await service.listOrganizations(identity);
      describeRecord(t, revoked);

      assert.deepEqual(listedBefore.map(({ organizationId: listed }) => listed), [organizationId]);
      assert.deepEqual([revoked.outcome, revoked.rolesAfter], ['applied', ['member']]);
      assert.equal(membership?.status, 'active');
      assert.deepEqual(await directory.activeGrants(user.id, organizationId), [{ role: 'member', permissions: [] }]);
      assert.deepEqual(listedAfter, []);
      assert.equal((await workos.userManagement.getUser(user.id)).id, user.id);
    });

    test('Given an Admin that also has User, when the operator replaces it with another verified identity, then the new identity gets Admin first, so that the organization keeps an Admin at each step, and the old identity loses only Admin and keeps User', proofOptions, async (t) => {
      const fixtures = await run.organizationFixtures();
      const { outgoing, incoming } = fixtures.users;
      const organizationId = fixtures.operatorOrganization.id;

      const added = await fixtures.runbook.grantAdmin({ organizationId, email: incoming.email });
      const bothAdmins = [rolesOf(await membershipOf(fixtures, outgoing)), rolesOf(await membershipOf(fixtures, incoming))];
      const removed = await fixtures.runbook.revokeAdmin({ organizationId, email: outgoing.email });
      describeRecord(t, added);
      describeRecord(t, removed);

      assert.equal(added.outcome, 'applied');
      assert.deepEqual(bothAdmins, [[adminRole, 'user'], [adminRole]]);
      assert.deepEqual([removed.outcome, removed.rolesAfter], ['applied', ['user']]);
      assert.deepEqual(await directory.activeGrants(outgoing.id, organizationId), [{ role: 'user', permissions: ['product:access'] }]);
      assertAdminGrant(await directory.activeGrants(incoming.id, organizationId));
    });

    test('Given an Admin whose membership is inactive, when the operator recovers access, then the grant for the inactive membership stops without a create or a reactivation, and another verified identity gets Admin', proofOptions, async (t) => {
      const fixtures = await run.organizationFixtures();
      const { lost, recovering } = fixtures.users;
      const organizationId = fixtures.operatorOrganization.id;

      const stopped = await fixtures.runbook.grantAdmin({ organizationId, email: lost.email });
      const lostMembership = await membershipOf(fixtures, lost);
      const recovered = await fixtures.runbook.grantAdmin({ organizationId, email: recovering.email });
      describeRecord(t, stopped);
      describeRecord(t, recovered);

      assert.equal(stopped.outcome, 'stopped');
      assert.match(stopped.reason ?? '', /inactive/);
      assert.deepEqual([lostMembership?.status, rolesOf(lostMembership)], ['inactive', [adminRole]]);
      assert.equal(await directory.activeGrants(lost.id, organizationId), undefined);
      assert.equal(recovered.outcome, 'applied');
      assertAdminGrant(await directory.activeGrants(recovering.id, organizationId));
    });
  });
}
